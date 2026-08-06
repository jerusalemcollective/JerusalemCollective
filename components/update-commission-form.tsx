'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  updateCommissionSetting,
  type UpdateCommissionState,
} from '@/app/admin/settings/actions'

const initialState: UpdateCommissionState = {
  status: 'idle',
  message: '',
}

export function UpdateCommissionForm({
  currentValue,
}: {
  currentValue: string
}) {
  const [value, setValue] = useState(currentValue)
  const [state, formAction, pending] = useActionState(
    updateCommissionSetting,
    initialState,
  )

  useEffect(() => {
    if (state.status === 'success') {
      setValue(currentValue)
    }
  }, [currentValue, state.status])

  const hasChanged = value !== currentValue

  return (
    <form action={formAction} className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="block">
          <span className="sr-only">Commission percentage</span>
          <div className="relative w-28">
            <input
              type="number"
              name="commissionPercent"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              min="0"
              step="0.25"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 pr-8 text-right text-sm font-bold text-stone-950 outline-none transition focus:border-[#c76f55]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-500">
              %
            </span>
          </div>
        </label>

        <button
          type="submit"
          disabled={pending || !hasChanged}
          className="rounded-full bg-stone-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Update commission'}
        </button>
      </div>

      {state.message && (
        <p
          className={`mt-2 text-sm ${
            state.status === 'error' ? 'text-rose-600' : 'text-green-700'
          }`}
        >
          {state.message}
        </p>
      )}

      {hasChanged && (
        <p className="mt-2 text-xs text-amber-600">
          This applies only to new bookings from this point. Existing bookings keep their original rate.
        </p>
      )}

      {value === '0' && !hasChanged && (
        <p className="mt-2 text-xs text-stone-500">
          Platform is currently free for hosts. New bookings will show 0% commission.
        </p>
      )}
    </form>
  )
}
