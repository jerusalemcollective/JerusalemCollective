// Shared helpers for showing a booking in plain words (admin pages first).
//
// Real values in the schema:
//   bookings.status          pending | confirmed | cancelled | completed
//                            ('pending' = waiting for the guest's deposit, from
//                            the deposit-gated flow in 098/099)
//   bookings.payment_status  unpaid | deposit_received | paid_in_full | refunded
//   booking_requests.status  new | host_replied | accepted | declined | closed
//   booking_payments.payment_mode  platform_checkout | direct_to_host

export type BookingTone = 'green' | 'amber' | 'rose' | 'stone' | 'blue'

export type BookingLabel = { label: string; tone: BookingTone }

export const BOOKING_TONE_CLASSES: Record<BookingTone, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  stone: 'bg-stone-100 text-stone-600',
  blue: 'bg-sky-100 text-sky-700',
}

/** Today's date (YYYY-MM-DD) in Jerusalem, where every stay takes place. */
export function jerusalemToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

type StatusInput = {
  status?: string | null
  payment_status?: string | null
  check_in?: string | null
  check_out?: string | null
}

/** The booking's status in plain words, with a colour. */
export function bookingStatusLabel(booking: StatusInput, today: string = jerusalemToday()): BookingLabel {
  const status = (booking.status || '').toLowerCase()

  if (status === 'cancelled') {
    return booking.payment_status === 'refunded'
      ? { label: 'Cancelled · refunded', tone: 'rose' }
      : { label: 'Cancelled', tone: 'rose' }
  }
  if (status === 'pending') return { label: 'Pending payment', tone: 'amber' }
  if (status === 'completed') return { label: 'Completed', tone: 'stone' }
  if (status === 'confirmed') {
    if (booking.check_out && booking.check_out <= today) return { label: 'Completed', tone: 'stone' }
    if (booking.check_in && booking.check_in <= today) return { label: 'Staying now', tone: 'blue' }
    return { label: 'Confirmed', tone: 'green' }
  }
  if (!status) return { label: 'Unknown', tone: 'stone' }
  return { label: humanize(status), tone: 'stone' }
}

const PAYMENT_STATUS_LABELS: Record<string, BookingLabel> = {
  unpaid: { label: 'Not paid yet', tone: 'amber' },
  deposit_received: { label: 'Deposit received', tone: 'blue' },
  paid_in_full: { label: 'Paid in full', tone: 'green' },
  refunded: { label: 'Refunded', tone: 'rose' },
}

/** bookings.payment_status in plain words. */
export function paymentStatusLabel(paymentStatus?: string | null): BookingLabel {
  if (!paymentStatus) return PAYMENT_STATUS_LABELS.unpaid
  return PAYMENT_STATUS_LABELS[paymentStatus] || { label: humanize(paymentStatus), tone: 'stone' }
}

/** booking_payments.payment_mode in plain words. */
export function paymentMethodLabel(paymentMode?: string | null): string {
  if (paymentMode === 'platform_checkout') return 'Card through JLM'
  if (paymentMode === 'direct_to_host') return 'Transfer to host'
  return 'Paid to the host directly (no JLM payment recorded)'
}

const ENQUIRY_STATUS_LABELS: Record<string, BookingLabel> = {
  new: { label: 'Awaiting host', tone: 'amber' },
  host_replied: { label: 'Host replied', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'green' },
  declined: { label: 'Declined', tone: 'rose' },
  closed: { label: 'Closed', tone: 'stone' },
}

/**
 * What actually happened to an enquiry: the linked booking's state when there
 * is one ("Booked", "Cancelled", ...), otherwise the enquiry's own status.
 */
export function enquiryOutcomeLabel(
  requestStatus: string | null | undefined,
  booking: StatusInput | null | undefined,
  today: string = jerusalemToday(),
): BookingLabel {
  if (booking?.status) {
    const status = booking.status.toLowerCase()
    if (status === 'cancelled') return { label: 'Cancelled', tone: 'rose' }
    if (status === 'pending') return { label: 'Booked · pending payment', tone: 'amber' }
    const label = bookingStatusLabel(booking, today)
    if (label.label === 'Completed') return { label: 'Stayed', tone: 'stone' }
    if (label.label === 'Staying now') return label
    return { label: 'Booked', tone: 'green' }
  }
  const key = (requestStatus || '').toLowerCase()
  return ENQUIRY_STATUS_LABELS[key] || { label: key ? humanize(key) : 'Unknown', tone: 'stone' }
}

/** One date as "3 Mar 2026". Date-only values are read at midday to avoid TZ drift. */
export function formatStayDate(value?: string | null, fallback = 'Date not set'): string {
  if (!value) return fallback
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "3 – 7 Mar 2026", "28 Mar – 2 Apr 2026" or "28 Dec 2026 – 2 Jan 2027". */
export function formatDateRange(checkIn?: string | null, checkOut?: string | null): string {
  if (!checkIn && !checkOut) return 'Dates not set'
  if (!checkIn || !checkOut) return `${formatStayDate(checkIn, '?')} – ${formatStayDate(checkOut, '?')}`
  const start = new Date(`${checkIn.slice(0, 10)}T12:00:00`)
  const end = new Date(`${checkOut.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates not set'
  const endText = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${endText}`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${endText}`
  }
  return `${start.getDate()} – ${endText}`
}

/** Whole nights between check-in and check-out (0 when unknown). */
export function bookingNights(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0
  const start = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.round((end - start) / 86_400_000)
}

export function formatNights(nights: number): string {
  return nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '—'
}

export function formatGuestCount(guests?: number | null): string {
  const count = Math.max(1, Number(guests) || 1)
  return `${count} guest${count === 1 ? '' : 's'}`
}

/** The guest's display name, falling back through what we know about them. */
export function bookingGuestName(input: {
  full_name?: string | null
  guest_name?: string | null
  email?: string | null
}): string {
  const name = input.full_name?.trim() || input.guest_name?.trim()
  if (name) return name
  if (input.email?.trim()) return input.email.trim()
  return 'Guest'
}

/** An amount with its currency symbol, e.g. "$1,250" or "₪4,800". */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return '—'
  const code = (currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    }).format(Number(amount))
  } catch {
    return `${code} ${Number(amount).toLocaleString('en-US')}`
  }
}

type AmountInput = {
  total_amount_usd?: number | null
  total_amount_ils?: number | null
}

/**
 * The booking's stay total in one currency. bookings stores the total in USD
 * and/or ILS; prefer the currency the guest actually paid or the listing is
 * priced in, then USD, then ILS.
 */
export function bookingTotal(
  booking: AmountInput,
  preferredCurrency?: string | null,
): { amount: number; currency: 'USD' | 'ILS' } | null {
  const usd = booking.total_amount_usd
  const ils = booking.total_amount_ils
  const hasUsd = usd !== null && usd !== undefined
  const hasIls = ils !== null && ils !== undefined
  const preferred = (preferredCurrency || '').toUpperCase()
  if (preferred === 'ILS' && hasIls) return { amount: Number(ils), currency: 'ILS' }
  if (preferred === 'USD' && hasUsd) return { amount: Number(usd), currency: 'USD' }
  if (hasUsd) return { amount: Number(usd), currency: 'USD' }
  if (hasIls) return { amount: Number(ils), currency: 'ILS' }
  return null
}

export function formatBookingAmount(booking: AmountInput, preferredCurrency?: string | null): string {
  const total = bookingTotal(booking, preferredCurrency)
  return total ? formatMoney(total.amount, total.currency) : 'Not priced'
}

function humanize(value: string) {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
