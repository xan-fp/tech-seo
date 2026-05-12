/**
 * parse-audit.ts
 *
 * Converts a raw CSV/XLSX buffer into an array of ParsedIssue objects.
 *
 * Supported formats (detected automatically):
 *   sf_crawl    – Screaming Frog full crawl export (Address + Status Code columns)
 *   sf_issues   – Screaming Frog Issues tab export (Address + Issue columns)
 *   ahrefs      – Ahrefs Site Audit URL-level export
 *   ahrefs_agg  – Ahrefs aggregate issue list (no per-URL rows)
 *   semrush     – Semrush Site Audit export
 *   gsc         – Google Search Console Coverage / URL inspection export
 *   moz         – Moz Site Crawl export
 *   sitebulb    – Sitebulb URL-level export
 *   generic     – Any other tool (heuristic + AI column detection)
 *
 * parseAuditFile() is async so it can fall back to Claude for column mapping
 * when heuristics are not confident enough.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { assignOwner } from './assign-owner'
import { detectAuditColumns } from './classify'
import type { Confidence, Impact, ParsedIssue, Priority, SeoCategory, Severity } from './types'

// ─── SeoCategory inference ────────────────────────────────────────────────────

export function inferCategory(issueType: string): SeoCategory | null {
  const t = issueType.toLowerCase()
  if (t.includes('robots.txt'))                                                return 'Robots.txt'
  if (t.includes('sitemap'))                                                   return 'Sitemap'
  if (t.includes('noindex') || t.includes('index'))                           return 'Indexation'
  if (t.includes('crawl') || t.includes('robots') || t.includes('disallow'))  return 'Crawlability'
  if (t.includes('redirect') || t.includes('3xx') || t.includes('301') || t.includes('302')) return 'Redirects'
  if (t.includes('canonical'))                                                  return 'Canonicals'
  if (t.includes('hreflang') || t.includes('alternate') || t.includes('lang')) return 'Hreflang'
  if (t.includes('meta') || t.includes('title tag') || t.includes('h1') || t.includes('heading')) return 'Metadata'
  if (t.includes('schema') || t.includes('structured data') || t.includes('json-ld') || t.includes('rich')) return 'Structured Data'
  if (t.includes('speed') || t.includes('core web vitals') || t.includes('lcp') || t.includes('cls') || t.includes('fid') || t.includes('performance')) return 'Page Speed'
  if (t.includes('image') || t.includes('alt text') || t.includes('alt tag')) return 'Images'
  if (t.includes('internal link') || t.includes('anchor'))                    return 'Internal Links'
  if (t.includes('broken') || t.includes('4xx') || t.includes('404') || t.includes('dead link')) return 'Broken Links'
  if (t.includes('duplicate') || t.includes('duplicat'))                      return 'Duplicate Content'
  if (t.includes('thin'))                                                       return 'Thin Content'
  if (t.includes('content quality') || t.includes('readability'))             return 'Content Quality'
  if (t.includes('url') || t.includes('slug'))                                return 'URL Structure'
  if (t.includes('backlink') || t.includes('incoming link') || t.includes('external link')) return 'Backlinks'
  if (t.includes('search console') || t.includes('gsc'))                      return 'Search Console'
  if (t.includes('5xx') || t.includes('server error'))                        return 'Crawlability'
  return null
}

// ─── Severity normaliser ──────────────────────────────────────────────────────

function normalizeSeverity(raw: string | undefined): Severity {
  if (!raw) return 'medium'
  const v = raw.toLowerCase().trim()
  if (v.includes('critical') || v.includes('blocker') || v === '1' || v === 'p0') return 'critical'
  if (v.includes('high')  || v.includes('error')   || v === '2' || v === 'p1')    return 'high'
  if (v.includes('medium')|| v.includes('moderate')|| v.includes('warning') || v.includes('notice') || v === '3' || v === 'p2') return 'medium'
  return 'low'
}

// ─── Column-mapping types ─────────────────────────────────────────────────────

interface ColumnMapping {
  urlCol:      string | null
  issueCol:    string | null
  severityCol: string | null
  descCol:     string | null
  sourceTool:  string | null
}

// ─── Format detection ─────────────────────────────────────────────────────────

type AuditFormat =
  | 'sf_crawl'    // Screaming Frog full crawl
  | 'sf_issues'   // Screaming Frog Issues tab
  | 'ahrefs'      // Ahrefs URL-level issue list
  | 'ahrefs_agg'  // Ahrefs aggregate (issue + count, no per-page URLs)
  | 'semrush'     // Semrush Site Audit
  | 'gsc'         // Google Search Console
  | 'moz'         // Moz
  | 'sitebulb'    // Sitebulb
  | 'generic'     // fallback

function detectFormat(headers: string[]): AuditFormat {
  const lower  = headers.map(h => h.toLowerCase().trim())
  const lset   = new Set(lower)
  const has    = (s: string) => lower.some(h => h.includes(s))
  const hasAll = (...s: string[]) => s.every(x => lower.some(h => h.includes(x)))

  // Screaming Frog full crawl (has "Address" + "Status Code")
  if (lset.has('address') && has('status code')) return 'sf_crawl'

  // Screaming Frog Issues tab export (has "Address" + some issue column)
  if (lset.has('address') && (has('issue') || lset.has('priority'))) return 'sf_issues'

  // Ahrefs aggregate (Issue + Pages + Impact — no URL column)
  if ((lset.has('issue') || lset.has('issues')) && lset.has('pages') && lset.has('impact')) return 'ahrefs_agg'

  // Ahrefs URL-level: has "How to fix" OR has an "impact" + url-ish column
  if (has('how to fix') || has('ahrefs')) return 'ahrefs'
  if (lset.has('impact') && (lset.has('url') || lset.has('page'))) return 'ahrefs'

  // Semrush: "Type of Issue" or "Page URL" + issue combination
  if (has('type of issue') || (lset.has('page url') && has('issue'))) return 'semrush'

  // Google Search Console
  if (has('submitted sitemap') || has('coverage status') || (lset.has('url') && has('coverage'))) return 'gsc'

  // Moz
  if (has('page authority') || has('domain authority') || has('moz')) return 'moz'

  // Sitebulb
  if (has('hint') || has('sitebulb')) return 'sitebulb'

  return 'generic'
}

// ─── Smart heuristic column finder ────────────────────────────────────────────

const URL_CANDIDATES = [
  'url', 'page url', 'page', 'address', 'href', 'link', 'source url', 'source',
  'landing page', 'from url', 'canonical url', 'crawled url', 'request url',
  'full url', 'webpage', 'target url',
]
const ISSUE_CANDIDATES = [
  'issue', 'issue type', 'issue name', 'type of issue', 'problem', 'error type',
  'warning type', 'check', 'finding', 'insight', 'alert',
  'ahrefs checks', 'notice type', 'opportunity',
]
const SEVERITY_CANDIDATES = [
  'severity', 'priority', 'level', 'importance', 'impact', 'criticality', 'urgency',
]
const DESC_CANDIDATES = [
  'description', 'details', 'detail', 'how to fix', 'what to fix', 'fix',
  'recommendation', 'suggested fix', 'resolution', 'action', 'explanation', 'info', 'note', 'message',
]

/** Multi-pass header search: exact → word-boundary → substring */
function findBestHeader(headers: string[], candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const c of candidates) {
    const i = lower.indexOf(c)
    if (i !== -1) return headers[i]
  }
  for (const c of candidates) {
    const i = lower.findIndex(h => h.startsWith(c) || h.endsWith(c))
    if (i !== -1) return headers[i]
  }
  for (const c of candidates) {
    const i = lower.findIndex(h => h.includes(c))
    if (i !== -1) return headers[i]
  }
  return null
}

