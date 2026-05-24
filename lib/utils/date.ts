export function formatWaitTime(
  createdAt: string | null,
  status: string,
): string | null {
  if (status !== 'new' || !createdAt) return null
  const hours = Math.floor(
    (Date.now() -
      new Date(createdAt).getTime()) /
      (1000 * 60 * 60),
  )
  if (hours < 1) return 'Sent just now'
  if (hours < 24) {
    return `Sent ${hours} hour${hours === 1 ? '' : 's'} ago — awaiting reply`
  }
  const days = Math.floor(hours / 24)
  return `Sent ${days} day${days === 1 ? '' : 's'} ago — awaiting reply`
}

export function shouldShowSimilarStaysLink(
  createdAt: string | null,
  status: string,
): boolean {
  if (status !== 'new' || !createdAt) return false
  const hours = Math.floor(
    (Date.now() -
      new Date(createdAt).getTime()) /
      (1000 * 60 * 60),
  )
  return hours >= 48
}

export function formatDateDisplay(
  date: Date,
): string
export function formatDateDisplay(
  value?: string | null,
  fallback?: string,
): string
export function formatDateDisplay(
  value?: Date | string | null,
  fallback = 'TBC',
): string {
  if (!value) return fallback

  if (value instanceof Date) {
    return value.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return formatBookingDate(value)
}

export function formatDateISO(
  date: Date,
): string {
  return date.toISOString().slice(0, 10)
}

export function formatBookingDate(
  value?: string | null,
): string {
  if (!value) return 'TBC'
  return new Date(
    `${value}T12:00:00`,
  ).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
