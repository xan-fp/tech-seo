import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { assignOwner } from './assign-owner'
import type { ParsedIssue, Severity, SeoCategory } from './types'

// ─── Issue-type → SeoCategory mapper ─────────────────────────────────────

function inferCategory(issueType: string): SeoCategory | null {
  const t = issueType.toLowerCase()
  if (t.includes('index') || t.includes('noindex'))                          return 'Indexation'
  if (t.includes('crawl') || t.includes('robots') || t.includes('disallow')) return 'Crawlability'
  if (t.includes('robots.txt'))                                               return 'Robots.txt'
  if (t.includes('sitemap'))                                                  return 'Sitemap'
  if (t.includes('redirect') || t.includes('3xx') || t.includes('301')
    || t.includes('302'))                                                     return 'Redirects'
  if (t.includes('canonical'))                                                return 'Canonicals'
  if (t.includes('hreflang') || t.includes('alternate') || t.includes('lang')) return 'Hreflang'
  if (t.includes('meta') || t.includes('title tag') || t.includes('h1')
    || t.includes('heading'))                                                 return 'Metadata'
  if (t.includes('schema') || t.includes('structured data')
    || t.includes('json-ld') || t.includes('rich'))                          return 'Structured Data'
  if (t.includes('speed') || t.includes('core web vitals')
    || t.includes('lcp') || t.includes('cls') || t.includes('fid')
    || t.includes('performance'))                                             return 'Page Speed'
  if (t.includes('image') || t.includes('alt text') || t.includes('alt tag')) return 'Images'
  if (t.includes('internal link') || t.includes('anchor'))                   return 'Internal Links'
  if (t.includes('broken') || t.includes('4xx') || t.includes('404')
    || t.includes('dead link'))                                               return 'Broken Links'
  if (t.includes('duplicate') || t.includes('duplicat'))                     return 'Duplicate Content'
  if (t.includes('thin'))                                                     return 'Thin Content'
  if (t.includes('content quality') || t.includes('readability'))            return 'Content Quality'
  if (t.includes('url') || t.includes('slug') || t.includes('structure'))    return 'URL Structure'
  if (t.includes('backlink') || t.includes('incoming link')
    || t.includes('external link'))                                           return 'Backlinks'
  if (t.includes('search console') || t.includes('gsc'))                     return 'Search Console'
  if (t.includes('5xx') || t.includes('server error'))                       return 'Crawlability'
  return null
}

// ─── Column name matchers ──────────────────────────────────────────────────

function findCol(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const c of candidates) {
    const i = lower.findIndex(h => h === c || h.includes(c))
    if (i !== -1) return headers[i]
  }
  return undefined
}

const URL_COLS       = ['url', 'address', 'page', 'href', 'link', 'source url', 'source']
const ISSUE_COLS     = ['issue', 'error', 'warning', 'problem', 'type', 'category', 'check', 'issue type', 'issue name']
const SEVERITY_COLS  = ['severity', 'priority', 'level', 'importance', 'impact']
const DESC_COLS      = ['description', 'detail', 'recommendation', 'fix', 'info', 'note', 'message', 'details']
const TITLE_COLS     = ['title', 'name', 'summary', 'headline']

// ─── Severity normaliser ──────────────────────────────────────────────────

function normalizeSeverity(raw: string | undefined): Severity {
  if (!raw) return 'medium'
  const v = raw.toLowerCase().trim()
  if (v.includes('critical') || v.includes('error') || v === '1' || v === 'p0' || v === 'blocker') return 'critical'
  if (v.includes('high')     || v.includes('warning') || v === '2' || v === 'p1')                  return 'high'
  if (v.includes('medium')   || v.includes('moderate') || v.includes('notice') || v === '3' || v === 'p2') return 'medium'
  return 'low'
}

// ─── Screaming Frog crawl detection + extraction ─────────────────────────

function isScreamingFrogCrawl(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase())
  return lower.includes('address') && lower.some(h => h.includes('status code'))
}

