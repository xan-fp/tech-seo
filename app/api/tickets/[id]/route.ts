import { NextRequest, NextResponse } from 'next/server'
import sql, { parseJsonArray } from '@/lib/db'
import { sendApprovalEmail, sendStatusUpdateEmail } from '@/lib/email'
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

  const allowed = [
    'title', 'description', 'url', 'issue_type', 'category',
    'severity', 'priority', 'impact', 'effort', 'confidence',
    'owner', 'status', 'review_status', 'validation_status',
    'notes', 'recommended_fix', 'due_date', 'needs_review',
  ]
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

  // Normalize JSONB columns
  const t = ticket as unknown as Record<string, unknown>
  ticket.affected_urls = parseJsonArray(t.affected_urls)
  ticket.example_urls  = parseJsonArray(t.example_urls)
  ticket.tags          = parseJsonArray(t.tags)

  // Fire emails on status change
  if (updates.status && updates.status !== before.status) {
    try {
      const recipients = await sql<TeamMember[]>`
        SELECT id, name, email, owner_bucket, created_at
        FROM team_members WHERE owner_bucket = ${ticket.owner}
      `
      if (updates.status === 'approved') {
        await sendApprovalEmail(ticket, recipients)
      } else {
        await sendStatusUpdateEmail(ticket, updates.status as string, recipients)
      }
    } catch (err) {
      console.error('Status email failed:', err)
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