/** Last-resort URL detection: scan cell values for http:// patterns */
function findUrlColByValues(headers: string[], rows: Record<string, string>[]): string | null {
  const HTTP = /^https?:\/\//i
  for (const h of headers) {
    const vals = rows.slice(0, 30).map(r => (r[h] ?? '').trim())
    const hits  = vals.filter(v => HTTP.test(v)).length
    if (hits >= Math.min(3, Math.ceil(vals.length * 0.4))) return h
  }
  return null
}

function buildHeuristicMapping(headers: string[], rows: Record<string, string>[]): ColumnMapping {
  return {
    urlCol:      findBestHeader(headers, URL_CANDIDATES) ?? findUrlColByValues(headers, rows),
    issueCol:    findBestHeader(headers, ISSUE_CANDIDATES),
    severityCol: findBestHeader(headers, SEVERITY_CANDIDATES),
    descCol:     findBestHeader(headers, DESC_CANDIDATES),
    sourceTool:  null,
  }
}

// ─── Issue builder helper ─────────────────────────────────────────────────────

function buildIssue(
  url: string | null,
  issueType: string,
  severity: Severity,
  description: string | null,
  sourceTool: string | null,
  overrides?: Partial<ParsedIssue>,
): ParsedIssue {
  const { owner, reason, needsReview } = assignOwner(issueType)
  return {
    url,
    title:             url
      ? `${issueType}: ${url.replace(/^https?:\/\/[^/]+/, '') || '/'}`
      : issueType,
    description,
    issue_type:        issueType,
    category:          inferCategory(issueType),
    severity,
    priority:          severity as Priority,
    impact:            'medium' as Impact,
    effort:            'medium' as const,
    confidence:        (needsReview ? 'low' : 'medium') as Confidence,
    owner,
    source_tool:       sourceTool,
    assignment_reason: reason,
    needs_review:      needsReview,
    affected_count:    1,
    affected_urls:     url ? [url] : [],
    recommended_fix:   null,
    tags:              [],
    ...overrides,
  }
}

