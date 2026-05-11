/**
 * AI-powered SEO issue classification using Claude.
 *
 * Called after deduplication on any ticket whose issue_type is still
 * "Unknown Issue". All unknowns are sent in a single API call so the
 * upload stays fast regardless of how many there are.
 *
 * Silently falls back to the original data if ANTHROPIC_API_KEY is not
 * set or the API call fails.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Owner, ParsedIssue, Severity } from './types'

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface Classification {
  issue_type:  string
  owner:       Owner
  severity:    Severity
  description: string
}

const SYSTEM_PROMPT = `You are a senior SEO specialist. You will receive a list of unclassified SEO audit issues exported from tools like Screaming Frog, Ahrefs, or Semrush. Your job is to:

1. Give each issue a clear, specific SEO issue name (e.g. "Broken Internal Links", "Duplicate Title Tags", "Missing Alt Text", "Slow Page Speed", "Orphaned Pages").
2. Assign it to the correct owner bucket:
   - tech: server errors, redirects, canonicals, page speed, Core Web Vitals, crawlability, robots.txt, sitemaps, hreflang, schema/structured data, JavaScript rendering issues
   - site_content_lead: meta titles, meta descriptions, H1 tags, alt text, on-page content structure, image optimization, internal linking
   - copy_blog_lead: body copy quality, thin content, duplicate content, blog posts, readability, content gaps, keyword targeting
3. Rate severity:
   - critical: blocks crawling or indexing
   - high: significant ranking or visibility impact
   - medium: moderate SEO impact, should be fixed
   - low: minor improvement opportunity
4. Write a one-sentence description of what the issue is and why it matters for SEO.`

export async function classifyUnknownIssues(issues: ParsedIssue[]): Promise<ParsedIssue[]> {
  const client = getClient()
  if (!client) return issues

  // Only classify genuinely unknown issues
  const unknownIndices = issues
    .map((issue, i) => ({ issue, i }))
    .filter(({ issue }) =>
      issue.issue_type === 'Unknown Issue' ||
      issue.issue_type.toLowerCase().trim() === 'unknown' ||
      issue.issue_type.trim() === ''
    )

  if (unknownIndices.length === 0) return issues

  // Build a compact batch prompt
  const issueList = unknownIndices.map(({ issue }, idx) => {
    const sampleUrls = issue.affected_urls.slice(0, 3).join(', ') || 'N/A'
    const desc       = issue.description?.replace(/Affected URLs[\s\S]*/i, '').trim().slice(0, 200) || 'N/A'
    return `Issue ${idx + 1}:\n  Sample URLs: ${sampleUrls}\n  Raw description: ${desc}`
  }).join('\n\n')

  const userMessage = `Classify these ${unknownIndices.length} unrecognized SEO issue(s) found in an audit CSV export.

${issueList}

Return a JSON array with exactly ${unknownIndices.length} objects in the same order:
[
  {
    "issue_type": "Specific SEO Issue Name",
    "owner": "tech" | "site_content_lead" | "copy_blog_lead",
    "severity": "critical" | "high" | "medium" | "low",
    "description": "One sentence: what it is and why it matters."
  }
]
Return ONLY the JSON array, no other text.`

  try {
    const response = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract JSON array (handle markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[classify] No JSON array found in response:', text.slice(0, 200))
      return issues
    }

    const classifications: Classification[] = JSON.parse(jsonMatch[0])

    // Merge back into the issues array
    const updated = [...issues]
    unknownIndices.forEach(({ i }, idx) => {
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
        assignment_reason: `Classified by Claude AI — assigned to ${cls.owner} based on issue analysis.`,
        needs_review:      false,
        title:             count > 1
          ? `${cls.issue_type} — ${count} pages affected`
          : cls.issue_type,
      }
    })

    console.info(`[classify] Classified ${classifications.length} unknown issue(s) using Claude.`)
    return updated

  } catch (err) {
    console.error('[classify] AI classification failed, keeping originals:', err)
    return issues  // always fall back gracefully
  }
}
