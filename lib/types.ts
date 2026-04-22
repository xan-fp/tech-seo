// ── Enums (existing schema — underscore values) ───────────────

export type Severity     = 'critical' | 'high' | 'medium' | 'low'
export type Owner        = 'site_content_lead' | 'copy_blog_lead' | 'tech'
export type TicketStatus = 'draft' | 'approved' | 'in_progress' | 'done' | 'rejected'

// ── Enums (new schema) ────────────────────────────────────────

export type OwnerBucket  = 'site content lead' | 'copy/blog lead' | 'tech'
export type AuditStatus  = 'pending' | 'running' | 'complete' | 'failed'
export type UserRole     = 'admin' | 'editor' | 'viewer'
export type FileType     = 'csv' | 'xlsx' | 'json' | 'other'

// ── Assignment ────────────────────────────────────────────────

export interface AssignmentResult {
  owner: Owner
  reason: string
  needsReview: boolean
}

// ── Existing ticket entity (matches live tickets table) ───────

export interface Ticket {
  id:                string
  upload_id:         string | null
  title:             string
  description:       string | null
  url:               string | null
  issue_type:        string
  severity:          Severity
  owner:             Owner
  status:            TicketStatus
  notes:             string | null
  source_tool:       string | null
  assignment_reason: string | null
  needs_review:      boolean
  affected_count:    number
  created_at:        string
  updated_at:        string
}

// ── Parsed issue (output of parse-audit, input to upload route) ─

export interface ParsedIssue {
  url:               string | null   // first affected URL (or null)
  title:             string
  description:       string | null
  issue_type:        string
  severity:          Severity
  owner:             Owner
  source_tool:       string | null
  assignment_reason: string | null
  needs_review:      boolean
  affected_count:    number          // how many rows were grouped into this ticket
  affected_urls:     string[]        // all URLs from the group
}

// ── New entity types (new schema tables) ─────────────────────

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
