'use client'

import { useEffect, useState } from 'react'
import { StripeConnectCard } from '@/components/stripe-connect-card'
import { PayoutAccountFields } from '@/components/payout-account-fields'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'
import { type PayoutDetails } from '@/lib/direct-payment'

type PayoutMethod = 'stripe' | 'manual'

// One "How you get paid" section: the host chooses Automatic (Stripe) or Manual
// (bank/Zelle). The manual account also feeds guest-direct display, so it shows
// whenever the method is manual OR the host accepts direct guest payment. The
// preferred currency stays visible for either route. All the field name= attributes
// (payoutMethod, preferredCurrency, acceptsDirect, payout*, deposit*) are read by
// the updateHostPaymentPreferences action.
export function HostGetPaidSection({
  initialMethod,
  stripe,
  directPaymentsEnabled,
  acceptsDirectDefault,
  initialCurrency,
  scheduleDefault,
  payoutDefault,
  legacyMethod,
}: {
  initialMethod: PayoutMethod
  stripe: { chargesEnabled: boolean; payoutsEnabled: boolean; hasAccount: boolean }
  directPaymentsEnabled: boolean
  acceptsDirectDefault: boolean
  initialCurrency: string
  scheduleDefault: string | null | undefined
  payoutDefault: PayoutDetails | null
  legacyMethod?: string | null
}) {
  const [method, setMethod] = useState<PayoutMethod>(initialMethod)
  const [currency, setCurrency] = useState(initialCurrency)
  const [acceptsDirect, setAcceptsDirect] = useState(acceptsDirectDefault)
  // Returning from Stripe onboarding (?connect=return|refresh) must mount the card
  // even if the stored method is manual, so its status-sync effect runs.
  const [connectReturn, setConnectReturn] = useState(false)
  useEffect(() => {
    setConnectReturn(new URLSearchParams(window.location.search).has('connect'))
  }, [])

  const showStripe = method === 'stripe' || connectReturn
  const showManual = method === 'manual' || acceptsDirect

  return (
    <div className="space-y-5">
      <div>
        <p className="font-bold text-stone-950">How you get paid</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { value: 'stripe', label: 'Automatic (Stripe)' },
            { value: 'manual', label: 'Manual (bank transfer or Zelle)' },
          ] as const).map((option) => {
            const active = method === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setMethod(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-[#c76f55] text-white'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <input type="hidden" name="payoutMethod" value={method} />
      </div>

      {showStripe && (
        <StripeConnectCard
          chargesEnabled={stripe.chargesEnabled}
          payoutsEnabled={stripe.payoutsEnabled}
          hasAccount={stripe.hasAccount}
        />
      )}

      {showManual && (
        <div>
          <p className="text-sm font-semibold text-stone-800">Your payout account</p>
          <PayoutAccountFields payoutDefault={payoutDefault} legacyMethod={legacyMethod} />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <span className="text-sm font-semibold text-stone-800">Preferred currency</span>
        <button
          type="button"
          onClick={() => {
            const order = ['USD', 'GBP', 'EUR', 'ILS']
            setCurrency(order[(order.indexOf(currency) + 1) % order.length])
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-bold text-stone-900 transition hover:border-[#c76f55] hover:bg-stone-50"
          title="Click to switch currency"
          aria-label={`Preferred currency ${currency}. Click to switch.`}
        >
          {currency}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-stone-400" aria-hidden="true">
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </button>
        <input type="hidden" name="preferredCurrency" value={currency} />
      </div>

      <DirectPaymentScheduleFields defaultValue={scheduleDefault} currency={currency} />

      <div className="border-t border-stone-200 pt-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="acceptsDirect"
            checked={acceptsDirect}
            disabled={!directPaymentsEnabled}
            onChange={(event) => setAcceptsDirect(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-bold text-stone-950">Accept direct payment from guests</span>
            <span className="mt-1 block text-sm leading-6 text-stone-600">
              Offer a host-direct route where the guest pays you into your payout account above.
            </span>
            {!directPaymentsEnabled && (
              <span className="mt-2 block rounded-xl bg-white px-3 py-2 text-xs font-semibold text-amber-700">
                Direct-to-host payments are currently paused by JLM Collective.
              </span>
            )}
          </span>
        </label>
      </div>
    </div>
  )
}
