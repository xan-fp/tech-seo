import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [totals] = await sql`
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status   = 'draft')           AS draft,
      COUNT(*) FILTER (WHERE status   = 'approved')        AS approved,
      COUNT(*) FILTER (WHERE status   = 'rejected')        AS rejected,
      COUNT(*) FILTER (WHERE severity = 'critical')        AS critical,
      COUNT(*) FILTER (WHERE severity = 'high')            AS high,
      COUNT(*) FILTER (WHERE severity = 'medium')          AS medium,
      COUNT(*) FILTER (WHERE severity = 'low')             AS low,
      COUNT(*) FILTER (WHERE owner = 'site_content_lead')  AS site_content,
      COUNT(*) FILTER (WHERE owner = 'copy_blog_lead')     AS copy_blog,
      COUNT(*) FILTER (WHERE owner = 'tech')               AS tech
    FROM tickets
  `

  return NextResponse.json(totals)
}
