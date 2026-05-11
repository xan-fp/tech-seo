import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [totals] = await sql`
    SELECT
      COUNT(*)                                                                AS total,
      COUNT(*) FILTER (WHERE status = 'needs_review')                        AS needs_review,
      COUNT(*) FILTER (WHERE status = 'approved')                            AS approved,
      COUNT(*) FILTER (WHERE status = 'in_progress')                         AS in_progress,
      COUNT(*) FILTER (WHERE status IN ('done','validated'))                  AS done,
      COUNT(*) FILTER (WHERE status = 'ignored')                             AS ignored,
      COUNT(*) FILTER (WHERE severity = 'critical')                          AS critical,
      COUNT(*) FILTER (WHERE severity = 'high')                              AS high,
      COUNT(*) FILTER (WHERE severity = 'medium')                            AS medium,
      COUNT(*) FILTER (WHERE severity = 'low')                               AS low,
      COUNT(*) FILTER (WHERE owner = 'site_content_lead')                    AS site_content,
      COUNT(*) FILTER (WHERE owner = 'copy_blog_lead')                       AS copy_blog,
      COUNT(*) FILTER (WHERE owner = 'tech')                                 AS tech
    FROM tickets
  `

  return NextResponse.json(totals)
}
