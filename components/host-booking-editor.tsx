'use client'

import { useActionState } from 'react'

type EditState = { ok?: boolean; error?: string }
type EditAction = (prev: EditState, formData: FormData) => Promise<EditState>

export type EditableBooking = {
  id: string
  listingTitle: string
  guestName: string | null
  checkIn: string
  checkOut: string
  guests: number
  status: string
}

const BOOKING_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const REQUEST_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'host_replied', label: 'Replied' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'closed', label: 'Closed' },
]

const inputClass = 'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900'

function EditRow({
  item,
  idField,
  statuses,
  action,
}: {
  item: EditableBooking
  idField: 'bookingId' | 'requestId'
  statuses: { value: string; label: string }[]
  action: EditAction
}) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-stone-950">{item.listingTitle}</p>
        <p className="text-sm text-stone-500">{item.guestName || 'Guest'}</p>
      </div>
      <input type="hidden" name={idField} value={item.id} />
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_0.6fr_0.9fr_auto] sm:items-end">
        <label className="block text-xs font-semibold text-stone-600">
          Check-in
          <input type="date" name="checkIn" defaultValue={item.checkIn} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Check-out
          <input type="date" name="checkOut" defaultValue={item.checkOut} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Guests
          <input type="number" name="guests" min="1" defaultValue={item.guests} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Status
          <select name="status" defaultValue={item.status} className={inputClass}>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#252525] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs font-semibold text-green-700">Saved.</p>}
    </form>
  )
}

export function HostBookingEditor({
  bookings,
  requests,
  updateBookingAction,
  updateRequestAction,
}: {
  bookings: EditableBooking[]
  requests: EditableBooking[]
  updateBookingAction: EditAction
  updateRequestAction: EditAction
}) {
  if (bookings.length === 0 && requests.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-stone-500">
        Bookings and requests will appear here.
      </div>
    )
  }

  return (
    <div>
      {bookings.length > 0 && (
        <div className="divide-y divide-stone-100">
          {bookings.map((booking) => (
            <EditRow
              key={booking.id}
              item={booking}
              idField="bookingId"
              statuses={BOOKING_STATUSES}
              action={updateBookingAction}
            />
          ))}
        </div>
      )}
      {requests.length > 0 && (
        <>
          <div className="border-y border-stone-100 bg-stone-50 px-6 py-2 text-xs font-bold uppercase tracking-widest text-stone-500">
            Requests and enquiries
          </div>
          <div className="divide-y divide-stone-100">
            {requests.map((request) => (
              <EditRow
                key={request.id}
                item={request}
                idField="requestId"
                statuses={REQUEST_STATUSES}
                action={updateRequestAction}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
