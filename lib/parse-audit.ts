import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { assignOwner } from './assign-owner'
import type { ParsedIssue, Severity } from './types'

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
        severity:          code >= 500 ? 'critical' : 'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
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
        severity:          'high',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
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
        severity:          'medium',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
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
        severity:          'medium',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
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
        severity:          'low',
        owner,
        source_tool:       'Screaming Frog',
        assignment_reason: reason,
        needs_review:      needsReview,
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
        severity,
        owner,
        source_tool:       null,   // generic format — tool unknown
        assignment_reason: reason,
        needs_review:      needsReview,
      }
    })
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
