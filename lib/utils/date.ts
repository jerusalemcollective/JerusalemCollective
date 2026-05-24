export function formatDateDisplay(value?: string | null, fallback = 'TBC'): string {
  if (!value) return fallback

  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function hoursSince(value: string): number {
  return Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60))
}

export function formatWaitTime(createdAt: string | null, status: string): string | null {
  if (status !== 'new' || !createdAt) return null

  const hours = hoursSince(createdAt)
  if (hours < 1) return 'Sent just now'
  if (hours < 24) {
    return `Sent ${hours} hour${hours === 1 ? '' : 's'} ago — awaiting reply`
  }

  const days = Math.floor(hours / 24)
  return `Sent ${days} day${days === 1 ? '' : 's'} ago — awaiting reply`
}

export function shouldShowSimilarStaysLink(createdAt: string | null, status: string): boolean {
  if (status !== 'new' || !createdAt) return false
  return hoursSince(createdAt) >= 48
}
