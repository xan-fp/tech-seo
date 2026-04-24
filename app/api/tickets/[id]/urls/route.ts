import { NextRequest, NextResponse } from 'next/server'
import sql, { parseJsonArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const rows = await sql<{ title: string; issue_type: string; affected_urls: string[] }[]>`
    SELECT title, issue_type, affected_urls
    FROM tickets
    WHERE id = ${id}
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const { title, issue_type, affected_urls } = rows[0]
  const urls = parseJsonArray(affected_urls)

  // Build CSV — two columns: #  and  URL
  const header = 'URL,Issue Type'
  const csvRows = urls.map(url => {
    const safeUrl   = `"${url.replace(/"/g, '""')}"`
    const safeIssue = `"${issue_type.replace(/"/g, '""')}"`
    return `${safeUrl},${safeIssue}`
  })

  const csv = [header, ...csvRows].join('\r\n')

  // Sanitise filename
  const safeName = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}-affected-urls.csv"`,
    },
  })
}
