'use client'

import { useEffect, useState } from 'react'
import type { Owner, TeamMember } from '@/lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const BUCKETS: { value: Owner; label: string; color: string }[] = [
  {
    value: 'tech',
    label: 'Tech',
    color: 'bg-purple-50 border-purple-200 text-purple-800',
  },
  {
    value: 'site_content_lead',
    label: 'Site Content Lead',
    color: 'bg-violet-50 border-violet-200 text-violet-800',
  },
  {
    value: 'copy_blog_lead',
    label: 'Copy / Blog Lead',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
]

const EMPTY_FORM = { name: '', email: '', owner_bucket: 'tech' as Owner }

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── AddMemberForm ─────────────────────────────────────────────────────────────

function AddMemberForm({
  defaultBucket,
  onAdded,
}: {
  defaultBucket: Owner
  onAdded: (member: TeamMember) => void
}) {
  const [form,  setForm]  = useState({ ...EMPTY_FORM, owner_bucket: defaultBucket })
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open,  setOpen]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res  = await fetch('/api/team', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to add member'); return }
      onAdded(data as TeamMember)
      setForm({ ...EMPTY_FORM, owner_bucket: defaultBucket })
      setOpen(false)
    } catch {
      setError('Network error — make sure the database is set up (/api/db-setup)')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        + Add person
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <input
        className="input text-sm"
        placeholder="Full name"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        required
        autoFocus
      />
      <input
        className="input text-sm"
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        required
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-xs py-1.5 flex-1" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs py-1.5"
          onClick={() => { setOpen(false); setError(null) }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── MemberCard ────────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onDeleted,
}: {
  member:    TeamMember
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    if (!confirm(`Remove ${member.name}?`)) return
    setDeleting(true)
    await fetch(`/api/team/${member.id}`, { method: 'DELETE' })
    onDeleted(member.id)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white border border-gray-100 group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
        {initials(member.name)}
      </div>

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
        <p className="text-xs text-gray-400 truncate">{member.email}</p>
      </div>

      {/* Delete */}
      <button
        onClick={remove}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0"
        title="Remove"
      >
        {deleting ? '…' : '×'}
      </button>
    </div>
  )
}

// ── BucketCard ────────────────────────────────────────────────────────────────

function BucketCard({
  bucket,
  members,
  onAdded,
  onDeleted,
}: {
  bucket:    { value: Owner; label: string; color: string }
  members:   TeamMember[]
  onAdded:   (m: TeamMember) => void
  onDeleted: (id: string) => void
}) {
  return (
    <div className="card p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${bucket.color}`}>
          {bucket.label}
        </span>
        <span className="text-xs text-gray-400">
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Members */}
      {members.length === 0 && (
        <p className="text-xs text-gray-400 italic px-1">No one assigned yet.</p>
      )}
      <div className="space-y-1.5">
        {members.map(m => (
          <MemberCard key={m.id} member={m} onDeleted={onDeleted} />
        ))}
      </div>

      {/* Add form */}
      <AddMemberForm defaultBucket={bucket.value} onAdded={onAdded} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/team')
      .then(r => r.json())
      .then((data: TeamMember[]) => { setMembers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleAdded(member: TeamMember) {
    setMembers(prev => {
      const without = prev.filter(m => m.id !== member.id)
      return [...without, member].sort((a, b) =>
        a.owner_bucket.localeCompare(b.owner_bucket) || a.name.localeCompare(b.name)
      )
    })
  }

  function handleDeleted(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Assign people to each owner bucket. They&apos;ll receive email pings when tickets are approved.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BUCKETS.map(bucket => (
            <BucketCard
              key={bucket.value}
              bucket={bucket}
              members={members.filter(m => m.owner_bucket === bucket.value)}
              onAdded={handleAdded}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm font-medium text-blue-800 mb-1">Coming up: email pings</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Once you&apos;ve added your team here, approved tickets will automatically email the right people.
          Each person in the owner bucket will receive a summary of what was approved and what needs doing.
        </p>
      </div>

    </div>
  )
}
