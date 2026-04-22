-- ============================================================
-- Migration 001 — Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'viewer'
                           CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── sites ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  domain       TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── audit_runs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_runs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  run_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── uploaded_files ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_files (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id   UUID        REFERENCES audit_runs(id) ON DELETE SET NULL,
  filename       TEXT        NOT NULL,
  blob_url       TEXT        NOT NULL,
  file_type      TEXT        CHECK (file_type IN ('csv', 'xlsx', 'json', 'other')),
  row_count      INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── raw_findings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_findings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_file_id UUID        NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  audit_run_id     UUID        REFERENCES audit_runs(id) ON DELETE SET NULL,
  source_tool      TEXT,
  affected_url     TEXT,
  raw_data         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── tickets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id     UUID        REFERENCES audit_runs(id) ON DELETE SET NULL,
  raw_finding_id   UUID        REFERENCES raw_findings(id) ON DELETE SET NULL,
  title            TEXT        NOT NULL,
  description      TEXT,
  severity         TEXT        NOT NULL
                               CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  owner_bucket     TEXT        NOT NULL
                               CHECK (owner_bucket IN ('site content lead', 'copy/blog lead', 'tech')),
  assignee_name    TEXT,
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'approved', 'in_progress', 'done', 'rejected')),
  affected_url     TEXT,
  source_tool      TEXT,
  evidence         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ticket_history ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  field_name   TEXT        NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── auto-update updated_at on tickets ────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_set_updated_at ON tickets;
CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_runs_site_id     ON audit_runs(site_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_run_id  ON uploaded_files(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_raw_findings_file_id   ON raw_findings(uploaded_file_id);
CREATE INDEX IF NOT EXISTS idx_raw_findings_run_id    ON raw_findings(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_tickets_run_id         ON tickets(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status         ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_bucket   ON tickets(owner_bucket);
CREATE INDEX IF NOT EXISTS idx_tickets_severity       ON tickets(severity);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket  ON ticket_history(ticket_id);
