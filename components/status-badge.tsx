import clsx from 'clsx'
import type { TicketStatus } from '@/lib/types'

const styles: Record<TicketStatus, string> = {
  draft:       'bg-gray-100 text-gray-600 border-gray-200',
  approved:    'bg-green-100 text-green-700 border-green-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  done:        'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected:    'bg-red-100 text-red-600 border-red-200',
}

const display: Record<TicketStatus, string> = {
  draft:       'Draft',
  approved:    'Approved',
  in_progress: 'In Progress',
  done:        'Done',
  rejected:    'Rejected',
}

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium border', styles[status])}>
      {display[status]}
    </span>
  )
}
