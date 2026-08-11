'use client'

import { useEffect, useState } from 'react'
import { DirectPaymentScheduleFields } from '@/components/direct-payment-schedule-fields'

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

// Keeps the preferred currency and the direct-payment schedule together so the
// schedule's currency labels follow the host's selection live — no default is
// forced; whatever the host picks is what the amounts are shown in.
export function HostPaymentCurrencyAndSchedule({
  initialCurrency,
  scheduleDefault,
  defaultAcceptsDirect,
}: {
  initialCurrency: string
  scheduleDefault: string | null | undefined
  defaultAcceptsDirect: boolean
}) {
  const [currency, setCurrency] = useState(initialCurrency)

  // The deposit schedule + payout details only apply when the host ticks
  // "Accept direct payment to me". That checkbox is rendered separately in the form
  // (above this block), so mirror its state from the DOM and only show these fields
  // while it's ticked — unticked, they're not shown here (and the read paths already
  // gate the guest email + booking summary on the same accepts_direct flag).
  const [acceptsDirect, setAcceptsDirect] = useState(defaultAcceptsDirect)
  useEffect(() => {
    const checkbox = document.querySelector<HTMLInputElement>('input[name="acceptsDirect"]')
    if (!checkbox) return
    const sync = () => setAcceptsDirect(checkbox.checked)
    sync()
    checkbox.addEventListener('change', sync)
    return () => checkbox.removeEventListener('change', sync)
  }, [])

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

      {acceptsDirect && (
        <DirectPaymentScheduleFields defaultValue={scheduleDefault} currency={currency} />
      )}
    </>
  )
}
