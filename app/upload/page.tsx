'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import type { Severity, Owner } from '@/lib/types'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface BreakdownRow {
  issue_type:     string
  affected_count: number
  severity:       Severity
  owner:          Owner
}

interface UploadResult {
  rowCount:    number
  ticketCount: number
  breakdown:   BreakdownRow[]
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
}

const OWNER_COLOR: Record<Owner, string> = {
  site_content_lead: 'bg-purple-100 text-purple-700',
  copy_blog_lead:    'bg-blue-100 text-blue-700',
  tech:              'bg-teal-100 text-teal-700',
}

const OWNER_LABEL: Record<Owner, string> = {
  site_content_lead: 'Site Content',
  copy_blog_lead:    'Copy / Blog',
  tech:              'Tech',
}

export default function UploadPage() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [state,    setState]    = useState<UploadState>('idle')
  const [error,    setError]    = useState<string>('')
  const [result,   setResult]   = useState<UploadResult | null>(null)

  async function upload(file: File) {
    setState('uploading')
    setError('')
    setResult(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setError(data.error ?? 'Upload failed.')
        return
      }

      setState('success')
      setResult({
        rowCount:    data.rowCount,
        ticketCount: data.ticketCount,
        breakdown:   data.breakdown ?? [],
      })
    } catch {
      setState('error')
      setError('Network error. Please try again.')
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    upload(files[0])
  }

  function reset() {
    setState('idle')
    setError('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload SEO Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV or XLSX export from Screaming Frog, Ahrefs, Semrush, or any tool that
          produces a URL + issue list. Issues are automatically grouped by category into tickets.
        </p>
      </div>

      {/* Drop zone — hide after success */}
      {state !== 'success' && (
        <div
          className={clsx(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50',
            state === 'uploading' && 'pointer-events-none opacity-60',
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="font-medium text-gray-700">
            {state === 'uploading' ? 'Uploading and grouping issues…' : 'Drop file here or click to browse'}
          </p>
          <p className="text-sm text-gray-400 mt-1">CSV or XLSX · max 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Success + breakdown */}
      {state === 'success' && result && (
        <div className="space-y-4">

          {/* Summary banner */}
          <div className="card border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              ✓ File processed successfully
            </p>
            <p className="text-sm text-green-700 mt-1">
              <strong>{result.rowCount}</strong> rows in file →{' '}
              grouped into <strong>{result.ticketCount}</strong> unique issue{result.ticketCount === 1 ? '' : 's'} →{' '}
              <strong>{result.ticketCount}</strong> draft ticket{result.ticketCount === 1 ? '' : 's'} created
            </p>
          </div>

          {/* Breakdown table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Issue breakdown</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each row below is one ticket in your Review Queue
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Issue type</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Pages affected</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Severity</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500">Assigned to</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-900">{row.issue_type}</td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                        {row.affected_count === 1 ? '1 page' : `${row.affected_count} pages`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium border capitalize', SEVERITY_COLOR[row.severity])}>
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium', OWNER_COLOR[row.owner])}>
                        {OWNER_LABEL[row.owner]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => router.push('/review')}>
              Go to Review Queue →
            </button>
            <button className="btn-secondary" onClick={reset}>
              Upload Another File
            </button>
          </div>
        </div>
      )}

      {/* Format guide — only show when idle */}
      {state === 'idle' && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">How it works</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              <span className="font-medium text-gray-800">Rows are grouped by issue type</span> — if
              47 pages have a missing meta description, you get <em>one</em> ticket saying
              "Missing Meta Description — 47 pages affected", not 47 tickets.
            </li>
            <li>
              <span className="font-medium text-gray-800">Screaming Frog crawl export</span> — auto-detects
              broken pages, missing titles, missing meta descriptions, missing H1s, and thin content.
            </li>
            <li>
              <span className="font-medium text-gray-800">Generic issue list</span> — any CSV/XLSX
              with columns for URL, Issue/Type, Severity, and Description.
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
