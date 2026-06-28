'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelBooking } from './actions'

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          'Cancel this booking? For paid stays, please contact the host about a refund.',
        )
        if (!confirmed) return
        startTransition(async () => {
          const result = await cancelBooking(bookingId)
          if (result.ok) {
            toast.success('Booking cancelled')
          } else {
            toast.error(result.error || 'Could not cancel booking')
          }
        })
      }}
      className="text-xs font-semibold text-red-600 transition hover:underline disabled:opacity-50"
    >
      {isPending ? 'Cancelling…' : 'Cancel booking'}
    </button>
  )
}