// ─── Screaming Frog: full crawl ───────────────────────────────────────────────

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
      issues.push(buildIssue(url, issueType, code >= 500 ? 'critical' : 'high',
        `HTTP ${code} response detected. This URL needs to be fixed or redirected.`,
        'Screaming Frog',
        { priority: code >= 500 ? 'critical' : 'high', impact: 'high', confidence: 'high', needs_review: false,
          recommended_fix: 'Set up a 301 redirect to the correct URL, or restore the page if it should exist.' }
      ))
    }
    if (!title && code < 400) {
      issues.push(buildIssue(url, 'Missing Title Tag', 'high',
        'The page has no title tag. Add a unique, descriptive title.', 'Screaming Frog',
        { impact: 'high', confidence: 'high', effort: 'low', needs_review: false,
          recommended_fix: 'Add a unique, descriptive <title> tag (50–60 characters) to the page.' }
      ))
    }
    if (!meta && code < 400) {
      issues.push(buildIssue(url, 'Missing Meta Description', 'medium',
        'The page has no meta description. Add one to improve CTR.', 'Screaming Frog',
        { confidence: 'high', effort: 'low', needs_review: false,
          recommended_fix: 'Write a compelling meta description (120–155 characters) summarising the page content.' }
      ))
    }
    if (!h1 && code < 400) {
      issues.push(buildIssue(url, 'Missing H1', 'medium',
        'The page is missing an H1 heading.', 'Screaming Frog',
        { confidence: 'high', effort: 'low', needs_review: false,
          recommended_fix: 'Add a single H1 tag that clearly describes the primary topic of the page.' }
      ))
    }
    if (words > 0 && words < 300 && code < 400) {
      issues.push(buildIssue(url, 'Thin Content', 'low',
        `Page has only ${words} words. Consider expanding or consolidating.`, 'Screaming Frog',
        { priority: 'low', impact: 'medium', effort: 'high', confidence: 'medium', needs_review: false,
          recommended_fix: 'Expand the content to at least 300 words, or consolidate with a related page via a 301 redirect.' }
      ))
    }
  }

  return issues
}

// ─── Screaming Frog: Issues tab export ───────────────────────────────────────

