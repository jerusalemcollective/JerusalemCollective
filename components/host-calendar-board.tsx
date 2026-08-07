'use client'

import { useMemo, useRef, useState } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate } from '@/lib/hebrew-date'
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
  const [mode, setMode] = useState<'block' | 'booking'>('block')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [reason, setReason] = useState('')
  const [guestName, setGuestName] = useState('')
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  // When a day belonging to an event is clicked we open its details; suppress the
  // range-selection that the same click would otherwise trigger.
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
  const canSave = Boolean(selectedListingId && startISO && endISO)

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Availability</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-950">Manage the calendar</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Click a booking to see its details, or select an empty range to block it off or record a booking.
          </p>

          <label className="mt-5 block text-sm font-semibold text-stone-700">
            Stay
            <select
              value={selectedListingId}
              onChange={(event) => setSelectedListingId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
            >
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#F8F5F2] p-1">
            {(['block', 'booking'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  mode === m ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {m === 'block' ? 'Block dates' : 'Add booking'}
              </button>
            ))}
          </div>

          <form action={saveAction} className="mt-4">
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="listingId" value={selectedListingId} />
            <input type="hidden" name="startDate" value={startISO} />
            <input type="hidden" name="endDate" value={endISO} />

            {mode === 'booking' ? (
              <label className="block text-sm font-semibold text-stone-700">
                Guest name
                <input
                  name="guestName"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Who is this booking for?"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
                />
              </label>
            ) : (
              <label className="block text-sm font-semibold text-stone-700">
                Reason
                <input
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional note"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
                />
              </label>
            )}

            <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                {mode === 'booking' ? 'Check-in — check-out' : 'Selected dates'}
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                {dateRange.from ? formatDisplayDate(dateRange.from) : 'Choose a start date'}
                {' — '}
                {dateRange.to ? formatDisplayDate(dateRange.to) : 'choose an end date'}
              </p>
              {(dateRange.from || dateRange.to) && (
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {dateRange.from ? formatHebrewShortDate(dateRange.from) : 'Hebrew start'}
                  {' — '}
                  {dateRange.to ? formatHebrewShortDate(dateRange.to) : 'Hebrew end'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSave}
              className="mt-4 w-full rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === 'booking' ? 'Add booking' : 'Block these dates'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3 text-xs font-medium text-stone-600">
            <LegendDot className="bg-green-200" label="Confirmed / booked" />
            <LegendDot className="bg-amber-200" label="Pending" />
            <LegendDot className="bg-sky-200" label="Request" />
            <LegendDot className="bg-stone-300" label="Blocked" />
            <LegendDot className="bg-[#fff3df] ring-1 ring-[#efd28c]" label="Chag" />
          </div>
        </div>

        {/* Calendar */}
        <div className="overflow-x-auto rounded-3xl bg-[#faf8f6] p-3 md:p-4">
          <div className="rounded-2xl bg-white p-3 md:p-4">
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
              numberOfMonths={2}
              disabled={{ before: new Date() }}
              showOutsideDays={false}
              className="mx-auto w-full [--cell-size:2.6rem] md:[--cell-size:2.9rem]"
              modifiers={{ booked: bookedDays, pending: pendingDays, blocked: blockedDays, request: requestDays }}
              modifiersClassNames={{
                booked: '[&_button]:bg-green-100 [&_button]:text-green-900',
                pending: '[&_button]:bg-amber-100 [&_button]:text-amber-900',
                blocked: '[&_button]:bg-stone-200 [&_button]:text-stone-500',
                request: '[&_button]:bg-sky-100 [&_button]:text-sky-900',
              }}
            />
          </div>
        </div>
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
