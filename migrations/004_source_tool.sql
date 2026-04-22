-- ============================================================
-- Migration 004 — Add source_tool to tickets
-- ============================================================

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS source_tool TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_source_tool ON tickets(source_tool);
