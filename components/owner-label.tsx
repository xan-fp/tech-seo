import clsx from 'clsx'
import type { Owner } from '@/lib/types'

const labels: Record<Owner, string> = {
  site_content_lead: 'Site Content',
  copy_blog_lead:    'Copy / Blog',
  tech:              'Tech',
}

const styles: Record<Owner, string> = {
  site_content_lead: 'bg-purple-100 text-purple-700 border-purple-200',
  copy_blog_lead:    'bg-blue-100 text-blue-700 border-blue-200',
  tech:              'bg-teal-100 text-teal-700 border-teal-200',
}

interface Props {
  owner:        Owner
  reason?:      string | null
  needsReview?: boolean
}

export default function OwnerLabel({ owner, reason, needsReview }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={clsx(
            'inline-block px-2 py-0.5 rounded text-xs font-medium border',
            styles[owner],
          )}
        >
          {labels[owner]}
        </span>
        {needsReview && (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
            Needs review
          </span>
        )}
      </div>
      {reason && (
        <p className="text-[11px] text-gray-400 leading-snug max-w-[200px]">{reason}</p>
      )}
    </div>
  )
}
