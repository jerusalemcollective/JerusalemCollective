'use client'

import { useState } from 'react'

type DepositFieldsProps = {
  depositType: string
  depositValue: number
  balanceDueDays: number
  currency: string
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

// Plain deposit inputs (no <form> of their own) so they can live inside the main
// listing-edit form and save with the single "Save changes" button. The only
// interactivity is toggling the value label between % and a fixed amount.
export function DepositFields({
  depositType,
  depositValue,
  balanceDueDays,
  currency,
}: DepositFieldsProps) {
  const [type, setType] = useState(depositType === 'fixed' ? 'fixed' : 'percent')

  return (
    <div className="mt-6 border-t border-stone-100 pt-6">
      <h3 className="text-sm font-bold text-stone-950">Deposit and payment schedule</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        How much a guest pays now to book, and when the rest is due.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Deposit type</span>
          <select
            name="depositType"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={inputClass}
          >
            <option value="percent">Percentage of the total</option>
            <option value="fixed">Fixed amount ({currency})</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">
            {type === 'percent' ? 'Deposit (%)' : `Deposit amount (${currency})`}
          </span>
          <input
            name="depositValue"
            type="number"
            min="0"
            step={type === 'percent' ? '1' : '0.01'}
            max={type === 'percent' ? '100' : undefined}
            defaultValue={depositValue}
            className={inputClass}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-stone-800">Balance due before check-in (days)</span>
        <input
          name="balanceDueDays"
          type="number"
          min="0"
          max="365"
          defaultValue={balanceDueDays}
          className={inputClass}
        />
      </label>
    </div>
  )
}
