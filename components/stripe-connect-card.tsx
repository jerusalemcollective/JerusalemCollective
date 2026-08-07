'use client'

import { useEffect, useState } from 'react'

type StripeConnectCardProps = {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  hasAccount: boolean
}

export function StripeConnectCard({ chargesEnabled, payoutsEnabled, hasAccount }: StripeConnectCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const ready = chargesEnabled && payoutsEnabled

  // Just returned from Stripe's onboarding (return_url adds ?connect=return):
  // pull the latest account status, then reload cleanly so the card reflects it.
  // This is what makes onboarding work without a webhook configured.
  useEffect(() => {
    const connect = new URLSearchParams(window.location.search).get('connect')
    if (connect !== 'return' && connect !== 'refresh') return
    setSyncing(true)
    void fetch('/api/stripe/connect/refresh', { method: 'POST' })
      .catch(() => {})
      .finally(() => window.location.replace('/host/dashboard/payments'))
  }, [])

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect/start', { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start Stripe onboarding. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not start Stripe onboarding. Please try again.')
      setLoading(false)
    }
  }

  return (
    <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-stone-950">Get paid by Stripe</h2>
      {syncing ? (
        <p className="mt-2 text-sm text-stone-600">Checking your Stripe status…</p>
      ) : ready ? (
        <p className="mt-2 text-sm text-green-700">Your Stripe payout account is connected and ready.</p>
      ) : (
        <p className="mt-2 text-sm text-stone-600">
          {hasAccount
            ? 'Your Stripe account needs a few more details before payouts can be enabled.'
            : 'Connect a Stripe account to receive payouts directly.'}
        </p>
      )}
      {!ready && !syncing && (
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="mt-4 rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
        >
          {loading ? 'Starting…' : hasAccount ? 'Continue Stripe setup' : 'Set up Stripe payouts'}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </section>
  )
}
