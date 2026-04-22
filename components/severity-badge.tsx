import clsx from 'clsx'
import type { Severity } from '@/lib/types'

const styles: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-gray-100 text-gray-600 border-gray-200',
}

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={clsx('inline-block px-2 py-0.5 rounded text-xs font-medium border capitalize', styles[severity])}>
      {severity}
    </span>
  )
}
