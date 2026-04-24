import { NextRequest, NextResponse } from 'next/server'
import sql, { parseJsonArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tickets
 * Query params: status, owner, severity (all optional, comma-separated for multiple)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status      = searchParams.get('status')
  const owner       = searchParams.get('owner')
  const severity    = searchParams.get('severity')
  const source_tool = searchParams.get('source_tool')

  // Build dynamic WHERE clauses
  // postgres.js supports conditional fragments via sql``
  const conditions = []
  if (status)      conditions.push(sql`status      = ANY(${status.split(',')})`)
  if (owner)       conditions.push(sql`owner       = ANY(${owner.split(',')})`)
  if (severity)    conditions.push(sql`severity    = ANY(${severity.split(',')})`)
  if (source_tool) conditions.push(sql`source_tool = ANY(${source_tool.split(',')})`)

  const where =
    conditions.length > 0
      ? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
      : sql``

  try {
    const tickets = await sql`
      SELECT * FROM tickets
      ${where}
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          WHEN 'medium'   THEN 3
          WHEN 'low'      THEN 4
        END,
        created_at DESC
    `
    // Normalize affected_urls — may be stored as a JSON string in older rows
    const normalized = tickets.map(t => ({
      ...t,
      affected_urls: parseJsonArray(t.affected_urls),
    }))
    return NextResponse.json(normalized)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
