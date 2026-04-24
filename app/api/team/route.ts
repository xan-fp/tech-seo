import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { Owner } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_BUCKETS: Owner[] = ['tech', 'site_content_lead', 'copy_blog_lead']

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, email, owner_bucket, created_at
      FROM team_members
      ORDER BY owner_bucket, name
    `
    return NextResponse.json(rows)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, owner_bucket } = body as {
      name?: string; email?: string; owner_bucket?: Owner
    }

    if (!name?.trim())                          return NextResponse.json({ error: 'Name is required' },      { status: 400 })
    if (!email?.trim())                         return NextResponse.json({ error: 'Email is required' },     { status: 400 })
    if (!VALID_BUCKETS.includes(owner_bucket!)) return NextResponse.json({ error: 'Invalid owner bucket' }, { status: 400 })

    const [member] = await sql`
      INSERT INTO team_members (name, email, owner_bucket)
      VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${owner_bucket!})
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name, owner_bucket = EXCLUDED.owner_bucket
      RETURNING id, name, email, owner_bucket, created_at
    `
    return NextResponse.json(member, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
