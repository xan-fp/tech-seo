import { NextRequest, NextResponse } from 'next/server'
import sql, { parseJsonArray } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import type { TeamMember, Ticket } from '@/lib/types'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * PATCH /api/tickets/:id
 * Accepts any subset of: title, description, url, issue_type, severity, owner, status, notes, needs_review
 * When status changes to 'approved', fires an email to the owner bucket's team members.
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

  // Snapshot status before update so we know if approval is new
  const [before] = await sql<{ status: string }[]>`
    SELECT status FROM tickets WHERE id = ${id}
  `
  if (!before) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 })

  // Build SET clause dynamically
  const setClauses = Object.entries(updates).map(
    ([col, val]) => sql`${sql(col)} = ${val as string}`
  )
  const setFragment = setClauses.reduce((a, b) => sql`${a}, ${b}`)

  const [ticket] = await sql<Ticket[]>`
    UPDATE tickets
    SET ${setFragment}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 })
  }

  ticket.affected_urls = parseJsonArray(ticket.affected_urls)

  // Fire approval email when transitioning draft → approved
  if (updates.status === 'approved' && before.status !== 'approved') {
    try {
      const recipients = await sql<TeamMember[]>`
        SELECT id, name, email, owner_bucket, created_at
        FROM team_members
        WHERE owner_bucket = ${ticket.owner}
      `
      await sendApprovalEmail(ticket, recipients)
    } catch (err) {
      // Email failure must never break the ticket update response
      console.error('Approval email failed:', err)
    }
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