function parseScreamingFrogIssues(rows: Record<string, string>[]): ParsedIssue[] {
  // SF Issues tab may have: Address | Issue | Priority | Description
  // or: URL | Issue Name | Priority | Detail
  const headers   = Object.keys(rows[0] ?? {})
  const urlCol    = findBestHeader(headers, ['address', ...URL_CANDIDATES]) ?? findUrlColByValues(headers, rows)
  const issueCol  = findBestHeader(headers, ['issue name', 'issue', ...ISSUE_CANDIDATES])
  const sevCol    = findBestHeader(headers, SEVERITY_CANDIDATES)
  const descCol   = findBestHeader(headers, DESC_CANDIDATES)

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url       = urlCol   ? (row[urlCol]?.trim()   || null) : null
      const issueType = issueCol ? (row[issueCol]?.trim() || 'Unknown Issue') : 'Unknown Issue'
      const severity  = normalizeSeverity(sevCol ? row[sevCol]?.trim() : undefined)
      const desc      = descCol  ? (row[descCol]?.trim()  || null) : null
      return buildIssue(url, issueType, severity, desc, 'Screaming Frog')
    })
}

// ─── Ahrefs: URL-level issue export ──────────────────────────────────────────

function parseAhrefsIssues(rows: Record<string, string>[]): ParsedIssue[] {
  const headers    = Object.keys(rows[0] ?? {})
  // Ahrefs typically: URL | (issue from filename) | Impact | How to fix
  const urlCol     = findBestHeader(headers, URL_CANDIDATES) ?? findUrlColByValues(headers, rows)
  // Ahrefs URL-level exports may not have an explicit issue column — issue = file/section name
  const issueCol   = findBestHeader(headers, ['issue name', 'issue', 'ahrefs checks', 'type', 'check', ...ISSUE_CANDIDATES])
  const sevCol     = findBestHeader(headers, ['impact', ...SEVERITY_CANDIDATES])
  const descCol    = findBestHeader(headers, ['how to fix', 'recommendation', ...DESC_CANDIDATES])

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url       = urlCol   ? (row[urlCol]?.trim()   || null) : null
      const issueType = issueCol ? (row[issueCol]?.trim() || 'Unknown Issue') : 'Unknown Issue'
      const severity  = normalizeSeverity(sevCol ? row[sevCol]?.trim() : undefined)
      const desc      = descCol  ? (row[descCol]?.trim()  || null) : null
      return buildIssue(url, issueType, severity, desc, 'Ahrefs')
    })
}

// ─── Ahrefs: aggregate issue list (Issue + Pages count) ──────────────────────
// These exports have one row per issue TYPE with a page count, not individual URLs.

function parseAhrefsAggregate(rows: Record<string, string>[]): ParsedIssue[] {
  const headers  = Object.keys(rows[0] ?? {})
  const issueCol = findBestHeader(headers, ['issue', 'issues', ...ISSUE_CANDIDATES])
  const sevCol   = findBestHeader(headers, ['impact', ...SEVERITY_CANDIDATES])
  const countCol = findBestHeader(headers, ['pages', 'count', 'urls', 'affected pages'])
  const descCol  = findBestHeader(headers, DESC_CANDIDATES)

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const issueType     = issueCol ? (row[issueCol]?.trim() || 'Unknown Issue') : 'Unknown Issue'
      const severity      = normalizeSeverity(sevCol ? row[sevCol]?.trim() : undefined)
      const affectedCount = parseInt(countCol ? row[countCol] ?? '1' : '1', 10) || 1
      const desc          = descCol ? (row[descCol]?.trim() || null) : null
      const { owner, reason, needsReview } = assignOwner(issueType)
      return {
        url:               null,
        title:             affectedCount > 1
          ? `${issueType} — ${affectedCount} pages affected`
          : issueType,
        description:       desc,
        issue_type:        issueType,
        category:          inferCategory(issueType),
        severity,
        priority:          severity as Priority,
        impact:            'medium' as Impact,
        effort:            'medium' as const,
        confidence:        (needsReview ? 'low' : 'medium') as Confidence,
        owner,
        source_tool:       'Ahrefs',
        assignment_reason: reason,
        needs_review:      needsReview,
        affected_count:    affectedCount,
        affected_urls:     [],
        recommended_fix:   null,
        tags:              [],
      }
    })
}

// ─── Semrush: Site Audit export ───────────────────────────────────────────────

