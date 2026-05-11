/**
 * AI-powered SEO issue classification using Claude.
 *
 * Two passes:
 *
 * 1. classifyRawUnknowns()  — runs on raw issues BEFORE deduplication.
 *    Groups "Unknown Issue" rows by URL-path + description fingerprint,
 *    sends representative samples to Claude, maps proper issue types back
 *    to every matching row so deduplication can group them correctly.
 *
 * 2. classifyAmbiguousTickets() — runs on deduplicated tickets.
 *    Reclassifies any ticket that still has needs_review=true or an
 *    unrecognised issue type (things like "Incoming links" that our
 *    keyword matcher missed).
 *
 * Both calls are silently skipped if ANTHROPIC_API_KEY is not set.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Owner, ParsedIssue, Severity } from './types'

// ── client ────────────────────────────────────────────────────────────────────

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ── shared types ──────────────────────────────────────────────────────────────

interface Classification {
  issue_type:  string
  owner:       Owner
  severity:    Severity
  description: string
}

// ── system prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a senior SEO specialist. Classify SEO audit issues.

Owner rules (pick exactly one):
- tech: server errors, redirects, canonicals, page speed, Core Web Vitals, crawlability, robots.txt, sitemaps, hreflang, schema/structured data, JS rendering
- site_content_lead: meta titles, meta descriptions, H1 tags, alt text, on-page content structure, image optimisation, internal linking
- copy_blog_lead: body copy quality, thin content, duplicate content, blog posts, readability, content gaps, keyword targeting

Severity:
- critical: blocks crawling or indexing
- high: significant ranking / visibility impact
- medium: moderate SEO impact, should be fixed
- low: minor improvement opportunity

Always return ONLY a valid JSON array — no markdown, no explanation.`

// ── helper: call Claude and parse JSON array ──────────────────────────────────

async function askClaude(
  client: Anthropic,
  userMsg: string,
  expected: number,
): Promise<Classification[]> {
  const response = await client.messages.create({
    model:      'claude-3-5-haiku-20241022',
    max_tokens: 2048,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: userMsg }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    console.error('[classify] No JSON array in response:', text.slice(0, 300))
    return []
  }

  const parsed: Classification[] = JSON.parse(match[0])
  if (parsed.length !== expected) {
    console.warn(`[classify] Expected ${expected} items, got ${parsed.length}`)
  }
  return parsed
}

// ── fingerprint for clustering unknown raw rows ───────────────────────────────

function fingerprint(issue: ParsedIssue): string {
  const pathPrefix = issue.url
    ? issue.url.replace(/^https?:\/\/[^/]+/, '').split('/').slice(0, 2).join('/')
    : ''
  const descSnippet = (issue.description ?? '').slice(0, 60).toLowerCase().replace(/\s+/g, ' ').trim()
  return `${pathPrefix}||${descSnippet}`
}

// ── Pass 1: classify raw "Unknown Issue" rows BEFORE deduplication ────────────

export async function classifyRawUnknowns(issues: ParsedIssue[]): Promise<ParsedIssue[]> {
  const client = getClient()
  if (!client) return issues

  const unknownIdxs = issues
    .map((issue, i) => ({ issue, i }))
    .filter(({ issue }) =>
      issue.issue_type === 'Unknown Issue' ||
      issue.issue_type.toLowerCase().trim() === 'unknown' ||
      issue.issue_type.trim() === ''
    )

  if (unknownIdxs.length === 0) return issues

  // Cluster by fingerprint so we only classify unique patterns
  const clusterMap = new Map<string, number>()   // fingerprint → representative index
  const clusters:   Array<{ fp: string; representative: ParsedIssue; indices: number[] }> = []

  for (const { issue, i } of unknownIdxs) {
    const fp = fingerprint(issue)
    if (!clusterMap.has(fp)) {
      clusterMap.set(fp, clusters.length)
      clusters.push({ fp, representative: issue, indices: [i] })
    } else {
      clusters[clusterMap.get(fp)!].indices.push(i)
    }
  }

  // Cap at 20 clusters per call to keep the prompt manageable
  const toClassify = clusters.slice(0, 20)

  const itemList = toClassify.map((c, idx) => {
    const { representative: r } = c
    const urlSamples = [r.url, ...r.affected_urls.slice(0, 2)].filter(Boolean).join(', ')
    const desc = (r.description ?? '').slice(0, 200)
    return `Item ${idx + 1}:\n  URL samples: ${urlSamples || 'N/A'}\n  Description: ${desc || 'N/A'}`
  }).join('\n\n')

  const userMsg = `These rows in an SEO audit CSV have no recognised issue type. Classify each one based on its URL patterns and any available description.

${itemList}

Return a JSON array with exactly ${toClassify.length} objects:
[{ "issue_type": "...", "owner": "...", "severity": "...", "description": "..." }]`

  try {
    const classifications = await askClaude(client, userMsg, toClassify.length)
    const updated = [...issues]

    toClassify.forEach((cluster, idx) => {
      const cls = classifications[idx]
      if (!cls) return
      for (const i of cluster.indices) {
        updated[i] = {
          ...updated[i],
          issue_type:        cls.issue_type,
          owner:             cls.owner,
          severity:          cls.severity,
          description:       cls.description,
          assignment_reason: `Classified by Claude AI — assigned to ${cls.owner}.`,
          needs_review:      false,
        }
      }
    })

    console.info(`[classify] Pass 1: classified ${toClassify.length} unknown clusters across ${unknownIdxs.length} rows.`)
    return updated
  } catch (err) {
    console.error('[classify] Pass 1 failed:', err)
    return issues
  }
}

// ── Pass 2: reclassify ambiguous tickets AFTER deduplication ──────────────────

export async function classifyAmbiguousTickets(issues: ParsedIssue[]): Promise<ParsedIssue[]> {
  const client = getClient()
  if (!client) return issues

  // Target: needs_review=true OR still "Unknown Issue" after pass 1
  const targets = issues
    .map((issue, i) => ({ issue, i }))
    .filter(({ issue }) =>
      issue.needs_review === true ||
      issue.issue_type === 'Unknown Issue' ||
      issue.issue_type.toLowerCase().trim() === 'unknown'
    )

  if (targets.length === 0) return issues

  const itemList = targets.map(({ issue }, idx) => {
    const urls = issue.affected_urls.slice(0, 3).join(', ') || 'N/A'
    const desc = (issue.description ?? '').replace(/Affected URLs[\s\S]*/i, '').trim().slice(0, 200)
    return `Item ${idx + 1}:\n  Current label: "${issue.issue_type}"\n  URL samples: ${urls}\n  Description: ${desc || 'N/A'}`
  }).join('\n\n')

  const userMsg = `These deduplicated SEO audit tickets need better classification. Some have ambiguous owner assignments; others have unrecognised labels.

${itemList}

Return a JSON array with exactly ${targets.length} objects:
[{ "issue_type": "...", "owner": "...", "severity": "...", "description": "..." }]`

  try {
    const classifications = await askClaude(client, userMsg, targets.length)
    const updated = [...issues]

    targets.forEach(({ i }, idx) => {
      const cls = classifications[idx]
      if (!cls) return
      const issue = updated[i]
      const count = issue.affected_count
      const urlBlock = issue.affected_urls.length > 0
        ? `\n\nAffected URLs:\n${issue.affected_urls.slice(0, 20).map(u => `• ${u}`).join('\n')}${issue.affected_urls.length > 20 ? `\n…and ${issue.affected_urls.length - 20} more` : ''}`
        : ''

      updated[i] = {
        ...issue,
        issue_type:        cls.issue_type,
        owner:             cls.owner,
        severity:          cls.severity,
        description:       cls.description + urlBlock,
        assignment_reason: `Classified by Claude AI — assigned to ${cls.owner}.`,
        needs_review:      false,
        title: count > 1
          ? `${cls.issue_type} — ${count} pages affected`
          : cls.issue_type,
      }
    })

    console.info(`[classify] Pass 2: reclassified ${targets.length} ambiguous ticket(s).`)
    return updated
  } catch (err) {
    console.error('[classify] Pass 2 failed:', err)
    return issues
  }
}
