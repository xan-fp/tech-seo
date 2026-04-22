'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  total: number
  draft: number
  approved: number
  rejected: number
  critical: number
  high: number
  medium: number
  low: number
  site_content: number
  copy_blog: number
  tech: number
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError('Could not load stats. Make sure the database is set up.'))
  }, [])

  if (error) {
    return (
      <div className="card p-6 border-red-200 bg-red-50">
        <p className="text-red-700 font-medium">{error}</p>
        <p className="text-sm text-red-600 mt-2">
          Visit <code className="bg-red-100 px-1 rounded">/api/db-setup</code> once to initialise the database, then refresh.
        </p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5 h-24 bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total} total tickets</p>
        </div>
        <Link href="/upload" className="btn-primary">
          + Upload Audit
        </Link>
      </div>

      {/* Status overview */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">By Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Draft"    value={Number(stats.draft)}    />
          <StatCard label="Approved" value={Number(stats.approved)} />
          <StatCard label="Rejected" value={Number(stats.rejected)} />
          <StatCard label="Total"    value={Number(stats.total)}    />
        </div>
      </section>

      {/* Severity breakdown */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">By Severity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-5 border-red-200">
            <p className="text-sm text-red-600 font-medium">Critical</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{Number(stats.critical)}</p>
          </div>
          <div className="card p-5 border-orange-200">
            <p className="text-sm text-orange-600 font-medium">High</p>
            <p className="text-3xl font-bold text-orange-700 mt-1">{Number(stats.high)}</p>
          </div>
          <div className="card p-5 border-yellow-200">
            <p className="text-sm text-yellow-600 font-medium">Medium</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{Number(stats.medium)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500 font-medium">Low</p>
            <p className="text-3xl font-bold text-gray-700 mt-1">{Number(stats.low)}</p>
          </div>
        </div>
      </section>

      {/* Owner breakdown */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">By Owner</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 border-purple-200">
            <p className="text-sm text-purple-600 font-medium">Site Content Lead</p>
            <p className="text-3xl font-bold text-purple-700 mt-1">{Number(stats.site_content)}</p>
          </div>
          <div className="card p-5 border-blue-200">
            <p className="text-sm text-blue-600 font-medium">Copy / Blog Lead</p>
            <p className="text-3xl font-bold text-blue-700 mt-1">{Number(stats.copy_blog)}</p>
          </div>
          <div className="card p-5 border-teal-200">
            <p className="text-sm text-teal-600 font-medium">Tech</p>
            <p className="text-3xl font-bold text-teal-700 mt-1">{Number(stats.tech)}</p>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="flex gap-3">
        <Link href="/review"  className="btn-secondary">Go to Review Queue →</Link>
        <Link href="/backlog" className="btn-secondary">Go to Backlog →</Link>
      </section>
    </div>
  )
}
