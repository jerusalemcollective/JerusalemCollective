type StatusBadgeScheme = 'support' | 'application' | 'enquiry'

type StatusBadgeProps = {
  status: string
  scheme: StatusBadgeScheme
  // Plain words to show instead of the stored status (guest-facing pages).
  label?: string
}

// Booking requests are only shown to guests, so they always get plain words.
const ENQUIRY_STATUS_LABELS: Record<string, string> = {
  new: 'Request sent',
  host_replied: 'Host replied',
  accepted: 'Accepted',
  declined: 'Not available',
  closed: 'Closed',
}

// Plain words for a guest's own help requests.
export const GUEST_SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: 'Sent',
  under_review: 'We’re looking into it',
  waiting_on_guest: 'Waiting for you',
  waiting_on_host: 'Waiting for the host',
  resolved: 'Resolved',
  closed: 'Closed',
}

export function StatusBadge({ status, scheme, label }: StatusBadgeProps) {
  const styles = getStatusStyles(status, scheme)
  const text =
    label ?? (scheme === 'enquiry' ? ENQUIRY_STATUS_LABELS[status] : undefined) ?? status.replaceAll('_', ' ')

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${label || scheme === 'enquiry' ? '' : 'capitalize'} ${styles}`}>
      {text}
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