function parseScreamingFrogCrawl(rows: Record<string, string>[]): ParsedIssue[] {
  const issues: ParsedIssue[] = []

  for (const row of rows) {
    const url   = row['Address'] ?? row['address'] ?? null
    const code  = parseInt(row['Status Code'] ?? row['status code'] ?? '200', 10)
    const title = row['Title 1'] ?? row['title 1'] ?? ''
    const meta  = row['Meta Description 1'] ?? row['meta description 1'] ?? ''
    const h1    = row['H1-1'] ?? row['h1-1'] ?? ''
    const words = parseInt(row['Word Count'] ?? row['word count'] ?? '100', 10)

    if (code >= 400) {
      const issueType = code >= 500 ? '5xx Server Error' : '4xx Client Error'
      const { owner, reason, needsReview } = assignOwner(issueType)
      issues.push({
        url,
        title:             `${code} Error: ${url ?? 'Unknown URL'}`,
        description:       `HTTP ${code} response detected. This URL needs to be fixed or redirected.`,
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity:          code >= 500 ? 'critical' : 'high',
        priority:          code >= 500 ? 'critical' : 'high',
        impact:            'high',
        effort:            'medium',
        confidence:        'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   'Set up a 301 redirect to the correct URL, or restore the page if it should exist.',
        tags:              [],
      })
    }

    if (!title && code < 400) {
      const issueType = 'Missing Title Tag'
      const { owner, reason, needsReview } = assignOwner(issueType)
      issues.push({
        url,
        title:             `Missing Title Tag: ${url ?? 'Unknown URL'}`,
        description:       'The page has no title tag. Add a unique, descriptive title.',
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity:          'high',
        priority:          'high',
        impact:            'high',
        effort:            'low',
        confidence:        'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   'Add a unique, descriptive <title> tag (50–60 characters) to the page.',
        tags:              [],
      })
    }

    if (!meta && code < 400) {
      const issueType = 'Missing Meta Description'
      const { owner, reason, needsReview } = assignOwner(issueType)
      issues.push({
        url,
        title:             `Missing Meta Description: ${url ?? 'Unknown URL'}`,
        description:       'The page has no meta description. Add one to improve CTR.',
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity:          'medium',
        priority:          'medium',
        impact:            'medium',
        effort:            'low',
        confidence:        'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   'Write a compelling meta description (120–155 characters) summarising the page content.',
        tags:              [],
      })
    }

    if (!h1 && code < 400) {
      const issueType = 'Missing H1'
      const { owner, reason, needsReview } = assignOwner(issueType)
      issues.push({
        url,
        title:             `Missing H1: ${url ?? 'Unknown URL'}`,
        description:       'The page is missing an H1 heading.',
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity:          'medium',
        priority:          'medium',
        impact:            'medium',
        effort:            'low',
        confidence:        'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   'Add a single H1 tag that clearly describes the primary topic of the page.',
        tags:              [],
      })
    }

    if (words > 0 && words < 300 && code < 400) {
      const issueType = 'Thin Content'
      const { owner, reason, needsReview } = assignOwner(issueType)
      issues.push({
        url,
        title:             `Thin Content: ${url ?? 'Unknown URL'}`,
        description:       `Page has only ${words} words. Consider expanding or consolidating.`,
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity:          'low',
        priority:          'low',
        impact:            'medium',
        effort:            'high',
        confidence:        'medium',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   'Expand the content to at least 300 words, or consolidate with a related page via a 301 redirect.',
        tags:              [],
      })
    }
  }

  return issues
}

// ─── Generic issue-list format ────────────────────────────────────────────

