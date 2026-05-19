type StatusBadgeScheme = 'support' | 'application' | 'enquiry'

type StatusBadgeProps = {
  status: string
  scheme: StatusBadgeScheme
}

export function StatusBadge({ status, scheme }: StatusBadgeProps) {
  const styles = getStatusStyles(status, scheme)

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${styles}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

function getStatusStyles(status: string, scheme: StatusBadgeScheme) {
  if (scheme === 'support') {
    return status === 'resolved'
      ? 'bg-green-100 text-green-700'
      : status === 'closed'
        ? 'bg-stone-100 text-stone-700'
        : status === 'under_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-rose-100 text-rose-700'
  }

  if (scheme === 'application') {
    return status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : status === 'in_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-stone-100 text-stone-700'
  }

  return status === 'accepted'
    ? 'bg-green-100 text-green-700'
    : status === 'declined'
      ? 'bg-red-100 text-red-700'
      : status === 'host_replied'
        ? 'bg-amber-100 text-amber-700'
        : status === 'closed'
          ? 'bg-stone-100 text-stone-700'
          : 'bg-[#fff4ef] text-[#c76f55]'
}
