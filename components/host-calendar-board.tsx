'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatDateISO } from '@/lib/utils/date'
import { HostCalendarEventDialog } from '@/components/host-calendar-event-dialog'

type ListingOption = { id: string; title: string }

type EditState = { ok?: boolean; error?: string }
type EditAction = (prev: EditState, formData: FormData) => Promise<EditState>
type RemoveAction = (formData: FormData) => void | Promise<void>

export type CalendarEventKind = 'booking' | 'request' | 'manual_booking' | 'block'

export type CalendarEvent = {
  id: string
  kind: CalendarEventKind
  listingId: string
  listingTitle: string
  start: string // inclusive check-in / block start
  endExclusive: string // checkout / block end (exclusive)
  guestName: string | null
  guests: number | null
  status: string | null
  reason: string | null
  removable: boolean
  external: boolean
}

type HostCalendarBoardProps = {
  listings: ListingOption[]
  events: CalendarEvent[]
  saveAction: (formData: FormData) => void
  updateBookingAction: EditAction
  updateRequestAction: EditAction
  removeRangeAction: RemoveAction
}

// Expand a half-open [start, endExclusive) date range into one Date per day.
function expandDays(startISO: string, endExclusiveISO: string): Date[] {
  const out: Date[] = []
  const cursor = new Date(`${startISO}T00:00:00`)
  const end = new Date(`${endExclusiveISO}T00:00:00`)
  while (cursor < end) {
    out.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function HostCalendarBoard({
  listings,
  events,
  saveAction,
  updateBookingAction,
  updateRequestAction,
  removeRangeAction,
}: HostCalendarBoardProps) {
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || '')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [showBooking, setShowBooking] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // A day that belongs to an event opens its details; suppress the range-select
  // that the same click would otherwise trigger.
  const suppressSelectRef = useRef(false)

  const { bookedDays, pendingDays, blockedDays, requestDays, eventByDay } = useMemo(() => {
    const booked: Date[] = []
    const pending: Date[] = []
    const blocked: Date[] = []
    const request: Date[] = []
    const map = new Map<string, CalendarEvent>()

    for (const event of events) {
      if (event.listingId !== selectedListingId) continue
      const days = expandDays(event.start, event.endExclusive)
      for (const day of days) {
        const iso = formatDateISO(day)
        if (!map.has(iso)) map.set(iso, event)
      }
      if (event.kind === 'booking') {
        if (event.status === 'pending') pending.push(...days)
        else booked.push(...days)
      } else if (event.kind === 'manual_booking') {
        booked.push(...days)
      } else if (event.kind === 'request') {
        request.push(...days)
      } else {
        blocked.push(...days)
      }
    }

    return { bookedDays: booked, pendingDays: pending, blockedDays: blocked, requestDays: request, eventByDay: map }
  }, [events, selectedListingId])

  const selectedRange: DayPickerDateRange | undefined = dateRange.from
    ? { from: dateRange.from, to: dateRange.to }
    : undefined

  const startISO = dateRange.from ? formatDateISO(dateRange.from) : ''
  const endISO = dateRange.to ? formatDateISO(dateRange.to) : ''
  const hasRange = Boolean(selectedListingId && startISO && endISO)

  const clearSelection = () => {
    setDateRange({})
    setShowBooking(false)
    setGuestName('')
    setError(null)
  }

  const submit = (kind: 'block' | 'booking') => {
    if (!hasRange) return
    if (kind === 'booking' && !guestName.trim()) return

    // Immediate no-double-booking feedback: the DB rejects an overlap too, but
    // that error is swallowed by the transition, so check here for a clear message.
    const overlaps = events.some(
      (event) => event.listingId === selectedListingId && event.start < endISO && event.endExclusive > startISO,
    )
    if (overlaps) {
      setError('Those dates overlap an existing booking or block. Pick free dates.')
      return
    }
    setError(null)

    const formData = new FormData()
    formData.set('mode', kind)
    formData.set('listingId', selectedListingId)
    formData.set('startDate', startISO)
    formData.set('endDate', endISO)
    if (kind === 'booking') formData.set('guestName', guestName.trim())

    startTransition(async () => {
      try {
        await saveAction(formData)
        clearSelection()
      } catch {
        setError('Could not save — those dates may already be taken.')
      }
    })
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Availability</p>
          <h2 className="mt-1 text-2xl font-bold text-stone-950">Calendar</h2>
        </div>
        {listings.length > 1 && (
          <select
            value={selectedListingId}
            onChange={(event) => {
              setSelectedListingId(event.target.value)
              clearSelection()
            }}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900"
          >
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4">
        <Calendar
          mode="range"
          selected={selectedRange}
          onDayClick={(day) => {
            const event = eventByDay.get(formatDateISO(day))
            if (event) {
              suppressSelectRef.current = true
              setActiveEvent(event)
            }
          }}
          onSelect={(range) => {
            if (suppressSelectRef.current) {
              suppressSelectRef.current = false
              return
            }
            if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
              setDateRange({ from: range.from, to: undefined })
              return
            }
            setDateRange(range || {})
          }}
          numberOfMonths={1}
          disabled={{ before: new Date() }}
          showOutsideDays={false}
          className="mx-auto [--cell-size:3.1rem]"
          modifiers={{ booked: bookedDays, pending: pendingDays, blocked: blockedDays, request: requestDays }}
          modifiersClassNames={{
            booked: '[&_button]:bg-green-100 [&_button]:text-green-900',
            pending: '[&_button]:bg-amber-100 [&_button]:text-amber-900',
            blocked: '[&_button]:bg-stone-200 [&_button]:text-stone-500',
            request: '[&_button]:bg-sky-100 [&_button]:text-sky-900',
          }}
        />
      </div>

      {hasRange && (
        <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-stone-900">
              {formatDisplayDate(dateRange.from!)} — {formatDisplayDate(dateRange.to!)}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-full px-4 py-2 text-sm font-semibold text-stone-600 transition hover:text-stone-900"
              >
                Clear
              </button>
              {!showBooking && (
                <button
                  type="button"
                  onClick={() => setShowBooking(true)}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-white"
                >
                  Record a booking
                </button>
              )}
              <button
                type="button"
                onClick={() => submit('block')}
                disabled={pending}
                className="rounded-full bg-[#252525] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Block these dates'}
              </button>
            </div>
          </div>

          {error && <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p>}

          {showBooking && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Guest name"
                className="min-w-[200px] flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
              />
              <button
                type="button"
                onClick={() => submit('booking')}
                disabled={pending || !guestName.trim()}
                className="rounded-full bg-green-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save booking'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-stone-600">
        <LegendDot className="bg-green-200" label="Confirmed / booked" />
        <LegendDot className="bg-amber-200" label="Pending" />
        <LegendDot className="bg-sky-200" label="Request" />
        <LegendDot className="bg-stone-300" label="Blocked" />
        <LegendDot className="bg-[#fff3df] ring-1 ring-[#efd28c]" label="Chag" />
      </div>

      {activeEvent && (
        <HostCalendarEventDialog
          key={activeEvent.id}
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
          updateBookingAction={updateBookingAction}
          updateRequestAction={updateRequestAction}
          removeRangeAction={removeRangeAction}
        />
      )}
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}
