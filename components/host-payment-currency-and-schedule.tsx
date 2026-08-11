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
      <div>
        <span className="text-sm font-semibold text-stone-800">Preferred currency</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {['USD', 'GBP', 'EUR', 'ILS'].map((option) => {
            const active = currency === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => setCurrency(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-[#c76f55] text-white'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
        <input type="hidden" name="preferredCurrency" value={currency} />
      </div>

      <DirectPaymentScheduleFields defaultValue={scheduleDefault} currency={currency} />
    </>
  )
}
