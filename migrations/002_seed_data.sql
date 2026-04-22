-- ============================================================
-- Migration 002 — Seed Sample Data
-- ============================================================

-- ── users ────────────────────────────────────────────────────
INSERT INTO users (id, email, name, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'admin@example.com',   'Alex Admin',   'admin'),
  ('11111111-0000-0000-0000-000000000002', 'editor@example.com',  'Sam Editor',   'editor'),
  ('11111111-0000-0000-0000-000000000003', 'viewer@example.com',  'Jordan Viewer','viewer')
ON CONFLICT (email) DO NOTHING;

-- ── sites ────────────────────────────────────────────────────
INSERT INTO sites (id, name, domain) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Main Marketing Site', 'www.example.com'),
  ('22222222-0000-0000-0000-000000000002', 'Blog',                'blog.example.com'),
  ('22222222-0000-0000-0000-000000000003', 'Help Centre',         'help.example.com')
ON CONFLICT (domain) DO NOTHING;

-- ── audit_runs ───────────────────────────────────────────────
INSERT INTO audit_runs (id, site_id, run_by, status, started_at, completed_at) VALUES
  (
    '33333333-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'complete',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '2 hours'
  ),
  (
    '33333333-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000002',
    'complete',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '1 hour'
  ),
  (
    '33333333-0000-0000-0000-000000000003',
    '22222222-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'pending',
    NULL,
    NULL
  );

-- ── uploaded_files ───────────────────────────────────────────
INSERT INTO uploaded_files (id, audit_run_id, filename, blob_url, file_type, row_count) VALUES
  (
    '44444444-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',
    'screaming_frog_export.csv',
    'https://blob.example.com/screaming_frog_export.csv',
    'csv',
    142
  ),
  (
    '44444444-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000002',
    'ahrefs_site_audit.xlsx',
    'https://blob.example.com/ahrefs_site_audit.xlsx',
    'xlsx',
    87
  );

-- ── raw_findings ─────────────────────────────────────────────
INSERT INTO raw_findings (id, uploaded_file_id, audit_run_id, source_tool, affected_url, raw_data) VALUES
  (
    '55555555-0000-0000-0000-000000000001',
    '44444444-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',
    'Screaming Frog',
    'https://www.example.com/products',
    '{"issue": "Missing meta description", "status_code": 200}'
  ),
  (
    '55555555-0000-0000-0000-000000000002',
    '44444444-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',
    'Screaming Frog',
    'https://www.example.com/about',
    '{"issue": "Duplicate title tag", "status_code": 200, "duplicate_of": "https://www.example.com/"}'
  ),
  (
    '55555555-0000-0000-0000-000000000003',
    '44444444-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000002',
    'Ahrefs',
    'https://blog.example.com/old-post',
    '{"issue": "Broken internal link", "linking_page": "https://blog.example.com/popular-post"}'
  ),
  (
    '55555555-0000-0000-0000-000000000004',
    '44444444-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',
    'Screaming Frog',
    'https://www.example.com/contact',
    '{"issue": "Page load time > 3s", "load_time_ms": 4200}'
  );

-- ── tickets ──────────────────────────────────────────────────
INSERT INTO tickets (
  id, audit_run_id, raw_finding_id,
  title, description, severity, owner_bucket, assignee_name,
  status, affected_url, source_tool, evidence
) VALUES
  (
    '66666666-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000001',
    'Missing meta description on /products',
    'The /products page has no meta description. This reduces click-through rate from search results.',
    'high',
    'site content lead',
    'Sam Editor',
    'approved',
    'https://www.example.com/products',
    'Screaming Frog',
    'Screaming Frog crawl on 2024-04-06 — "Meta Description" column is blank for this URL.'
  ),
  (
    '66666666-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000002',
    'Duplicate title tag: /about mirrors homepage',
    'The /about page shares its title tag with the homepage, causing keyword cannibalisation.',
    'medium',
    'copy/blog lead',
    NULL,
    'draft',
    'https://www.example.com/about',
    'Screaming Frog',
    'Title: "Example Co — Leading Widget Maker" appears on both https://www.example.com/ and https://www.example.com/about.'
  ),
  (
    '66666666-0000-0000-0000-000000000003',
    '33333333-0000-0000-0000-000000000002',
    '55555555-0000-0000-0000-000000000003',
    'Broken internal link on /blog/popular-post → /blog/old-post',
    'A widely-linked blog post references a URL that now returns 404, harming crawlability and UX.',
    'critical',
    'tech',
    'Alex Admin',
    'in_progress',
    'https://blog.example.com/old-post',
    'Ahrefs',
    'Ahrefs Site Audit reports 404 at https://blog.example.com/old-post linked from 12 internal pages.'
  ),
  (
    '66666666-0000-0000-0000-000000000004',
    '33333333-0000-0000-0000-000000000001',
    '55555555-0000-0000-0000-000000000004',
    'Slow page load on /contact (4.2 s)',
    'Contact page exceeds the 3 s Core Web Vitals threshold, risking a ranking penalty.',
    'high',
    'tech',
    NULL,
    'draft',
    'https://www.example.com/contact',
    'Screaming Frog',
    'Load time measured at 4,200 ms. Largest Contentful Paint element is an uncompressed hero image (1.8 MB).'
  ),
  (
    '66666666-0000-0000-0000-000000000005',
    '33333333-0000-0000-0000-000000000002',
    NULL,
    'Blog category pages have thin content',
    'All /category/* pages contain fewer than 150 words, which is below Google''s quality threshold.',
    'medium',
    'copy/blog lead',
    'Sam Editor',
    'approved',
    'https://blog.example.com/category/',
    'Manual Review',
    'Word counts: /category/seo → 92 words, /category/tips → 110 words, /category/news → 74 words.'
  );

-- ── ticket_history ───────────────────────────────────────────
INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value, changed_at) VALUES
  (
    '66666666-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'status',
    'draft',
    'approved',
    NOW() - INTERVAL '2 days'
  ),
  (
    '66666666-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'assignee_name',
    NULL,
    'Sam Editor',
    NOW() - INTERVAL '2 days'
  ),
  (
    '66666666-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000001',
    'status',
    'draft',
    'approved',
    NOW() - INTERVAL '18 hours'
  ),
  (
    '66666666-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000002',
    'status',
    'approved',
    'in_progress',
    NOW() - INTERVAL '12 hours'
  ),
  (
    '66666666-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000002',
    'assignee_name',
    NULL,
    'Alex Admin',
    NOW() - INTERVAL '12 hours'
  ),
  (
    '66666666-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000001',
    'status',
    'draft',
    'approved',
    NOW() - INTERVAL '6 hours'
  );
