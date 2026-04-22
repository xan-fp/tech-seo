'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState<UploadState>('idle')
  const [message, setMessage] = useState<string>('')
  const [ticketCount, setTicketCount] = useState(0)

  async function upload(file: File) {
    setState('uploading')
    setMessage('')

    const form = new FormData()
    form.append('file', file)

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setMessage(data.error ?? 'Upload failed.')
        return
      }

      setState('success')
      setTicketCount(data.ticketCount)
      setMessage(`Parsed ${data.ticketCount} issues from "${file.name}".`)
    } catch {
      setState('error')
      setMessage('Network error. Please try again.')
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    upload(files[0])
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload SEO Audit</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV or XLSX export from Screaming Frog, Ahrefs, Semrush, or any tool that
          produces a URL + issue list. Draft tickets will be created automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50',
          state === 'uploading' && 'pointer-events-none opacity-60'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-3">📂</div>
        <p className="font-medium text-gray-700">
          {state === 'uploading' ? 'Uploading and parsing…' : 'Drop file here or click to browse'}
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

      {/* Status messages */}
      {state === 'error' && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {message}
        </div>
      )}

      {state === 'success' && (
        <div className="card border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-sm text-green-700 font-medium">
            ✓ {message}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={() => router.push('/review')}
            >
              Review {ticketCount} Draft Tickets →
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setState('idle')
                setMessage('')
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Format guide */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Supported formats</h2>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>
            <span className="font-medium text-gray-800">Screaming Frog crawl export</span> — auto-detects
            broken pages, missing titles, missing meta descriptions, missing H1s, and thin content.
          </li>
          <li>
            <span className="font-medium text-gray-800">Generic issue list</span> — any CSV/XLSX
            with columns for URL, Issue/Type, Severity, and Description. Column names are matched
            fuzzy (e.g. "Address", "Error", "Priority" all work).
          </li>
        </ul>
      </div>
    </div>
  )
}