function parseGenericIssueList(rows: Record<string, string>[]): ParsedIssue[] {
  if (rows.length === 0) return []

  const headers = Object.keys(rows[0])

  const urlCol      = findCol(headers, URL_COLS)
  const issueCol    = findCol(headers, ISSUE_COLS)
  const severityCol = findCol(headers, SEVERITY_COLS)
  const descCol     = findCol(headers, DESC_COLS)
  const titleCol    = findCol(headers, TITLE_COLS)

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url       = urlCol      ? (row[urlCol]?.trim()      || null) : null
      const issueType = issueCol    ? (row[issueCol]?.trim()    || 'Unknown Issue') : 'Unknown Issue'
      const rawSev    = severityCol ? row[severityCol]?.trim()  : undefined
      const desc      = descCol     ? (row[descCol]?.trim()     || null) : null

      // Title: prefer a dedicated title col, else use the issue + URL
      let title = titleCol ? row[titleCol]?.trim() : ''
      if (!title) {
        title = url
          ? `${issueType}: ${url.replace(/^https?:\/\/[^/]+/, '') || '/'}`
          : issueType
      }
      title = title.slice(0, 140)

      const severity                        = normalizeSeverity(rawSev)
      const { owner, reason, needsReview }  = assignOwner(issueType)

      return {
        url,
        title,
        description:       desc,
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity,
        priority:          severity,  // default priority = severity
        impact:            'medium' as const,
        effort:            'medium' as const,
        confidence:        needsReview ? 'low' as const : 'medium' as const,
        owner,
        source_tool:       null,
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    1,
        affected_urls:     url ? [url] : [],
        recommended_fix:   null,
        tags:              [],
      }
    })
}

// ─── Severity ranking ─────────────────────────────────────────

const SEV_RANK: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
}

// ─── Deduplication ────────────────────────────────────────────
//
// Groups parsed issues by issue_type + owner.
// Multiple rows with the same issue type become ONE ticket with:
//   - a count of how many pages are affected
//   - all affected URLs listed in the description
//   - the highest severity found in the group

export function dedupeIssues(issues: ParsedIssue[]): ParsedIssue[] {
  // Group by issue_type (case-insensitive)
  const groups = new Map<string, ParsedIssue[]>()

  for (const issue of issues) {
    const key = issue.issue_type.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(issue)
  }

  const deduped: ParsedIssue[] = []

  for (const group of Array.from(groups.values())) {
    const count       = group.length
    const first       = group[0]
    const allUrls     = group.map(i => i.url).filter((u): u is string => u !== null && u.trim() !== '')
    const uniqueUrls  = Array.from(new Set(allUrls))

    // Pick the highest severity in the group
    const topSeverity = group.reduce((best, i) =>
      (SEV_RANK[i.severity] ?? 0) > (SEV_RANK[best.severity] ?? 0) ? i : best
    , first).severity

    // Build the title
    const title = count === 1
      ? first.title
      : `${first.issue_type} — ${count} pages affected`

    // Build description: original description + affected URLs list
    const urlList = uniqueUrls.length === 0
      ? ''
      : uniqueUrls.length <= 20
        ? `\n\nAffected URLs:\n${uniqueUrls.map(u => `• ${u}`).join('\n')}`
        : `\n\nAffected URLs (first 20 of ${uniqueUrls.length}):\n${uniqueUrls.slice(0, 20).map(u => `• ${u}`).join('\n')}\n…and ${uniqueUrls.length - 20} more`

    const description = (first.description ?? '') + urlList || null

    deduped.push({
      ...first,
      title,
      description,
      severity:       topSeverity,
      url:            uniqueUrls[0] ?? null,
      affected_count: count,
      affected_urls:  uniqueUrls,
    })
  }

  // Sort by severity descending
  return deduped.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))
}

// ─── Public API ───────────────────────────────────────────────

export function parseAuditFile(buffer: Buffer, ext: string): ParsedIssue[] {
  let rows: Record<string, string>[]

  if (ext === 'csv') {
    const text   = buffer.toString('utf-8')
    const result = Papa.parse<Record<string, string>>(text, {
      header:          true,
      skipEmptyLines:  true,
      transformHeader: h => h.trim(),
    })
    rows = result.data
  } else {
    // xlsx / xls
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  if (rows.length === 0) return []

  const headers = Object.keys(rows[0])
  if (isScreamingFrogCrawl(headers)) {
    return parseScreamingFrogCrawl(rows)
  }

  return parseGenericIssueList(rows)
}
