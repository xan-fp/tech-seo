import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db-reset
 * Deletes all tickets and uploads. Tables stay — just the data is cleared.
 */
export async function GET() {
  try {
    await sql`TRUNCATE TABLE tickets, audit_uploads RESTART IDENTITY CASCADE`
    return NextResponse.json({ ok: true, message: 'All tickets and uploads deleted. Fresh start!' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
