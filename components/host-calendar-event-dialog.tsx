'use client'

import { useActionState, useEffect, useTransition } from 'react'
import type { CalendarEvent } from './host-calendar-board'

type EditState = { ok?: boolean; error?: string }
type EditAction = (prev: EditState, formData: FormData) => Promise<EditState>
type RemoveAction = (formData: FormData) => void | Promise<void>

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

const KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  booking: 'Booking',
  request: 'Request',
  manual_booking: 'Manual booking',
  block: 'Blocked dates',
}

const inputClass = 'mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900'

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function nightsBetween(startISO: string, endExclusiveISO: string) {
  const start = new Date(`${startISO}T00:00:00`)
  const end = new Date(`${endExclusiveISO}T00:00:00`)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

type HostCalendarEventDialogProps = {
  event: CalendarEvent
  onClose: () => void
  updateBookingAction: EditAction
  updateRequestAction: EditAction
  removeRangeAction: RemoveAction
}

export function HostCalendarEventDialog({
  event,
  onClose,
  updateBookingAction,
  updateRequestAction,
  removeRangeAction,
}: HostCalendarEventDialogProps) {
  const isEditable = event.kind === 'booking' || event.kind === 'request'
  const editAction = event.kind === 'request' ? updateRequestAction : updateBookingAction
  const [state, formAction, pending] = useActionState(editAction, {})
  const [removePending, startRemove] = useTransition()

  useEffect(() => {
    if (state.ok) onClose()
  }, [state.ok, onClose])

  const nights = nightsBetween(event.start, event.endExclusive)

  function handleRemove() {
    const formData = new FormData()
    formData.set('rangeId', event.id)
    startRemove(async () => {
      await removeRangeAction(formData)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
              {KIND_LABEL[event.kind]}
            </p>
            <h2 className="mt-1 text-xl font-bold text-stone-950">
              {event.guestName || event.reason || event.listingTitle}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">{event.listingTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-bold text-stone-600 transition hover:border-stone-300"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Check-in</p>
            <p className="mt-1 font-semibold text-stone-900">{formatDate(event.start)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Check-out</p>
            <p className="mt-1 font-semibold text-stone-900">{formatDate(event.endExclusive)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Nights</p>
            <p className="mt-1 font-semibold text-stone-900">{nights}</p>
          </div>
          {event.guests != null && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Guests</p>
              <p className="mt-1 font-semibold text-stone-900">{event.guests}</p>
            </div>
          )}
        </div>

        {isEditable ? (
          <form action={formAction} className="mt-5">
            <input type="hidden" name={event.kind === 'request' ? 'requestId' : 'bookingId'} value={event.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-stone-600">
                Check-in
                <input type="date" name="checkIn" defaultValue={event.start} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Check-out
                <input type="date" name="checkOut" defaultValue={event.endExclusive} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Guests
                <input type="number" name="guests" min="1" defaultValue={event.guests ?? 1} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-stone-600">
                Status
                <select name="status" defaultValue={event.status ?? ''} className={inputClass}>
                  {(event.kind === 'request' ? REQUEST_STATUSES : BOOKING_STATUSES).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {state.error && <p className="mt-2 text-xs text-rose-600">{state.error}</p>}
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5">
            {event.reason && event.kind === 'block' && (
              <p className="text-sm text-stone-600">{event.reason}</p>
            )}
            {event.external ? (
              <p className="rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
                These dates come from a connected external calendar. Remove them in the source calendar, or
                disconnect the calendar under “Sync an external calendar”.
              </p>
            ) : event.removable ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removePending}
                  className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  {removePending ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