function parseSemrushAudit(rows: Record<string, string>[]): ParsedIssue[] {
  const headers  = Object.keys(rows[0] ?? {})
  // Semrush: "Page URL" | "Type of Issue" | "Issue description" | "Category"
  const urlCol   = findBestHeader(headers, ['page url', 'url', ...URL_CANDIDATES]) ?? findUrlColByValues(headers, rows)
  const issueCol = findBestHeader(headers, ['type of issue', 'issue type', 'issue', ...ISSUE_CANDIDATES])
  const descCol  = findBestHeader(headers, ['issue description', 'description', 'how to fix', ...DESC_CANDIDATES])
  // Semrush doesn't usually have a severity column — derive from file section (Errors/Warnings/Notices)
  const sevCol   = findBestHeader(headers, SEVERITY_CANDIDATES)

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url       = urlCol   ? (row[urlCol]?.trim()   || null) : null
      const issueType = issueCol ? (row[issueCol]?.trim() || 'Unknown Issue') : 'Unknown Issue'
      const desc      = descCol  ? (row[descCol]?.trim()  || null) : null
      // Semrush: errors=high, warnings=medium, notices/info=low
      let severity: Severity = 'medium'
      if (sevCol) {
        severity = normalizeSeverity(row[sevCol]?.trim())
      } else {
        const combined = (issueType + ' ' + (desc ?? '')).toLowerCase()
        if (combined.includes('error') || combined.includes('broken')) severity = 'high'
        else if (combined.includes('warning')) severity = 'medium'
        else if (combined.includes('notice') || combined.includes('info')) severity = 'low'
      }
      return buildIssue(url, issueType, severity, desc, 'Semrush')
    })
}

// ─── Google Search Console: Coverage report ───────────────────────────────────

function parseGSC(rows: Record<string, string>[]): ParsedIssue[] {
  const headers  = Object.keys(rows[0] ?? {})
  const urlCol   = findBestHeader(headers, ['url', ...URL_CANDIDATES]) ?? findUrlColByValues(headers, rows)
  // GSC Coverage: Status = "Error", "Excluded", "Valid with warning", "Valid"
  const statusCol = findBestHeader(headers, ['status', 'coverage status', 'coverage'])
  const descCol   = findBestHeader(headers, ['reason', ...DESC_CANDIDATES])

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url    = urlCol    ? (row[urlCol]?.trim()    || null) : null
      const status = statusCol ? (row[statusCol]?.trim() || '')   : ''
      const desc   = descCol   ? (row[descCol]?.trim()   || null) : null

      // Map GSC statuses to SEO issue types
      let issueType = status || 'Unknown Issue'
      let severity: Severity = 'medium'
      const s = status.toLowerCase()
      if (s === 'error' || s.includes('error'))          { issueType = `GSC Error: ${status}`; severity = 'critical' }
      else if (s.includes('excluded'))                    { issueType = `Excluded from Index: ${status}`; severity = 'medium' }
      else if (s.includes('valid with warning'))          { issueType = `Index Warning: ${status}`; severity = 'medium' }
      else if (s === 'valid' || s.includes('indexed'))    return null  // valid pages are not issues

      return buildIssue(url, issueType, severity, desc, 'Google Search Console')
    })
    .filter((i): i is ParsedIssue => i !== null)
}

// ─── Generic: any other format, with heuristic + AI column mapping ────────────

function parseWithMapping(rows: Record<string, string>[], mapping: ColumnMapping): ParsedIssue[] {
  const { urlCol, issueCol, severityCol, descCol, sourceTool } = mapping

  return rows
    .filter(row => Object.values(row).some(v => v?.toString().trim()))
    .map(row => {
      const url       = urlCol      ? (row[urlCol]?.trim()      || null) : null
      const issueType = issueCol    ? (row[issueCol]?.trim()    || 'Unknown Issue') : 'Unknown Issue'
      const rawSev    = severityCol ? row[severityCol]?.trim()  : undefined
      const desc      = descCol     ? (row[descCol]?.trim()     || null) : null
      const severity  = normalizeSeverity(rawSev)
      return buildIssue(url, issueType, severity, desc, sourceTool ?? null)
    })
}

