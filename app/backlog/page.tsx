'use client'

import { useEffect, useState, useCallback } from 'react'
import SeverityBadge from '@/components/severity-badge'
import OwnerLabel from '@/components/owner-label'
import StatusBadge from '@/components/status-badge'
import type { Ticket, Severity, Owner, TicketStatus } from '@/lib/types'

const OWNERS: { value: Owner | ''; label: string }[] = [
  { value: '',                  label: 'All owners' },
  { value: 'site_content_lead', label: 'Site Content Lead' },
  { value: 'copy_blog_lead',    label: 'Copy / Blog Lead' },
  { value: 'tech',              label: 'Tech' },
]

const SEVERITIES: { value: Severity | ''; label: string }[] = [
  { value: '',         label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
]

const STATUSES: { value: TicketStatus | ''; label: string }[] = [
  { value: '',          label: 'All statuses' },
  { value: 'approved',  label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',      label: 'Done' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'draft',     label: 'Draft' },
]

export default function BacklogPage() {
  const [tickets,     setTickets]     = useState<Ticket[]>([])
  const [loading,     setLoading]     = useState(true)
  const [owner,       setOwner]       = useState<Owner | ''>('')
  const [severity,    setSeverity]    = useState<Severity | ''>('')
  const [status,      setStatus]      = useState<TicketStatus | ''>('')
  const [needsReview, setNeedsReview] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (owner)    params.set('owner',    owner)
    if (severity) params.set('severity', severity)
    if (status)   params.set('status',   status)
    // Default: show processed tickets (not raw drafts)
    if (!status)  params.set('status', 'approved,in_progress,done,rejected')

    fetch(`/api/tickets?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then((data: Ticket[]) => {
        setTickets(needsReview ? data.filter(t => t.needs_review) : data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load tickets:', err)
        setLoading(false)
      })
  }, [owner, severity, status, needsReview])

  useEffect(() => { load() }, [load])

  const needsCount = tickets.filter(t => t.needs_review).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Backlog</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? 'Loading…' : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Owner</label>
          <select className="select w-44" value={owner} onChange={e => setOwner(e.target.value as Owner | '')}>
            {OWNERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Severity</label>
          <select className="select w-40" value={severity} onChange={e => setSeverity(e.target.value as Severity | '')}>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select w-36" value={status} onChange={e => setStatus(e.target.value as TicketStatus | '')}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 self-end pb-0.5">
          <input
            id="needs-review"
            type="checkbox"
            checked={needsReview}
            onChange={e => setNeedsReview(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
          />
          <label htmlFor="needs-review" className="text-sm text-gray-700 cursor-pointer select-none">
            Needs review only
          </label>
        </div>
        <button
          className="btn-secondary self-end"
          onClick={() => { setOwner(''); setSeverity(''); setStatus(''); setNeedsReview(false) }}
        >
          Clear
        </button>
      </div>

      {/* Needs-review callout */}
      {!loading && needsCount > 0 && !needsReview && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" />
          <span>
            <strong>{needsCount}</strong> ticket{needsCount === 1 ? '' : 's'} in this view{' '}
            {needsCount === 1 ? 'has' : 'have'} an ambiguous owner assignment and need manual review.
          </span>
          <button
            className="ml-auto text-xs underline underline-offset-2 hover:text-amber-900"
            onClick={() => setNeedsReview(true)}
          >
            Show only
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && tickets.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-500">No tickets match the current filters.</p>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Title / URL</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Issue Type</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Severity</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Owner</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr
                  key={t.id}
                  className={`border-b border-gray-100 align-top ${
                    t.needs_review ? 'bg-amber-50 hover:bg-amber-100/60' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-3 px-4 max-w-[240px]">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{t.title}</p>
                    {t.url && (
                      t.url.startsWith('http') ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline truncate block max-w-[220px] mt-0.5"
                        >
                          {t.url}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 truncate block max-w-[220px] mt-0.5">
                          {t.url}
                        </span>
                      )
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">{t.issue_type}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SeverityBadge severity={t.severity as Severity} />
                  </td>
                  <td className="py-3 px-4">
                    <OwnerLabel
                      owner={t.owner as Owner}
                      reason={t.assignment_reason}
                      needsReview={t.needs_review}
                    />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusBadge status={t.status as TicketStatus} />
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500 max-w-[180px]">
                    <p className="line-clamp-2">{t.notes ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
