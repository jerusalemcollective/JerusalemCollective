'use client'

import { useSearchParams } from 'next/navigation'

export function PaymentCancelledBanner() {
  const cancelled = useSearchParams().get('payment') === 'cancelled'
  if (!cancelled) return null

  return (
    <div role="status" className="mx-auto max-w-6xl px-4 pt-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Payment cancelled — you weren’t charged. Your dates are still available if you’d like to try again.
      </div>
    </div>
  )
}
