import { BOOKING_TONE_CLASSES, type BookingLabel } from '@/lib/booking-display'

export function BookingBadge({ label, tone }: BookingLabel) {
  return (
    <span className={`inline-flex w-fit whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${BOOKING_TONE_CLASSES[tone]}`}>
      {label}
    </span>
  )
}
