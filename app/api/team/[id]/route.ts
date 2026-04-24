import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { Owner } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_BUCKETS: Owner[] = ['tech', 'site_content_lead', 'copy_blog_lead']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json()
  const { name, email, owner_bucket } = body as {
    name?: string; email?: string; owner_bucket?: Owner
  }

  if (owner_bucket && !VALID_BUCKETS.includes(owner_bucket)) {
    return NextResponse.json({ error: 'Invalid owner bucket' }, { status: 400 })
  }

  const [member] = await sql`
    UPDATE team_members
    SET
      name         = COALESCE(${name?.trim() ?? null}, name),
      email        = COALESCE(${email?.trim().toLowerCase() ?? null}, email),
      owner_bucket = COALESCE(${owner_bucket ?? null}, owner_bucket)
    WHERE id = ${params.id}
    RETURNING id, name, email, owner_bucket, created_at
  `
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(member)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await sql`DELETE FROM team_members WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
