import postgres from 'postgres'

// Vercel Postgres (Marketplace) injects POSTGRES_URL* vars automatically.
// External databases (Neon, Supabase, etc.) use DATABASE_URL.
// We fall back to a local placeholder so this module loads cleanly at build
// time — postgres.js is lazy and won't actually connect until the first query.
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  'postgres://localhost/not_configured'

const sql = postgres(connectionString, {
  ssl: connectionString === 'postgres://localhost/not_configured' ? false : 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export default sql

/** Safely parse a JSONB value that may come back as a string or already-parsed array. */
export function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as string[] } catch { /* fall through */ }
  }
  return []
}

/**
 * Initialise the schema and apply all column additions idempotently.
 * Hit GET /api/db-setup to trigger this after deployment.
 * Pass ?seed=true to also load sample data.
 *
 * Uses inline SQL — no file-system access — so it works reliably in
 * Next.js serverless API routes.
 */
export async function initDb(seed = false) {

  // ── Base tables ───────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS audit_uploads (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      filename    TEXT        NOT NULL,
      blob_url    TEXT        NOT NULL,
      row_count   INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id   UUID        REFERENCES audit_uploads(id) ON DELETE SET NULL,
      title       TEXT        NOT NULL,
      description TEXT,
      url         TEXT,
      issue_type  TEXT        NOT NULL DEFAULT 'Unknown Issue',
      severity    TEXT        NOT NULL DEFAULT 'medium',
      owner       TEXT        NOT NULL DEFAULT 'site_content_lead',
      status      TEXT        NOT NULL DEFAULT 'needs_review',
      notes       TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // ── New columns (idempotent — safe to run repeatedly) ────────

  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignment_reason  TEXT`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS needs_review       BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_tool        TEXT`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS affected_count     INTEGER NOT NULL DEFAULT 1`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS affected_urls      JSONB NOT NULL DEFAULT '[]'`

  // ── Rich data model columns (wave 2) ──────────────────────────
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category          TEXT`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority          TEXT NOT NULL DEFAULT 'medium'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS impact            TEXT NOT NULL DEFAULT 'medium'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS effort            TEXT NOT NULL DEFAULT 'medium'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS confidence        TEXT NOT NULL DEFAULT 'medium'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS review_status     TEXT NOT NULL DEFAULT 'needs_review'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'not_validated'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recommended_fix   TEXT`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS example_urls      JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_date          TIMESTAMPTZ`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags              JSONB NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ DEFAULT NOW()`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_detected_at  TIMESTAMPTZ`
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source_audit_id   UUID REFERENCES audit_uploads(id) ON DELETE SET NULL`

  // ── Ticket comments ──────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id   UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author      TEXT        NOT NULL,
      content     TEXT        NOT NULL,
      mentions    JSONB       NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id)`

  // ── Team members ─────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name         TEXT        NOT NULL,
      email        TEXT        NOT NULL UNIQUE,
      owner_bucket TEXT        NOT NULL CHECK (owner_bucket IN ('tech','site_content_lead','copy_blog_lead')),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // ── Indexes ───────────────────────────────────────────────────

  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_status       ON tickets(status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_owner        ON tickets(owner)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_severity     ON tickets(severity)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_source_tool  ON tickets(source_tool)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_needs_review ON tickets(needs_review) WHERE needs_review = true`

  // ── Optional seed data ────────────────────────────────────────

  if (seed) {
    await seedData()
  }
}

async function seedData() {
  // Only seed if the table is empty so re-running is safe
  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM tickets`
  if (parseInt(count, 10) > 0) return

  const [upload] = await sql<{ id: string }[]>`
    INSERT INTO audit_uploads (filename, blob_url, row_count)
    VALUES ('sample_audit.csv', 'https://example.com/sample_audit.csv', 5)
    RETURNING id
  `

  const samples = [
    {
      title: 'Missing meta description on /products',
      description: 'The /products page has no meta description. This reduces CTR from search results.',
      issue_type: 'Missing Meta Description',
      severity: 'high',
      owner: 'site_content_lead',
      source_tool: 'Screaming Frog',
      url: 'https://www.example.com/products',
      assignment_reason: 'Assigned to Site Content Lead — issue type contains "meta description" (page metadata).',
      needs_review: false,
    },
    {
      title: '404 Error: /old-page',
      description: 'HTTP 404 response detected. This URL needs to be fixed or redirected.',
      issue_type: '4xx Client Error',
      severity: 'high',
      owner: 'tech',
      source_tool: 'Screaming Frog',
      url: 'https://www.example.com/old-page',
      assignment_reason: 'Assigned to Tech — issue type contains "4xx" (status codes).',
      needs_review: false,
    },
    {
      title: 'Blog category pages have thin content',
      description: 'All /category/* pages contain fewer than 150 words.',
      issue_type: 'Thin Content',
      severity: 'medium',
      owner: 'copy_blog_lead',
      source_tool: null,
      url: 'https://blog.example.com/category/',
      assignment_reason: 'Assigned to Copy / Blog Lead — issue type contains "blog".',
      needs_review: false,
    },
    {
      title: 'Missing canonical tag on /shop',
      description: 'No canonical tag found. Could cause duplicate-content issues.',
      issue_type: 'Missing Canonical',
      severity: 'medium',
      owner: 'tech',
      source_tool: 'Screaming Frog',
      url: 'https://www.example.com/shop',
      assignment_reason: 'Assigned to Tech — issue type contains "canonical".',
      needs_review: false,
    },
    {
      title: 'Unclear issue: seasonal landing page copy',
      description: 'Seasonal landing page may need both new copy and technical redirect from last year\'s URL.',
      issue_type: 'Seasonal Campaign Page',
      severity: 'low',
      owner: 'copy_blog_lead',
      source_tool: null,
      url: 'https://www.example.com/sale-2023',
      assignment_reason: 'Ambiguous — matched multiple buckets. Please confirm the correct owner.',
      needs_review: true,
    },
  ]

  for (const s of samples) {
    await sql`
      INSERT INTO tickets
        (upload_id, title, description, url, issue_type, severity, owner,
         source_tool, assignment_reason, needs_review, status)
      VALUES
        (${upload.id}, ${s.title}, ${s.description}, ${s.url ?? null},
         ${s.issue_type}, ${s.severity}, ${s.owner},
         ${s.source_tool ?? null}, ${s.assignment_reason}, ${s.needs_review},
         'needs_review')
    `
  }
}
