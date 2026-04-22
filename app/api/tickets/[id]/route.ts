import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * PATCH /api/tickets/:id
 * Accepts any subset of: title, description, url, issue_type, severity, owner, status, notes
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = params
  const body = await request.json()

  const allowed = ['title', 'description', 'url', 'issue_type', 'severity', 'owner', 'status', 'notes', 'needs_review']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  }

  // Build SET clause dynamically
  const setClauses = Object.entries(updates).map(
    ([col, val]) => sql`${sql(col)} = ${val as string}`
  )
  const setFragment = setClauses.reduce((a, b) => sql`${a}, ${b}`)

  const [ticket] = await sql`
    UPDATE tickets
    SET ${setFragment}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 })
  }

  return NextResponse.json(ticket)
}

/**
 * DELETE /api/tickets/:id
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = params
  await sql`DELETE FROM tickets WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
