import clsx from 'clsx'
import type { BacklogStatus } from '@/lib/types'

const styles: Record<BacklogStatus, string> = {
  needs_review:     'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved:         'bg-green-100 text-green-700 border-green-200',
  assigned:         'bg-blue-100 text-blue-700 border-blue-200',
  in_progress:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  fix_ready:        'bg-cyan-100 text-cyan-700 border-cyan-200',
  needs_validation: 'bg-orange-100 text-orange-700 border-orange-200',
  validated:        'bg-emerald-100 text-emerald-700 border-emerald-200',
  done:             'bg-gray-100 text-gray-600 border-gray-200',
  ignored:          'bg-red-50 text-red-400 border-red-200',
  reopened:         'bg-rose-100 text-rose-700 border-rose-200',
}

const display: Record<BacklogStatus, string> = {
  needs_review:     'Needs Review',
  approved:         'Approved',
  assigned:         'Assigned',
  in_progress:      'In Progress',
  fix_ready:        'Fix Ready',
  needs_validation: 'Needs Validation',
  validated:        'Validated',
  done:             'Done',
  ignored:          'Ignored',
  reopened:         'Reopened',
}

export default function StatusBadge({ status }: { status: BacklogStatus }) {
  const s = (status in styles) ? status : 'needs_review'
  return (
    <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium border', styles[s])}>
      {display[s]}
    </span>
  )
}
