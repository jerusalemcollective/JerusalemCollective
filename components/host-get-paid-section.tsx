'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StripeConnectCard } from '@/components/stripe-connect-card'
import { PayoutAccountFields } from '@/components/payout-account-fields'
import { type PayoutDetails } from '@/lib/direct-payment'

const CURRENCIES = ['USD', 'GBP', 'EUR', 'ILS']

// The whole "How you get paid" block. The host's own currency is set on their
// profile (not here); this block picks which OTHER currencies they also accept,
// and turns on either or both pay routes:
// "Through JLM · card" (accepts_jlm → Stripe payout) and "Paid directly · bank/Zelle"
// (accepts_direct → bank details). Each route's account setup appears ONLY when its
// box is ticked. Field name= attributes (payoutCurrencies, acceptsJlm,
// acceptsDirect, payoutMethod, payout*) are read by the
// updateHostPaymentPreferences action, which adds the profile currency itself.
export function HostGetPaidSection({
  payoutCurrenciesDefault,
  profileCurrency,
  jlmPaymentsEnabled,
  acceptsJlmDefault,
  directPaymentsEnabled,
  acceptsDirectDefault,
  stripe,
  payoutDefault,
  legacyMethod,
}: {
  payoutCurrenciesDefault: string[]
  // The host's currency, from their profile.
  profileCurrency: string
  jlmPaymentsEnabled: boolean
  acceptsJlmDefault: boolean
  directPaymentsEnabled: boolean
  acceptsDirectDefault: boolean
  stripe: { chargesEnabled: boolean; payoutsEnabled: boolean; hasAccount: boolean }
  payoutDefault: PayoutDetails | null
  legacyMethod?: string | null
}) {
  const otherCurrencies = CURRENCIES.filter((c) => c !== profileCurrency)
  const [accepted, setAccepted] = useState<string[]>(
    payoutCurrenciesDefault.filter((c) => otherCurrencies.includes(c)),
  )
  const [acceptsJlm, setAcceptsJlm] = useState(acceptsJlmDefault)
  const [acceptsDirect, setAcceptsDirect] = useState(acceptsDirectDefault)

  // Returning from Stripe onboarding (?connect=return|refresh) must mount the card
  // even if JLM is off, so its status-sync effect runs.
  const [connectReturn, setConnectReturn] = useState(false)
  useEffect(() => {
    setConnectReturn(new URLSearchParams(window.location.search).has('connect'))
  }, [])

  function toggleCurrency(code: string) {
    setAccepted((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  // Advisory only (admin display + future auto-payout readiness): which route the
  // host's payout leans on. JLM card payouts settle to Stripe; direct is manual bank.
  const payoutMethod = acceptsJlm ? 'stripe' : acceptsDirect ? 'manual' : ''
  const showStripe = acceptsJlm || connectReturn

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-stone-950">How you get paid</h2>

        <div className="mt-5">
          <p className="text-sm font-semibold text-stone-800">Other currencies you accept</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Your prices are in {profileCurrency}, set in your{' '}
            <Link href="/profile" className="font-semibold text-[#c76f55] hover:underline">
              profile
            </Link>
            . Guests can also pay in the currencies you tick here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCurrencies.map((code) => {
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
    </div>
  )
}