// ─── Severity ranking ─────────────────────────────────────────────────────────

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

// ─── Deduplication ────────────────────────────────────────────────────────────
//
// Groups by issue_type → one ticket per distinct issue.
// Collects ALL affected URLs (from both `url` and `affected_urls`).

export function dedupeIssues(issues: ParsedIssue[]): ParsedIssue[] {
  const groups = new Map<string, ParsedIssue[]>()

  for (const issue of issues) {
    const key = issue.issue_type.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(issue)
  }

  const deduped: ParsedIssue[] = []

  for (const group of Array.from(groups.values())) {
    const count   = group.length
    const first   = group[0]

    // Collect URLs from BOTH the url field and any pre-populated affected_urls
    const rawUrls = group.flatMap((i: ParsedIssue) => {
      return i.affected_urls.length > 0 ? i.affected_urls : (i.url ? [i.url] : [])
    })
    const uniqueUrls = Array.from(new Set(rawUrls.filter((u: string) => u.trim())))

    const topSeverity = group.reduce(
      (best: ParsedIssue, i: ParsedIssue) => (SEV_RANK[i.severity] ?? 0) > (SEV_RANK[best.severity] ?? 0) ? i : best,
      first
    ).severity

    const title = count === 1
      ? first.title
      : `${first.issue_type} — ${count} pages affected`

    const urlList = uniqueUrls.length === 0 ? '' :
      uniqueUrls.length <= 20
        ? `\n\nAffected URLs:\n${uniqueUrls.map(u => `• ${u}`).join('\n')}`
        : `\n\nAffected URLs (first 20 of ${uniqueUrls.length}):\n` +
          uniqueUrls.slice(0, 20).map(u => `• ${u}`).join('\n') +
          `\n…and ${uniqueUrls.length - 20} more`

    const description = ((first.description ?? '') + urlList) || null

    deduped.push({
      ...first,
      title,
      description,
      severity:       topSeverity,
      url:            uniqueUrls[0] ?? null,
      affected_count: Math.max(count, first.affected_count),
      affected_urls:  uniqueUrls,
    })
  }

  return deduped.sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse an audit file buffer into raw ParsedIssue objects (one per CSV row).
 * Async so it can call Claude for column-mapping when heuristics are uncertain.
 */
export async function parseAuditFile(buffer: Buffer, ext: string): Promise<ParsedIssue[]> {
  // 1 — parse bytes → row objects
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
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  if (rows.length === 0) return []

  const headers = Object.keys(rows[0])
  const format  = detectFormat(headers)

  console.info(`[parse] Detected format: ${format} (${rows.length} rows, headers: ${headers.join(', ')})`)

  // 2 — route to format-specific parser
  switch (format) {
    case 'sf_crawl':   return parseScreamingFrogCrawl(rows)
    case 'sf_issues':  return parseScreamingFrogIssues(rows)
    case 'ahrefs':     return parseAhrefsIssues(rows)
    case 'ahrefs_agg': return parseAhrefsAggregate(rows)
    case 'semrush':    return parseSemrushAudit(rows)
    case 'gsc':        return parseGSC(rows)
  }

  // 3 — generic: try heuristic column mapping
  const heuristic = buildHeuristicMapping(headers, rows)

  // 4 — if issue column is still missing, fall back to Claude
  let mapping = heuristic
  if (!heuristic.issueCol) {
    console.info('[parse] Issue column not found via heuristics — asking Claude…')
    const ai = await detectAuditColumns(headers, rows.slice(0, 5))
    if (ai) {
      mapping = {
        urlCol:      ai.urlCol      ?? heuristic.urlCol,
        issueCol:    ai.issueCol    ?? heuristic.issueCol,
        severityCol: ai.severityCol ?? heuristic.severityCol,
        descCol:     ai.descCol     ?? heuristic.descCol,
        sourceTool:  ai.sourceTool  ?? null,
      }
      console.info('[parse] AI column mapping:', mapping)
    }
  }

  return parseWithMapping(rows, mapping)
}
