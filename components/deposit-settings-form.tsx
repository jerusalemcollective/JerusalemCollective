'use client'

import { useActionState, useState } from 'react'
import { updateListingDepositSettings } from '@/app/host/dashboard/listings/actions'

type DepositSettingsFormProps = {
  listingId: string
  depositType: string
  depositValue: number
  balanceDueDays: number
  currency: string
}

const initialState = { status: '', message: '' }

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

export function DepositSettingsForm({
  listingId,
  depositType,
  depositValue,
  balanceDueDays,
  currency,
}: DepositSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateListingDepositSettings, initialState)
  const [type, setType] = useState(depositType === 'fixed' ? 'fixed' : 'percent')

  return (
    <form action={formAction} className="rounded-3xl bg-white p-6 shadow-sm">
      <input type="hidden" name="listingId" value={listingId} />
      <h2 className="text-lg font-bold text-stone-950">Deposit and payment schedule</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        Set how much a guest pays now to book, and when the rest is due. Guests pay the balance through the
        site on this schedule.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            required
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
        <span className="mt-1 block text-xs text-stone-500">
          0 means the balance is due on the check-in date. For example, 14 means two weeks before check-in.
        </span>
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save deposit settings'}
        </button>
        {state.message && (
          <p className={`text-sm ${state.status === 'success' ? 'text-green-700' : 'text-rose-600'}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
