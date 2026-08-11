'use client'

import { useState } from 'react'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'

// Keeps the preferred currency and the direct-payment schedule together so the
// schedule's currency labels follow the host's selection live — no default is
// forced; whatever the host picks is what the amounts are shown in. The fields are
// always editable here; the guest email + booking summary already gate on the
// accepts_direct_payment flag, so guests never see these unless the host opts in.
export function HostPaymentCurrencyAndSchedule({
  initialCurrency,
  scheduleDefault,
}: {
  initialCurrency: string
  scheduleDefault: string | null | undefined
}) {
  const [currency, setCurrency] = useState(initialCurrency)

  return (
    <>
      <div className="flex items-center gap-2">
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
    </>
  )
}
