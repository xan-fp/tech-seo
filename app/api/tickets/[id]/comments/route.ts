import { NextRequest, NextResponse } from 'next/server'
import sql, { parseJsonArray } from '@/lib/db'
import { sendCommentNotification } from '@/lib/email'
import type { TeamMember, Ticket, TicketComment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const comments = await sql<TicketComment[]>`
      SELECT id, ticket_id, author, content, mentions, created_at
      FROM ticket_comments
      WHERE ticket_id = ${params.id}
      ORDER BY created_at ASC
    `
    return NextResponse.json(
      comments.map(c => ({ ...c, mentions: parseJsonArray(c.mentions) }))
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { author, content, mentions = [] } = await req.json() as {
      author?: string
      content?: string
      mentions?: string[]
    }

    if (!author?.trim()) return NextResponse.json({ error: 'Author required' }, { status: 400 })
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })

    const [comment] = await sql<TicketComment[]>`
      INSERT INTO ticket_comments (ticket_id, author, content, mentions)
      VALUES (${params.id}, ${author.trim()}, ${content.trim()}, ${sql.json(mentions)})
      RETURNING id, ticket_id, author, content, mentions, created_at
    `

    // Send mention notifications (fire-and-forget)
    if (mentions.length > 0) {
      try {
        const [ticket] = await sql<Ticket[]>`SELECT * FROM tickets WHERE id = ${params.id}`
        const recipients = await sql<TeamMember[]>`
          SELECT id, name, email, owner_bucket, created_at
          FROM team_members WHERE id = ANY(${mentions})
        `
        if (ticket && recipients.length > 0) {
          ticket.affected_urls = parseJsonArray(ticket.affected_urls)
          await sendCommentNotification(ticket, { ...comment, mentions }, recipients)
        }
      } catch (err) {
        console.error('Comment notification failed:', err)
      }
    }

    return NextResponse.json({ ...comment, mentions: parseJsonArray(comment.mentions) }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
