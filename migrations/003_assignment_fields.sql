-- ============================================================
-- Migration 003 — Add assignment_reason and needs_review to tickets
-- ============================================================

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS assignment_reason TEXT,
  ADD COLUMN IF NOT EXISTS needs_review      BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tickets_needs_review ON tickets(needs_review) WHERE needs_review = true;
