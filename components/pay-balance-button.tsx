'use client'

import { useState } from 'react'

type PayBalanceButtonProps = {
  bookingPaymentId: string
  label: string
}

export function PayBalanceButton({ bookingPaymentId, label }: PayBalanceButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/pay-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingPaymentId }),
      })
      const data = (await response.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !data.checkoutUrl) {
        setError(data.error || 'Could not start the payment. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setError('Could not start the payment. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-[#c76f55] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#b35f47] disabled:opacity-60"
      >
        {loading ? 'Starting…' : label}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
