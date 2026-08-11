'use client'

import { useState } from 'react'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

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
      <label className="block">
        <span className="text-sm font-semibold text-stone-800">Preferred currency</span>
        <select
          name="preferredCurrency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className={inputClass}
        >
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
          <option value="ILS">ILS</option>
        </select>
      </label>

      <DirectPaymentScheduleFields defaultValue={scheduleDefault} currency={currency} />
    </>
  )
}
