'use client'

import { removeUnavailableRange } from '@/app/host/dashboard/calendar/actions'

export function RemoveBlockedDateButton({ rangeId }: { rangeId: string }) {
  return (
    <form
      action={removeUnavailableRange}
      onSubmit={(event) => {
        if (
          !window.confirm(
            'Remove this blocked period? Guests will be able to book these dates again.',
          )
        ) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="rangeId" value={rangeId} />
      <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300">
        Remove
      </button>
    </form>
  )
}
