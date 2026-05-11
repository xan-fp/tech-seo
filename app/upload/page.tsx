'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import type { Severity, Owner } from '@/lib/types'

// ── types ─────────────────────────────────────────────────────────────────────

type FileState = 'pending' | 'uploading' | 'done' | 'error'

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

interface FileUpload {
  id:      number
  file:    File
  state:   FileState
  result?: UploadResult
  error?:  string
}

// ── constants ─────────────────────────────────────────────────────────────────

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

const STATE_ICON: Record<FileState, string> = {
  pending:   '⏳',
  uploading: '⟳',
  done:      '✓',
  error:     '✕',
}

const STATE_COLOR: Record<FileState, string> = {
  pending:   'text-gray-400',
  uploading: 'text-blue-500 animate-spin',
  done:      'text-green-600',
  error:     'text-red-500',
}

function formatBytes(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

let nextId = 1

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [uploads,   setUploads]   = useState<FileUpload[]>([])
  const [running,   setRunning]   = useState(false)

  const allDone  = uploads.length > 0 && uploads.every(u => u.state === 'done' || u.state === 'error')
  const anyError = uploads.some(u => u.state === 'error')

  // Combined breakdown across all successful uploads
  const combinedBreakdown: BreakdownRow[] = []
  let totalRows    = 0
  let totalTickets = 0
  for (const u of uploads) {
    if (u.result) {
      totalRows    += u.result.rowCount
      totalTickets += u.result.ticketCount
      for (const row of u.result.breakdown) {
        const existing = combinedBreakdown.find(r => r.issue_type.toLowerCase() === row.issue_type.toLowerCase())
        if (existing) {
          existing.affected_count += row.affected_count
        } else {
          combinedBreakdown.push({ ...row })
        }
      }
    }
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const valid = arr.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name) && f.size <= 10 * 1024 * 1024)
    if (valid.length === 0) return
    const newUploads: FileUpload[] = valid.map(file => ({
      id: nextId++, file, state: 'pending',
    }))
    setUploads(prev => [...prev, ...newUploads])
    processQueue(newUploads)
  }

  async function processQueue(queue: FileUpload[]) {
    setRunning(true)
    for (const item of queue) {
      // Mark as uploading
      setUploads(prev => prev.map(u => u.id === item.id ? { ...u, state: 'uploading' } : u))

      const form = new FormData()
      form.append('file', item.file)

      try {
        const res  = await fetch('/api/upload', { method: 'POST', body: form })
        const data = await res.json()

        if (!res.ok) {
          setUploads(prev => prev.map(u =>
            u.id === item.id ? { ...u, state: 'error', error: data.error ?? 'Upload failed' } : u
          ))
        } else {
          setUploads(prev => prev.map(u =>
            u.id === item.id ? {
              ...u,
              state: 'done',
              result: { rowCount: data.rowCount, ticketCount: data.ticketCount, breakdown: data.breakdown ?? [] },
            } : u
          ))
        }
      } catch {
        setUploads(prev => prev.map(u =>
          u.id === item.id ? { ...u, state: 'error', error: 'Network error' } : u
        ))
      }
    }
    setRunning(false)
  }

  function reset() {
    setUploads([])
    setRunning(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload SEO Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload one or more CSV / XLSX exports from Screaming Frog, Ahrefs, Semrush, or any tool
          that produces a URL + issue list. Issues are automatically grouped by category into tickets.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragging  ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50',
          running   && 'pointer-events-none opacity-60',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e  => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-3">📂</div>
        <p className="font-medium text-gray-700">
          {running ? 'Uploading files…' : 'Drop files here or click to browse'}
        </p>
        <p className="text-sm text-gray-400 mt-1">CSV or XLSX · up to 10 MB each · multiple files OK</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={e => { if (e.target.files) addFiles(e.target.files) }}
        />
      </div>

      {/* File queue */}
      {uploads.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Files — {uploads.filter(u => u.state === 'done').length}/{uploads.length} done
            </h2>
            {!running && (
              <button className="text-xs text-gray-400 hover:text-gray-700" onClick={reset}>
                Clear all
              </button>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {uploads.map(u => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                {/* Icon */}
                <span className={clsx('text-base w-5 text-center flex-shrink-0', STATE_COLOR[u.state])}>
                  {u.state === 'uploading' ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  ) : STATE_ICON[u.state]}
                </span>

                {/* File name + size */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.file.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatBytes(u.file.size)}
                    {u.state === 'done' && u.result && (
                      <> · <span className="text-green-600">{u.result.ticketCount} ticket{u.result.ticketCount === 1 ? '' : 's'} created</span></>
                    )}
                    {u.state === 'error' && (
                      <> · <span className="text-red-500">{u.error}</span></>
                    )}
                  </p>
                </div>

                {/* State badge */}
                <span className={clsx(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                  u.state === 'done'      && 'bg-green-100 text-green-700',
                  u.state === 'uploading' && 'bg-blue-100 text-blue-700',
                  u.state === 'pending'   && 'bg-gray-100 text-gray-500',
                  u.state === 'error'     && 'bg-red-100 text-red-600',
                )}>
                  {u.state === 'uploading' ? 'Uploading' : u.state === 'done' ? 'Done' : u.state === 'error' ? 'Error' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Combined results */}
      {allDone && combinedBreakdown.length > 0 && (
        <div className="space-y-4">
          <div className={clsx('card p-4', anyError ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50')}>
            <p className={clsx('text-sm font-semibold', anyError ? 'text-yellow-800' : 'text-green-800')}>
              {anyError ? '⚠ Some files had errors — results below are for successful uploads' : '✓ All files processed successfully'}
            </p>
            <p className={clsx('text-sm mt-1', anyError ? 'text-yellow-700' : 'text-green-700')}>
              <strong>{totalRows.toLocaleString()}</strong> total rows →{' '}
              grouped into <strong>{totalTickets}</strong> unique issue{totalTickets === 1 ? '' : 's'} →{' '}
              <strong>{totalTickets}</strong> draft ticket{totalTickets === 1 ? '' : 's'} created
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Issue breakdown</h2>
              <p className="text-xs text-gray-500 mt-0.5">Each row is one ticket in your Review Queue</p>
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
                {combinedBreakdown
                  .sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 }
                    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
                  })
                  .map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-900">{row.issue_type}</td>
                      <td className="py-2.5 px-4 font-semibold text-gray-700">
                        {row.affected_count === 1 ? '1 page' : `${row.affected_count.toLocaleString()} pages`}
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

          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => router.push('/review')}>
              Go to Review Queue →
            </button>
            <button className="btn-secondary" onClick={reset}>
              Upload More Files
            </button>
          </div>
        </div>
      )}

      {/* Format guide */}
      {uploads.length === 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">How it works</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>
              <span className="font-medium text-gray-800">Multiple files at once</span> — drop
              several exports together (e.g. Screaming Frog + Ahrefs). Each is processed in turn
              and the results are combined.
            </li>
            <li>
              <span className="font-medium text-gray-800">Rows are grouped by issue type</span> — if
              47 pages have a missing meta description, you get <em>one</em> ticket, not 47.
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
