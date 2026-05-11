// ─────────────────────────────────────────────────────────────────────────────
// Core enums
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Owner = 'site_content_lead' | 'copy_blog_lead' | 'tech'

// ── SEO categories ────────────────────────────────────────────────────────────

export type SeoCategory =
  | 'Indexation'
  | 'Crawlability'
  | 'Metadata'
  | 'Canonicals'
  | 'Redirects'
  | 'Internal Links'
  | 'Content Quality'
  | 'Duplicate Content'
  | 'Structured Data'
  | 'Page Speed'
  | 'Images'
  | 'Hreflang'
  | 'Sitemap'
  | 'Robots.txt'
  | 'Broken Links'
  | 'Thin Content'
  | 'URL Structure'
  | 'Backlinks'
  | 'Search Console'
  | 'Other'

export const SEO_CATEGORIES: SeoCategory[] = [
  'Indexation', 'Crawlability', 'Metadata', 'Canonicals', 'Redirects',
  'Internal Links', 'Content Quality', 'Duplicate Content', 'Structured Data',
  'Page Speed', 'Images', 'Hreflang', 'Sitemap', 'Robots.txt', 'Broken Links',
  'Thin Content', 'URL Structure', 'Backlinks', 'Search Console', 'Other',
]

// ── Priority / impact / effort / confidence ───────────────────────────────────

export type Priority   = 'critical' | 'high' | 'medium' | 'low'
export type Impact     = 'high' | 'medium' | 'low'
export type Effort     = 'high' | 'medium' | 'low'
export type Confidence = 'high' | 'medium' | 'low'

// ── Status enums ──────────────────────────────────────────────────────────────

/**
 * Lifecycle status of a ticket in the backlog.
 * Replaces the old TicketStatus and is stored in the `status` column.
 *
 * Review Queue shows: needs_review
 * Backlog shows:      approved → assigned → in_progress → fix_ready
 *                     → needs_validation → validated → done
 *                     (also: ignored, reopened)
 */
export type BacklogStatus =
  | 'needs_review'       // freshly imported, waiting for triage
  | 'approved'           // triaged and confirmed as real work
  | 'assigned'           // owner confirmed and work is queued
  | 'in_progress'        // actively being fixed
  | 'fix_ready'          // fix deployed, awaiting validation
  | 'needs_validation'   // requires a re-crawl / QA check
  | 'validated'          // confirmed fixed by re-crawl or manual check
  | 'done'               // closed — all work complete
  | 'ignored'            // won't fix / not applicable
  | 'reopened'           // was done/validated but issue re-appeared

/** @deprecated use BacklogStatus */
export type TicketStatus = 'draft' | 'approved' | 'in_progress' | 'done' | 'rejected'

/**
 * Outcome of the initial triage / review step.
 * Stored in `review_status`.
 */
export type ReviewStatus =
  | 'needs_review'    // default — not yet triaged
  | 'approved'        // confirmed valid, moved to backlog
  | 'duplicate'       // already tracked elsewhere
  | 'ignored'         // acknowledged but won't be actioned
  | 'snoozed'         // defer until a future date
  | 'needs_more_info' // blocked on additional context

/**
 * Whether a fix has been confirmed in production.
 * Stored in `validation_status`.
 */
export type ValidationStatus =
  | 'not_validated'   // default — no check done yet
  | 'pending_recrawl' // fix deployed, waiting for crawler
  | 'still_failing'   // re-crawl shows issue persists
  | 'partially_fixed' // some URLs fixed, others not
  | 'validated'       // fully confirmed as resolved
  | 'reopened'        // was validated but has regressed

// ─────────────────────────────────────────────────────────────────────────────
// Core ticket entity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An SEO Ticket represents one distinct issue category found in an audit.
 * Multiple raw CSV rows with the same issue type are merged into one ticket
 * (deduplicated), with all affected URLs collected in `affected_urls`.
 *
 * Column names use snake_case to match the Postgres schema directly.
 */
export interface Ticket {
  // ── Identity ────────────────────────────────────────────────────────────────
  id:               string
  /** Which CSV upload created this ticket */
  upload_id:        string | null
  /** Human-readable title, e.g. "Missing Meta Description — 47 pages affected" */
  title:            string
  /** Longer explanation; may include an affected-URL list at the end */
  description:      string | null

