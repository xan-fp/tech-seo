import { NextResponse } from 'next/server'
import { initDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db-setup
 * Run once after deployment to create / migrate the database tables.
 * Pass ?seed=true to also insert sample tickets.
 */
export async function GET(request: Request) {
  // Quick env-var check so misconfiguration is obvious immediately
  const hasDb = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL
  if (!hasDb) {
    return NextResponse.json(
      { ok: false, error: 'No database URL found. Add Vercel Postgres via the Storage tab, then redeploy.' },
      { status: 500 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const seed = searchParams.get('seed') === 'true'
    await initDb(seed)
    return NextResponse.json({
      ok:      true,
      message: seed
        ? 'Database initialised and seed data loaded.'
        : 'Database initialised successfully.',
    })
  } catch (err: unknown) {
    // Serialize the error as fully as possible so the cause is always visible
    let message = 'Unknown error'
    if (err instanceof Error) {
      message = err.message || err.name || 'Error (no message)'
      // postgres.js errors carry extra fields (code, detail, hint)
      const pg = err as unknown as Record<string, unknown>
      if (pg.code)   message += ` — code: ${pg.code}`
      if (pg.detail) message += ` — detail: ${pg.detail}`
      if (pg.hint)   message += ` — hint: ${pg.hint}`
    } else {
      try { message = JSON.stringify(err) } catch { message = String(err) }
    }

    console.error('[db-setup] Error:', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
