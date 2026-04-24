'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import SeverityBadge from '@/components/severity-badge'
import OwnerLabel    from '@/components/owner-label'
import StatusBadge   from '@/components/status-badge'
import type { Owner, Severity, TeamMember, Ticket, TicketComment, TicketStatus } from '@/lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

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
  { value: '',            label: 'All statuses' },
  { value: 'approved',    label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'draft',       label: 'Draft' },
]

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'draft',       label: 'Draft' },
  { value: 'approved',    label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'rejected',    label: 'Rejected' },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── TicketPanel ───────────────────────────────────────────────────────────────

function TicketPanel({
  ticket,
  teamMembers,
  onStatusChange,
  onClose,
}: {
  ticket:         Ticket
  teamMembers:    TeamMember[]
  onStatusChange: (id: string, status: TicketStatus) => void
  onClose:        () => void
}) {
  const [status,       setStatus]       = useState<TicketStatus>(ticket.status as TicketStatus)
  const [statusBusy,   setStatusBusy]   = useState(false)
  const [statusSaved,  setStatusSaved]  = useState(false)
  const [comments,     setComments]     = useState<TicketComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [author,       setAuthor]       = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('seo_audit_author') ?? '' : ''
  )
  const [commentText,  setCommentText]  = useState('')
  const [mentioned,    setMentioned]    = useState<Set<string>>(new Set())
  const [posting,      setPosting]      = useState(false)
  const [postError,    setPostError]    = useState<string | null>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Reset when ticket changes
  useEffect(() => {
    setStatus(ticket.status as TicketStatus)
    setStatusSaved(false)
    setCommentText('')
    setMentioned(new Set())
    setPostError(null)
    setLoadingComments(true)
    fetch(`/api/tickets/${ticket.id}/comments`)
      .then(r => r.json())
      .then((data: unknown) => {
        setComments(Array.isArray(data) ? data as TicketComment[] : [])
        setLoadingComments(false)
      })
      .catch(() => setLoadingComments(false))
  }, [ticket.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function saveStatus() {
    if (status === ticket.status) return
    setStatusBusy(true)
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    setStatusBusy(false)
    if (res.ok) {
      onStatusChange(ticket.id, status)
      setStatusSaved(true)
      setTimeout(() => setStatusSaved(false), 2000)
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!author.trim() || !commentText.trim()) return
    localStorage.setItem('seo_audit_author', author.trim())
    setPosting(true); setPostError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          author:   author.trim(),
          content:  commentText.trim(),
          mentions: Array.from(mentioned),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setPostError(data.error ?? 'Failed to post'); return }
      setComments(prev => [...prev, data as TicketComment])
      setCommentText('')
      setMentioned(new Set())
    } catch {
      setPostError('Network error')
    } finally {
      setPosting(false)
    }
  }

  function toggleMention(id: string) {
    setMentioned(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isDirty = status !== ticket.status

  return (
    <aside className="w-[400px] flex-shrink-0 card flex flex-col sticky top-4 max-h-[calc(100vh-6rem)] overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b bg-gray-50">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">{ticket.issue_type}</p>
          <p className="text-sm font-semibold text-gray-900 leading-snug mt-0.5 line-clamp-2">{ticket.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <SeverityBadge severity={ticket.severity as Severity} />
            <StatusBadge   status={ticket.status as TicketStatus} />
            {ticket.affected_count > 1 && (
              <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                {ticket.affected_count} pages
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none flex-shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Status update ── */}
        <div className="p-4 border-b space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Update Status</p>
          <div className="flex gap-2">
            <select
              className="select flex-1 text-sm"
              value={status}
              onChange={e => setStatus(e.target.value as TicketStatus)}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              className="btn-primary text-xs px-3"
              onClick={saveStatus}
              disabled={statusBusy || !isDirty}
            >
              {statusBusy ? '…' : statusSaved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          {isDirty && (
            <p className="text-[11px] text-amber-600">
              Saving will email the owner bucket team.
            </p>
          )}
        </div>

        {/* ── URLs download ── */}
        {ticket.affected_count > 0 && (
          <div className="px-4 py-3 border-b">
            <a
              href={`/api/tickets/${ticket.id}/urls`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 2v8M5 7l3 3 3-3M2 12h12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download {ticket.affected_count} affected URLs (CSV)
            </a>
          </div>
        )}

        {/* ── Comments thread ── */}
        <div className="p-4 space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Comments {comments.length > 0 && `(${comments.length})`}
          </p>

          {loadingComments && (
            <p className="text-xs text-gray-400">Loading…</p>
          )}

          {!loadingComments && comments.length === 0 && (
            <p className="text-xs text-gray-400 italic">No comments yet.</p>
          )}

          {comments.map(c => {
            const tagged = teamMembers.filter(m => c.mentions.includes(m.id))
            return (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                    {initials(c.author)}
                  </div>
                  <span className="text-xs font-semibold text-gray-800">{c.author}</span>
                  <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                </div>
                <div className="ml-8">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  {tagged.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tagged.map(m => (
                        <span key={m.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">
                          @{m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={commentsEndRef} />
        </div>
      </div>

      {/* ── New comment form ── */}
      <form onSubmit={postComment} className="border-t bg-gray-50 p-4 space-y-3">
        <input
          className="input text-sm"
          placeholder="Your name"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          required
        />
        <textarea
          className="input text-sm min-h-[72px] resize-none"
          placeholder="Add a comment…"
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          required
        />

        {/* Tag people */}
        {teamMembers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Notify</p>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(m => (
                <label
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs font-medium border transition-colors ${
                    mentioned.has(m.id)
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={mentioned.has(m.id)}
                    onChange={() => toggleMention(m.id)}
                  />
                  <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600">
                    {initials(m.name)}
                  </span>
                  {m.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {postError && <p className="text-xs text-red-600">{postError}</p>}
        <button
          type="submit"
          className="btn-primary w-full text-xs py-2"
          disabled={posting || !commentText.trim() || !author.trim()}
        >
          {posting ? 'Posting…' : mentioned.size > 0 ? `Post & notify ${mentioned.size} person${mentioned.size > 1 ? 's' : ''}` : 'Post comment'}
        </button>
      </form>
    </aside>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const [tickets,     setTickets]     = useState<Ticket[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<Ticket | null>(null)
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
    if (!status)  params.set('status', 'approved,in_progress,done,rejected')

    Promise.all([
      fetch(`/api/tickets?${params}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ])
      .then(([ticketData, teamData]) => {
        const safeTickets: Ticket[]     = Array.isArray(ticketData) ? ticketData : []
        const safeTeam:    TeamMember[] = Array.isArray(teamData)   ? teamData   : []
        setTickets(needsReview ? safeTickets.filter(t => t.needs_review) : safeTickets)
        setTeamMembers(safeTeam)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [owner, severity, status, needsReview])

  useEffect(() => { load() }, [load])

  function handleStatusChange(id: string, newStatus: TicketStatus) {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : prev)
  }

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
          <select className="select w-44" value={owner} onChange={e => { setOwner(e.target.value as Owner | ''); setSelected(null) }}>
            {OWNERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Severity</label>
          <select className="select w-40" value={severity} onChange={e => { setSeverity(e.target.value as Severity | ''); setSelected(null) }}>
            {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select w-36" value={status} onChange={e => { setStatus(e.target.value as TicketStatus | ''); setSelected(null) }}>
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
          onClick={() => { setOwner(''); setSeverity(''); setStatus(''); setNeedsReview(false); setSelected(null) }}
        >
          Clear
        </button>
      </div>

      {/* Needs-review callout */}
      {!loading && needsCount > 0 && !needsReview && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" />
          <span>
            <strong>{needsCount}</strong> ticket{needsCount === 1 ? '' : 's'} {needsCount === 1 ? 'has' : 'have'} an ambiguous owner and need manual review.
          </span>
          <button className="ml-auto text-xs underline underline-offset-2 hover:text-amber-900" onClick={() => setNeedsReview(true)}>
            Show only
          </button>
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-500">No tickets match the current filters.</p>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="flex gap-4 items-start">

          {/* Table */}
          <div className="flex-1 min-w-0 card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Title / URL</th>
                  {!selected && <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Issue Type</th>}
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Severity</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Owner</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">URLs</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(prev => prev?.id === t.id ? null : t)}
                    className={`border-b border-gray-100 align-top cursor-pointer transition-colors ${
                      selected?.id === t.id
                        ? 'bg-blue-50'
                        : t.needs_review
                        ? 'bg-amber-50 hover:bg-amber-100/60'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-3 px-4 max-w-[220px]">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{t.title}</p>
                      {t.affected_count > 1 && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {t.affected_count} pages
                        </span>
                      )}
                      {t.url && (
                        t.url.startsWith('http') ? (
                          <a href={t.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate block max-w-[200px] mt-0.5"
                            onClick={e => e.stopPropagation()}>
                            {t.url}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 truncate block max-w-[200px] mt-0.5">{t.url}</span>
                        )
                      )}
                    </td>
                    {!selected && (
                      <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">{t.issue_type}</td>
                    )}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SeverityBadge severity={t.severity as Severity} />
                    </td>
                    <td className="py-3 px-4">
                      <OwnerLabel owner={t.owner as Owner} needsReview={t.needs_review} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={t.status as TicketStatus} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {t.affected_count > 0 ? (
                        <a
                          href={`/api/tickets/${t.id}/urls`}
                          download
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          title="Download affected URLs as CSV"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M8 2v8M5 7l3 3 3-3M2 12h12" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {t.affected_count}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Side panel */}
          {selected && (
            <TicketPanel
              ticket={selected}
              teamMembers={teamMembers}
              onStatusChange={handleStatusChange}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
