import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { parseAuditFile } from '@/lib/parse-audit'
import sql from '@/lib/db'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60s for large files

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

  // Read file into buffer
  const buffer = Buffer.from(await file.arrayBuffer())

  // Parse issues before uploading (so we can bail early if the file is empty)
  let issues
  try {
    issues = parseAuditFile(buffer, ext)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse error'
    return NextResponse.json({ error: `Could not parse file: ${msg}` }, { status: 422 })
  }

  if (issues.length === 0) {
    return NextResponse.json({ error: 'No issues found in the file. Check that it has the expected columns.' }, { status: 422 })
  }

  // Upload to Vercel Blob, save to DB
  try {
    const blob = await put(file.name, buffer, { access: 'public' })

    const [upload] = await sql<{ id: string }[]>`
      INSERT INTO audit_uploads (filename, blob_url, row_count)
      VALUES (${file.name}, ${blob.url}, ${issues.length})
      RETURNING id
    `

    for (const issue of issues) {
      await sql`
        INSERT INTO tickets (upload_id, title, description, url, issue_type, severity, owner, source_tool, assignment_reason, needs_review)
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
          ${issue.needs_review}
        )
      `
    }

    return NextResponse.json({
      ok:          true,
      uploadId:    upload.id,
      ticketCount: issues.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] Error:', err)
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 })
  }
}
