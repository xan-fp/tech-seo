import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { parseAuditFile, dedupeIssues } from '@/lib/parse-audit'
import sql from '@/lib/db'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not parse form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    return NextResponse.json({ error: 'Only CSV and XLSX files are supported.' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 10 MB.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 1 — Parse every row into individual issues
  let rawIssues
  try {
    rawIssues = parseAuditFile(buffer, ext)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse error'
    return NextResponse.json({ error: `Could not parse file: ${msg}` }, { status: 422 })
  }

  if (rawIssues.length === 0) {
    return NextResponse.json(
      { error: 'No issues found in the file. Check that it has the expected columns.' },
      { status: 422 },
    )
  }

  // 2 — Deduplicate: group by issue type → one ticket per category
  const issues = dedupeIssues(rawIssues)

  // 3 — Upload file to Vercel Blob + insert tickets
  try {
    const blob = await put(file.name, buffer, { access: 'public' })

    const [upload] = await sql<{ id: string }[]>`
      INSERT INTO audit_uploads (filename, blob_url, row_count)
      VALUES (${file.name}, ${blob.url}, ${rawIssues.length})
      RETURNING id
    `

    for (const issue of issues) {
      await sql`
        INSERT INTO tickets
          (upload_id, title, description, url, issue_type, severity, owner,
           source_tool, assignment_reason, needs_review, affected_count, affected_urls)
        VALUES (
          ${upload.id},
          ${issue.title},
          ${issue.description ?? null},
          ${issue.url ?? null},
          ${issue.issue_type},
          ${issue.severity},
          ${issue.owner},
          ${issue.source_tool ?? null},
          ${issue.assignment_reason ?? null},
          ${issue.needs_review},
          ${issue.affected_count},
          ${JSON.stringify(issue.affected_urls)}
        )
      `
    }

    // Build a breakdown summary to show in the UI
    const breakdown = issues.map(i => ({
      issue_type:     i.issue_type,
      affected_count: i.affected_count,
      severity:       i.severity,
      owner:          i.owner,
    }))

    return NextResponse.json({
      ok:           true,
      uploadId:     upload.id,
      rowCount:     rawIssues.length,   // total rows in the file
      ticketCount:  issues.length,      // unique issue types → tickets created
      breakdown,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] Error:', err)
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 })
  }
}
