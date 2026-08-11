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
    <div>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="hidden" name="listingId" value={listingId} />
        <input
          name="calendarUrl"
          type="url"
          defaultValue={externalCalendarUrl || ''}
          placeholder="Paste iCal link (https://...)"
          className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Syncing...' : 'Save and sync'}
        </button>
      </form>

      {state.message ? (
        <p
          className={`mt-2 text-sm font-semibold ${
            state.status === 'success' ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <Link href="/help/calendar-sync" className="font-semibold text-[#c76f55] hover:underline">
          How to find your iCal URL →
        </Link>
        {calendarLastSyncedAt ? (
          <span>Last synced {new Date(calendarLastSyncedAt).toLocaleString('en-GB')}</span>
        ) : null}
        {externalCalendarUrl ? (
          <form action={formAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="calendarUrl" value="" />
            <button
              type="submit"
              disabled={pending}
              className="font-semibold text-stone-500 hover:text-stone-700 hover:underline disabled:opacity-60"
            >
              Disconnect
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
