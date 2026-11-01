'use client'

import { useActionState } from 'react'
import {
  deleteHostListing,
  setHostListingVisibility,
  type HostListingActionState,
} from '@/app/host/dashboard/listings/actions'

type HostListingVisibilityDeleteProps = {
  listingId: string
  isPublished: boolean
  // True when the stay has bookings or booking requests. The server checks
  // again before deleting; this only decides what to show.
  hasBookingHistory: boolean
}

const initialState: HostListingActionState = { status: 'idle', message: '' }

// The "Show on site / Hide from site" switch and the safe Delete for one stay.
export function HostListingVisibilityDelete({
  listingId,
  isPublished,
  hasBookingHistory,
}: HostListingVisibilityDeleteProps) {
  const [visibilityState, visibilityAction, visibilityPending] = useActionState<HostListingActionState, FormData>(
    setHostListingVisibility,
    initialState,
  )
  const [deleteState, deleteAction, deletePending] = useActionState<HostListingActionState, FormData>(
    deleteHostListing,
    initialState,
  )

  return (
    <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">Show or hide this stay</h2>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">
          {isPublished
            ? 'Your stay is showing on the site. Guests can find it and ask to book.'
            : 'Your stay is hidden. Guests cannot find it or book it until you show it again.'}
        </p>
        <form action={visibilityAction} className="shrink-0">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="value" value={isPublished ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={visibilityPending}
            className={`w-full rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-60 sm:w-auto ${
              isPublished
                ? 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50'
                : 'bg-[#252525] text-white hover:bg-[#111111]'
            }`}
          >
            {visibilityPending ? 'Saving...' : isPublished ? 'Hide from site' : 'Show on site'}
          </button>
        </form>
      </div>
      {visibilityState.message && (
        <p
          role="status"
          className={`mt-2 text-sm font-semibold ${
            visibilityState.status === 'success' ? 'text-green-700' : 'text-rose-600'
          }`}
        >
          {visibilityState.message}
        </p>
      )}

      <div className="mt-5 border-t border-stone-100 pt-5">
        <h3 className="text-sm font-bold text-stone-950">Delete listing</h3>
        {hasBookingHistory ? (
          <p className="mt-1 text-sm text-stone-600">
            This stay has bookings or booking requests, so it can&rsquo;t be deleted &mdash; your records depend
            on it. Use &ldquo;Hide from site&rdquo; above instead: it comes off the site straight away. Contact JLM
            if you need it removed completely.
          </p>
        ) : (
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-600">
              Permanently removes this stay and its photos. This cannot be undone.
            </p>
            <form
              action={deleteAction}
              className="shrink-0"
              onSubmit={(event) => {
                if (!window.confirm('Delete this stay permanently? This cannot be undone.')) {
                  event.preventDefault()
                }
              }}
            >
              <input type="hidden" name="listingId" value={listingId} />
              <button
                type="submit"
                disabled={deletePending}
                className="w-full rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 sm:w-auto"
              >
                {deletePending ? 'Deleting...' : 'Delete listing'}
              </button>
            </form>
          </div>
        )}
        {deleteState.status === 'error' && deleteState.message && (
          <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">
            {deleteState.message}
          </p>
        )}
      </div>
    </section>
  )
}
