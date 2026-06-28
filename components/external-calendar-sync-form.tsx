'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { saveExternalCalendarUrl } from '@/app/host/dashboard/listings/actions'

type ExternalCalendarSyncFormProps = {
  listingId: string
  externalCalendarUrl: string | null
  calendarLastSyncedAt: string | null
}

const initialState = {
  status: '',
  message: '',
}

export function ExternalCalendarSyncForm({
  listingId,
  externalCalendarUrl,
  calendarLastSyncedAt,
}: ExternalCalendarSyncFormProps) {
  const [state, formAction, pending] = useActionState(saveExternalCalendarUrl, initialState)

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">Calendar sync</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Paste your Google Calendar, Apple Calendar, Airbnb, or Booking.com iCal link here. We will check it every hour and block unavailable dates automatically.
      </p>
      <Link
        href="/help/calendar-sync"
        className="mt-3 inline-flex text-sm font-semibold text-[#c76f55] hover:underline"
      >
        How to find your iCal URL -&gt;
      </Link>

      {calendarLastSyncedAt ? (
        <p className="mt-4 text-xs font-semibold text-stone-500">
          Last synced: {new Date(calendarLastSyncedAt).toLocaleString('en-GB')}
        </p>
      ) : null}

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="listingId" value={listingId} />
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">iCal URL</span>
          <input
            name="calendarUrl"
            type="url"
            defaultValue={externalCalendarUrl || ''}
            placeholder="https://..."
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
          />
        </label>

        {state.message ? (
          <p
            className={`rounded-2xl p-3 text-sm font-semibold ${
              state.status === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Syncing...' : 'Save and sync'}
        </button>
      </form>

      {externalCalendarUrl ? (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="calendarUrl" value="" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Disconnect
          </button>
        </form>
      ) : null}
    </section>
  )
}