  // ── Classification ──────────────────────────────────────────────────────────
  /** Raw issue label from the CSV / AI classifier */
  issue_type:       string
  /** Structured SEO category (replaces/enriches issue_type) */
  category:         SeoCategory | null
  severity:         Severity
  priority:         Priority
  /** Estimated SEO value if fixed */
  impact:           Impact
  /** Estimated engineering / content effort */
  effort:           Effort
  /** How confident we are this is a real issue (high = definite) */
  confidence:       Confidence

  // ── Source ──────────────────────────────────────────────────────────────────
  source_tool:      string | null
  /** Alias for upload_id — which audit run produced this ticket */
  source_audit_id:  string | null

  // ── Affected URLs ────────────────────────────────────────────────────────────
  /** Legacy single URL — the primary affected page (kept for backwards compat) */
  url:                string | null
  /** Total pages affected (DB column: affected_count) */
  affected_count:     number
  /** @alias affected_count — preferred name going forward */
  affected_url_count?: number
  affected_urls:       string[]        // full list (stored as JSONB)
  /** A small representative sample shown in the UI (max 5) */
  example_urls:        string[]

  // ── Fix guidance ─────────────────────────────────────────────────────────────
  /** Plain-text or markdown fix instructions */
  recommended_fix:  string | null

  // ── Ownership ────────────────────────────────────────────────────────────────
  owner:            Owner
  /** Why this owner was assigned (keyword match or AI reasoning) */
  assignment_reason: string | null
  /** True while owner assignment needs a human to confirm */
  needs_review:     boolean

  // ── Status ────────────────────────────────────────────────────────────────────
  status:            BacklogStatus
  review_status:     ReviewStatus
  validation_status: ValidationStatus

  // ── Dates ─────────────────────────────────────────────────────────────────────
  first_detected_at: string
  last_detected_at:  string | null
  due_date:          string | null
  created_at:        string
  updated_at:        string

  // ── Metadata ──────────────────────────────────────────────────────────────────
  notes:  string | null
  tags:   string[]        // free-form labels, e.g. ["Q3", "sprint-12"]
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsed issue — output of the file parser, input to the upload route
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedIssue {
  url:               string | null
  title:             string
  description:       string | null
  issue_type:        string
  category:          SeoCategory | null
  severity:          Severity
  priority:          Priority
  impact:            Impact
  effort:            Effort
  confidence:        Confidence
  owner:             Owner
  source_tool:       string | null
  assignment_reason: string | null
  needs_review:      boolean
  affected_count:    number
  affected_urls:     string[]
  recommended_fix:   string | null
  tags:              string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment helper result
// ─────────────────────────────────────────────────────────────────────────────

export interface AssignmentResult {
  owner:       Owner
  reason:      string
  needsReview: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Team & collaboration
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketComment {
  id:         string
  ticket_id:  string
  author:     string
  content:    string
  mentions:   string[]   // team_member IDs
  created_at: string
}

export interface TeamMember {
  id:           string
  name:         string
  email:        string
  owner_bucket: Owner
  created_at:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc legacy / utility types
// ─────────────────────────────────────────────────────────────────────────────

export type OwnerBucket  = 'site content lead' | 'copy/blog lead' | 'tech'
export type AuditStatus  = 'pending' | 'running' | 'complete' | 'failed'
export type UserRole     = 'admin' | 'editor' | 'viewer'
export type FileType     = 'csv' | 'xlsx' | 'json' | 'other'

export interface User {
  id:         string
  email:      string
  name:       string
  role:       UserRole
  created_at: string
}

export interface Site {
  id:         string
  name:       string
  domain:     string
  created_at: string
}

export interface AuditRun {
  id:           string
  site_id:      string
  run_by:       string | null
  status:       AuditStatus
  started_at:   string | null
  completed_at: string | null
  created_at:   string
}

export interface UploadedFile {
  id:            string
  audit_run_id:  string | null
  filename:      string
  blob_url:      string
  file_type:     FileType | null
  row_count:     number | null
  created_at:    string
}

export interface RawFinding {
  id:               string
  uploaded_file_id: string
  audit_run_id:     string | null
  source_tool:      string | null
  affected_url:     string | null
  raw_data:         Record<string, unknown> | null
  created_at:       string
}

export interface TicketHistory {
  id:          string
  ticket_id:   string
  changed_by:  string | null
  field_name:  string
  old_value:   string | null
  new_value:   string | null
  changed_at:  string
}
