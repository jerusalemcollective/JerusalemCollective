'use client'

import { useEffect, useState } from 'react'
import { StripeConnectCard } from '@/components/stripe-connect-card'
import { PayoutAccountFields } from '@/components/payout-account-fields'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'
import { type PayoutDetails } from '@/lib/direct-payment'

const CURRENCIES = ['USD', 'GBP', 'EUR', 'ILS']

// The whole "How you get paid" + "Payment schedule" block. The host picks which
// currencies they accept, a preferred one, and turns on either or both pay routes:
// "Through JLM · card" (accepts_jlm → Stripe payout) and "Paid directly · bank/Zelle"
// (accepts_direct → bank details). Each route's account setup appears ONLY when its
// box is ticked. Field name= attributes (payoutCurrencies, preferredCurrency,
// acceptsJlm, acceptsDirect, payoutMethod, payout*, deposit*) are read by the
// updateHostPaymentPreferences action.
export function HostGetPaidSection({
  payoutCurrenciesDefault,
  initialCurrency,
  jlmPaymentsEnabled,
  acceptsJlmDefault,
  directPaymentsEnabled,
  acceptsDirectDefault,
  stripe,
  payoutDefault,
  legacyMethod,
  scheduleDefault,
}: {
  payoutCurrenciesDefault: string[]
  initialCurrency: string
  jlmPaymentsEnabled: boolean
  acceptsJlmDefault: boolean
  directPaymentsEnabled: boolean
  acceptsDirectDefault: boolean
  stripe: { chargesEnabled: boolean; payoutsEnabled: boolean; hasAccount: boolean }
  payoutDefault: PayoutDetails | null
  legacyMethod?: string | null
  scheduleDefault: string | null | undefined
}) {
  const [accepted, setAccepted] = useState<string[]>(
    payoutCurrenciesDefault.filter((c) => CURRENCIES.includes(c)),
  )
  const [currency, setCurrency] = useState(initialCurrency)
  const [acceptsJlm, setAcceptsJlm] = useState(acceptsJlmDefault)
  const [acceptsDirect, setAcceptsDirect] = useState(acceptsDirectDefault)

  // Returning from Stripe onboarding (?connect=return|refresh) must mount the card
  // even if JLM is off, so its status-sync effect runs.
  const [connectReturn, setConnectReturn] = useState(false)
  useEffect(() => {
    setConnectReturn(new URLSearchParams(window.location.search).has('connect'))
  }, [])

  function toggleCurrency(code: string) {
    setAccepted((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
      // Keep the preferred currency valid: if it just got removed, fall back to the
      // first still-accepted one.
      if (!next.includes(currency) && next.length > 0) setCurrency(next[0])
      return next
    })
  }

  function cycleCurrency() {
    const pool = accepted.length > 0 ? accepted : CURRENCIES
    setCurrency(pool[(pool.indexOf(currency) + 1) % pool.length])
  }

  // Advisory only (admin display + future auto-payout readiness): which route the
  // host's payout leans on. JLM card payouts settle to Stripe; direct is manual bank.
  const payoutMethod = acceptsJlm ? 'stripe' : acceptsDirect ? 'manual' : ''
  const showStripe = acceptsJlm || connectReturn

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-stone-950">How you get paid</h2>

        <div className="mt-5">
          <p className="text-sm font-semibold text-stone-800">Currencies you accept</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CURRENCIES.map((code) => {
              const on = accepted.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleCurrency(code)}
                  aria-pressed={on}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? 'bg-[#c76f55] text-white'
                      : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {code}
                </button>
              )
            })}
          </div>
          {accepted.map((code) => (
            <input key={code} type="hidden" name="payoutCurrencies" value={code} />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-semibold text-stone-800">Preferred currency</span>
          <button
            type="button"
            onClick={cycleCurrency}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-bold text-stone-900 transition hover:border-[#c76f55] hover:bg-stone-50"
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

        <div className="mt-6">
          <p className="text-sm font-semibold text-stone-800">How guests pay you</p>
          <div className="mt-2 space-y-2.5">
            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  name="acceptsJlm"
                  checked={acceptsJlm}
                  disabled={!jlmPaymentsEnabled}
                  onChange={(event) => setAcceptsJlm(event.target.checked)}
                />
                <span className="font-semibold text-stone-900">Through JLM · card</span>
              </label>
              {showStripe && (
                <div className="border-t border-stone-100 px-4 pb-4 pt-2">
                  <StripeConnectCard
                    chargesEnabled={stripe.chargesEnabled}
                    payoutsEnabled={stripe.payoutsEnabled}
                    hasAccount={stripe.hasAccount}
                  />
                </div>
              )}
              {!jlmPaymentsEnabled && (
                <p className="border-t border-stone-100 px-4 py-2 text-xs font-semibold text-amber-700">
                  JLM card payments are currently paused by JLM Collective.
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200">
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  name="acceptsDirect"
                  checked={acceptsDirect}
                  disabled={!directPaymentsEnabled}
                  onChange={(event) => setAcceptsDirect(event.target.checked)}
                />
                <span className="font-semibold text-stone-900">Paid directly · bank or Zelle</span>
              </label>
              {/* Kept mounted (only hidden) when unticked so a host's saved bank
                  details aren't wiped on save — JLM still needs them for manual
                  payout. They only ever appear when the box is ticked. */}
              <div className={`border-t border-stone-100 px-4 pb-4 pt-2 ${acceptsDirect ? '' : 'hidden'}`}>
                <PayoutAccountFields payoutDefault={payoutDefault} legacyMethod={legacyMethod} />
              </div>
              {!directPaymentsEnabled && (
                <p className="border-t border-stone-100 px-4 py-2 text-xs font-semibold text-amber-700">
                  Direct-to-host payments are currently paused by JLM Collective.
                </p>
              )}
            </div>
          </div>
          <input type="hidden" name="payoutMethod" value={payoutMethod} />
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-stone-950">Payment schedule</h2>
        <div className="mt-4">
          <DirectPaymentScheduleFields defaultValue={scheduleDefault} currency={currency} />
        </div>
      </div>
    </div>
  )
}
