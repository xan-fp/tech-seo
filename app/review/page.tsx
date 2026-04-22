'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SeverityBadge from '@/components/severity-badge'
import OwnerLabel    from '@/components/owner-label'
import type { Owner, Severity, Ticket } from '@/lib/types'
import { getFixGuide } from '@/lib/fix-guide'

// ── constants ────────────────────────────────────────────────────────────────

const OWNER_OPTIONS: { value: Owner | ''; label: string }[] = [
  { value: '',                  label: 'All owners' },
  { value: 'site_content_lead', label: 'Site Content Lead' },
  { value: 'copy_blog_lead',    label: 'Copy / Blog Lead' },
  { value: 'tech',              label: 'Tech' },
]

const SEVERITY_OPTIONS: { value: Severity | ''; label: string }[] = [
  { value: '',         label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
]

// ── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({
  owner, severity, sourceTool,
  sourceToolOptions,
  onChange, onClear,
}: {
  owner: string; severity: string; sourceTool: string
  sourceToolOptions: string[]
  onChange: (k: string, v: string) => void
  onClear: () => void
}) {
  return (
    <div className="card p-3 flex flex-wrap gap-3 items-end">
      <div>
        <label className="label">Owner</label>
        <select className="select w-44" value={owner}
          onChange={e => onChange('owner', e.target.value)}>
          {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Severity</label>
        <select className="select w-36" value={severity}
          onChange={e => onChange('severity', e.target.value)}>
          {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Source Tool</label>
        <select className="select w-40" value={sourceTool}
          onChange={e => onChange('sourceTool', e.target.value)}>
          <option value="">All tools</option>
          {sourceToolOptions.map(t => <option key={t} value={t}>{t}</option>)}
          {sourceToolOptions.length === 0 && (
            <option value="" disabled>No tools detected</option>
          )}
        </select>
      </div>
      <button className="btn-secondary self-end" onClick={onClear}>Clear</button>
    </div>
  )
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────

function BulkActionBar({
  count, busy,
  onApprove, onClear,
}: {
  count: number; busy: boolean
  onApprove: () => void
  onClear:   () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
      <span className="text-sm font-medium text-blue-800">
        {count} ticket{count === 1 ? '' : 's'} selected
      </span>
      <button
        className="btn-success text-xs py-1"
        onClick={onApprove}
        disabled={busy}
      >
        {busy ? 'Approving…' : `Approve ${count}`}
      </button>
      <button className="btn-secondary text-xs py-1" onClick={onClear}>
        Clear selection
      </button>
    </div>
  )
}

// ── TicketPanel ───────────────────────────────────────────────────────────────

type PanelTab = 'guide' | 'urls' | 'edit'

function TicketPanel({
  ticket,
  onSave,
  onAction,
  onClose,
}: {
  ticket:   Ticket
  onSave:   (updated: Ticket) => void
  onAction: (id: string, status: 'approved' | 'rejected') => void
  onClose:  () => void
}) {
  const [tab,     setTab]     = useState<PanelTab>('guide')
  const [form,    setForm]    = useState({ title: ticket.title, description: ticket.description ?? '', owner: ticket.owner as Owner })
  const [saving,  setSaving]  = useState(false)
  const [actBusy, setActBusy] = useState<'approved' | 'rejected' | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    setForm({ title: ticket.title, description: ticket.description ?? '', owner: ticket.owner as Owner })
    setTab('guide')
    setError(null)
    setSaved(false)
  }, [ticket.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = form.title !== ticket.title || form.description !== (ticket.description ?? '') || form.owner !== ticket.owner

  async function save() {
    setSaving(true); setError(null)
    const body: Record<string, unknown> = { title: form.title, description: form.description || null, owner: form.owner }
    if (form.owner !== ticket.owner) body.needs_review = false
    const res  = await fetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Save failed'); return }
    setSaved(true); onSave(data as Ticket); setTimeout(() => setSaved(false), 2000)
  }

  async function act(status: 'approved' | 'rejected') {
    setActBusy(status)
    const res = await fetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setActBusy(null)
    if (res.ok) onAction(ticket.id, status)
  }

  const guide = getFixGuide(ticket.issue_type)
  const urls  = Array.isArray(ticket.affected_urls) ? ticket.affected_urls : []

  return (
    <aside className="w-[420px] flex-shrink-0 card flex flex-col sticky top-4 max-h-[calc(100vh-6rem)] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 p-4 border-b bg-gray-50">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{ticket.issue_type}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <SeverityBadge severity={ticket.severity as Severity} />
            {ticket.source_tool && (
              <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-medium border border-indigo-200">
                {ticket.source_tool}
              </span>
            )}
            {ticket.affected_count > 1 && (
              <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                {ticket.affected_count} pages
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none flex-shrink-0">✕</button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b bg-white">
        {([
          { id: 'guide', label: 'Fix Guide' },
          { id: 'urls',  label: `Affected URLs${urls.length > 0 ? ` (${urls.length})` : ''}` },
          { id: 'edit',  label: 'Edit' },
        ] as { id: PanelTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── FIX GUIDE TAB ── */}
        {tab === 'guide' && (
          <div className="p-4 space-y-4">

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">What is this?</p>
              <p className="text-sm text-gray-700 leading-relaxed">{guide.what}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Why it matters</p>
              <p className="text-sm text-gray-700 leading-relaxed">{guide.why}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">How to fix it</p>
              <ol className="space-y-2">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Who does this</p>
              <p className="text-xs text-amber-800 leading-relaxed">{guide.owner}</p>
            </div>

          </div>
        )}

        {/* ── AFFECTED URLS TAB ── */}
        {tab === 'urls' && (
          <div>
            {urls.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No URLs recorded for this ticket.
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <p className="text-xs text-gray-500">
                    {urls.length} page{urls.length === 1 ? '' : 's'} affected — all need this fix
                  </p>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-4 text-gray-500 font-semibold">#</th>
                      <th className="text-left py-2 px-4 text-gray-500 font-semibold">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urls.map((url, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-400 w-8">{i + 1}</td>
                        <td className="py-2 px-4">
                          {url.startsWith('http') ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              {url}
                            </a>
                          ) : (
                            <span className="text-gray-700 break-all">{url}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ── EDIT TAB ── */}
        {tab === 'edit' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description / Notes</label>
              <textarea
                className="input min-h-[100px] resize-y text-sm"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add context or notes for the assignee…"
              />
            </div>
            <div>
              <label className="label">Owner Bucket</label>
              <div className="mb-2">
                <OwnerLabel owner={form.owner} needsReview={ticket.needs_review && form.owner === ticket.owner} />
              </div>
              <select className="select" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value as Owner }))}>
                <option value="site_content_lead">Site Content Lead</option>
                <option value="copy_blog_lead">Copy / Blog Lead</option>
                <option value="tech">Tech</option>
              </select>
              {form.owner !== ticket.owner && (
                <p className="text-[11px] text-amber-600 mt-1">Changing owner will clear the &quot;needs review&quot; flag.</p>
              )}
            </div>
            {ticket.assignment_reason && (
              <p className="text-[11px] text-gray-400 italic leading-relaxed">{ticket.assignment_reason}</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button className="btn-primary w-full text-xs py-2" onClick={save} disabled={saving || !isDirty}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* ── Footer: approve / reject always visible ── */}
      <div className="p-4 border-t bg-gray-50 flex gap-2">
        <button className="btn-success text-xs py-2 flex-1" onClick={() => act('approved')} disabled={actBusy !== null}>
          {actBusy === 'approved' ? '…' : '✓ Approve'}
        </button>
        <button className="btn-danger text-xs py-2 flex-1" onClick={() => act('rejected')} disabled={actBusy !== null}>
          {actBusy === 'rejected' ? '…' : '✕ Reject'}
        </button>
      </div>
    </aside>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Ticket | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkBusy,   setBulkBusy]   = useState(false)
  const [filters, setFilters] = useState({ owner: '', severity: '', sourceTool: '' })
  const checkAllRef = useRef<HTMLInputElement>(null)

  // ── Load ──
  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/tickets?status=draft')
      .then(r => {
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then((data: Ticket[]) => { setAllTickets(data); setLoading(false) })
      .catch(err => {
        console.error('Failed to load tickets:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived: filtered tickets ──
  const tickets = useMemo(() => {
    let t = allTickets
    if (filters.owner)      t = t.filter(x => x.owner       === filters.owner)
    if (filters.severity)   t = t.filter(x => x.severity    === filters.severity)
    if (filters.sourceTool) t = t.filter(x => x.source_tool === filters.sourceTool)
    return t
  }, [allTickets, filters])

  // ── Derived: distinct source tools ──
  const sourceToolOptions = useMemo(
    () => Array.from(new Set(allTickets.map(t => t.source_tool).filter((v): v is string => v !== null))).sort(),
    [allTickets]
  )

  // ── Derived: selection state ──
  const checkedInView  = tickets.filter(t => checkedIds.has(t.id))
  const allChecked     = tickets.length > 0 && checkedInView.length === tickets.length
  const someChecked    = checkedInView.length > 0 && !allChecked
  const needsCount     = allTickets.filter(t => t.needs_review).length

  // Keep select-all checkbox indeterminate state in sync
  useEffect(() => {
    if (checkAllRef.current) checkAllRef.current.indeterminate = someChecked
  }, [someChecked])

  // ── Handlers ──
  function changeFilter(key: string, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
    setCheckedIds(new Set()) // clear selection on filter change
  }

  function clearFilters() {
    setFilters({ owner: '', severity: '', sourceTool: '' })
    setCheckedIds(new Set())
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(tickets.map(t => t.id)))
    }
  }

  function selectRow(ticket: Ticket) {
    setSelected(prev => prev?.id === ticket.id ? null : ticket)
  }

  function handleSave(updated: Ticket) {
    setAllTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelected(updated)
  }

  function handleAction(id: string, _status: 'approved' | 'rejected') {
    // Remove from list, auto-advance to next ticket in the filtered view
    const idx  = tickets.findIndex(t => t.id === id)
    const next = tickets[idx + 1] ?? tickets[idx - 1] ?? null
    setAllTickets(prev => prev.filter(t => t.id !== id))
    setSelected(next?.id !== id ? next : null)
    setCheckedIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function handleBulkApprove() {
    setBulkBusy(true)
    await Promise.all(
      Array.from(checkedIds).map(id =>
        fetch(`/api/tickets/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: 'approved' }),
        })
      )
    )
    const doneIds = new Set(Array.from(checkedIds))
    setAllTickets(prev => prev.filter(t => !doneIds.has(t.id)))
    if (selected && doneIds.has(selected.id)) setSelected(null)
    setCheckedIds(new Set())
    setBulkBusy(false)
  }

  const total = allTickets.length

  // ── Render ──
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading…' : `${total} draft ticket${total === 1 ? '' : 's'} awaiting review`}
          </p>
        </div>
        {!loading && needsCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            {needsCount} need{needsCount === 1 ? 's' : ''} manual owner review
          </span>
        )}
      </div>

      {/* Filters */}
      <FilterBar
        owner={filters.owner}
        severity={filters.severity}
        sourceTool={filters.sourceTool}
        sourceToolOptions={sourceToolOptions}
        onChange={changeFilter}
        onClear={clearFilters}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        count={checkedInView.length}
        busy={bulkBusy}
        onApprove={handleBulkApprove}
        onClear={() => setCheckedIds(new Set())}
      />

      {/* Empty state */}
      {!loading && total === 0 && (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No draft tickets. Upload an audit file to get started.</p>
        </div>
      )}

      {!loading && total > 0 && tickets.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No tickets match the current filters.</p>
          <button className="btn-secondary mt-3 text-sm" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      {/* Table + Panel */}
      {tickets.length > 0 && (
        <div className="flex gap-4 items-start">

          {/* ── Table ── */}
          <div className="flex-1 min-w-0 card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {/* Checkbox */}
                    <th className="py-2.5 pl-4 pr-2 w-8">
                      <input
                        ref={checkAllRef}
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                      Title / URL
                    </th>
                    {!selected && (
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                        Source Tool
                      </th>
                    )}
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                      Severity
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500">
                      Owner
                    </th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-gray-500 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <TicketTableRow
                      key={t.id}
                      ticket={t}
                      isSelected={selected?.id === t.id}
                      isChecked={checkedIds.has(t.id)}
                      panelOpen={selected !== null}
                      onSelect={selectRow}
                      onCheck={toggleCheck}
                      onAction={handleAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Side panel ── */}
          {selected && (
            <TicketPanel
              ticket={selected}
              onSave={handleSave}
              onAction={handleAction}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── TicketTableRow ─────────────────────────────────────────────────────────────
// Separated so that panel state changes don't re-render the whole table

function TicketTableRow({
  ticket, isSelected, isChecked, panelOpen,
  onSelect, onCheck, onAction,
}: {
  ticket:     Ticket
  isSelected: boolean
  isChecked:  boolean
  panelOpen:  boolean
  onSelect:   (t: Ticket) => void
  onCheck:    (id: string) => void
  onAction:   (id: string, status: 'approved' | 'rejected') => void
}) {
  const [actBusy, setActBusy] = useState<'approved' | 'rejected' | null>(null)

  async function act(e: React.MouseEvent, status: 'approved' | 'rejected') {
    e.stopPropagation()
    setActBusy(status)
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    setActBusy(null)
    if (res.ok) onAction(ticket.id, status)
  }

  const rowBase = 'border-b border-gray-100 align-top cursor-pointer transition-colors'
  const rowColor = isSelected
    ? 'bg-blue-50'
    : ticket.needs_review
    ? 'bg-amber-50 hover:bg-amber-100/60'
    : 'hover:bg-gray-50'

  return (
    <tr className={`${rowBase} ${rowColor}`} onClick={() => onSelect(ticket)}>

      {/* Checkbox */}
      <td className="py-3 pl-4 pr-2 w-8" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onCheck(ticket.id)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>

      {/* Title / URL */}
      <td className="py-3 px-3 max-w-[240px]">
        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
          {ticket.title}
        </p>
        {ticket.affected_count > 1 && (
          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {ticket.affected_count} pages
          </span>
        )}
        {ticket.url && (
          ticket.url.startsWith('http') ? (
            <a
              href={ticket.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate block max-w-[220px] mt-0.5"
              onClick={e => e.stopPropagation()}
            >
              {ticket.url}
            </a>
          ) : (
            <span className="text-xs text-gray-400 truncate block max-w-[220px] mt-0.5">
              {ticket.url}
            </span>
          )
        )}
        {ticket.needs_review && (
          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
            Needs review
          </span>
        )}
      </td>

      {/* Source tool — hidden when panel is open */}
      {!panelOpen && (
        <td className="py-3 px-3 whitespace-nowrap">
          {ticket.source_tool ? (
            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
              {ticket.source_tool}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      )}

      {/* Severity */}
      <td className="py-3 px-3 whitespace-nowrap">
        <SeverityBadge severity={ticket.severity as Severity} />
      </td>

      {/* Owner */}
      <td className="py-3 px-3">
        <OwnerLabel owner={ticket.owner as Owner} />
      </td>

      {/* Actions */}
      <td className="py-3 px-3 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            className="btn-success text-xs py-1 px-2"
            disabled={actBusy !== null}
            onClick={e => act(e, 'approved')}
          >
            {actBusy === 'approved' ? '…' : '✓'}
          </button>
          <button
            className="btn-danger text-xs py-1 px-2"
            disabled={actBusy !== null}
            onClick={e => act(e, 'rejected')}
          >
            {actBusy === 'rejected' ? '…' : '✕'}
          </button>
        </div>
      </td>
    </tr>
  )
}
