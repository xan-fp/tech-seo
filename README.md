# SEO Audit Ticketing

Internal tool for triaging SEO audit exports (Screaming Frog, Ahrefs, Semrush, etc.) into
owner-assigned tickets — reviewed, approved, and tracked by your SEO team.

---

## Features

- **Upload** CSV / XLSX audit exports → auto-parsed into draft tickets
- **Auto-assignment** — canonicals/redirects/crawling → Tech · metadata/linking → Site Content · blog copy → Copy/Blog
- **Review queue** — side-panel editing, bulk approve, per-ticket approve/reject
- **Backlog** — filter by owner, severity, status, source tool, needs-review flag
- **Evidence panel** — shows original audit finding alongside each ticket

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Postgres via `postgres.js` |
| File storage | Vercel Blob |
| Styling | Tailwind CSS |
| Hosting | Vercel |

---

## Local development

### 1 — Prerequisites

- Node.js 18+
- A Postgres database (Neon free tier works perfectly — [neon.tech](https://neon.tech))
- A Vercel account (for Blob storage token)

### 2 — Clone and install

```bash
git clone <your-repo-url>
cd tech-seo
npm install
```

### 3 — Environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in real values:

| Variable | Where to get it |
|---|---|
| `POSTGRES_URL` | Neon dashboard → your project → Connection string |
| `POSTGRES_URL_NON_POOLING` | Same as above (Neon provides both) |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → your Blob store → `.env.local` tab |

> **Shortcut if already deployed to Vercel:**
> ```bash
> npx vercel env pull .env.local
> ```
> This pulls all production env vars to a local `.env.local` file automatically.

### 4 — Run the dev server

```bash
npm run dev
```

### 5 — Initialise the database

Open in your browser (run once, safe to re-run):

```
http://localhost:3000/api/db-setup
```

Expected response:
```json
{ "ok": true, "message": "Database initialised successfully." }
```

To also load 5 sample tickets for testing:
```
http://localhost:3000/api/db-setup?seed=true
```

---

## Deploying to Vercel

### Step 1 — Push to GitHub

```bash
git init                        # if not already a git repo
git add .
git commit -m "Initial commit"
```

Create a new repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Import the project on Vercel

1. Go to **[vercel.com](https://vercel.com)** → click **Add New… → Project**
2. Click **Import** next to your GitHub repo
3. Leave all build settings as-is (Next.js is auto-detected)
4. **Do not deploy yet** — add storage first (Steps 3 & 4)

### Step 3 — Add Vercel Postgres

1. In your Vercel project dashboard, click the **Storage** tab
2. Click **Create Database**
3. Choose **Postgres** (powered by Neon)
4. Pick a name (e.g. `seo-tickets-db`), choose the region closest to you
5. Click **Create & Continue** → **Connect**

Vercel automatically adds these env vars to your project:
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

### Step 4 — Add Vercel Blob

1. Still in the **Storage** tab, click **Create Database** again
2. Choose **Blob**
3. Pick a name (e.g. `seo-audit-files`), click **Create**
4. Click **Connect to Project**

Vercel automatically adds:
- `BLOB_READ_WRITE_TOKEN`

### Step 5 — Deploy

1. Go to the **Deployments** tab
2. Click **Redeploy** (or just push a commit — Vercel will auto-deploy)
3. Wait ~60 seconds for the build to complete
4. Click **Visit** to open the live URL

### Step 6 — Initialise the production database

After the first deployment, visit this URL once (replace with your real domain):

```
https://your-project.vercel.app/api/db-setup
```

Expected response:
```json
{ "ok": true, "message": "Database initialised successfully." }
```

To seed 5 sample tickets:
```
https://your-project.vercel.app/api/db-setup?seed=true
```

You only need to run this **once**. It is idempotent — safe to re-run if needed.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | ✅ | Pooled Postgres connection string (set by Vercel Postgres) |
| `POSTGRES_URL_NON_POOLING` | ✅ | Direct Postgres connection string (set by Vercel Postgres) |
| `DATABASE_URL` | Fallback | Use this if connecting to Neon/Supabase directly instead of via Vercel Postgres |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob read/write token (set by Vercel Blob) |

The app resolves the database URL in this priority order:
`POSTGRES_URL_NON_POOLING` → `POSTGRES_URL` → `DATABASE_URL`

---

## Important notes

### File upload timeout (60 s)
The upload route allows up to 60 seconds for parsing large audit files.
This requires **Vercel Pro** plan or higher. On the Hobby (free) plan, functions
time out after 10 seconds — large files will fail mid-parse.

If you are on the Hobby plan, reduce `maxDuration` in `app/api/upload/route.ts`
to `10` and keep audit files under ~2 MB.

### Re-running db-setup
`/api/db-setup` is fully idempotent:
- Tables are created with `IF NOT EXISTS`
- Columns are added with `IF NOT EXISTS`
- Seed data only inserts when the tickets table is empty

### SSL
All database connections require SSL (`ssl: 'require'`). This matches Neon,
Vercel Postgres, Supabase, and most managed Postgres providers. If connecting
to a local Postgres without SSL, temporarily change `ssl: 'require'` to
`ssl: false` in `lib/db.ts`.

---

## Project structure

```
app/
├── api/
│   ├── db-setup/     # GET  — run schema migrations
│   ├── tickets/      # GET  — list tickets (filterable)
│   │   └── [id]/     # PATCH / DELETE — update or delete a ticket
│   ├── upload/       # POST — upload audit file → create draft tickets
│   └── stats/        # GET  — summary counts for dashboard
├── backlog/          # Approved ticket backlog with filters
├── review/           # Draft ticket review queue
└── upload/           # File upload UI

lib/
├── db.ts             # Postgres connection + initDb()
├── types.ts          # Shared TypeScript types
├── assign-owner.ts   # Keyword-based owner bucket assignment
└── parse-audit.ts    # CSV / XLSX parser (Screaming Frog + generic)

components/
├── nav.tsx
├── owner-label.tsx   # Coloured owner bucket badge + assignment reason
├── severity-badge.tsx
└── status-badge.tsx

migrations/           # Reference SQL (not used at runtime — schema is inline in db.ts)
```
