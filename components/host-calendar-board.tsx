'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatDateISO } from '@/lib/utils/date'
import { formatHebrewDay, formatHebrewMonthSpan } from '@/lib/hebrew-date'
import { getDayJudaica } from '@/lib/hebcal'
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
  guestEmail?: string | null
  guestPhone?: string | null
  notes?: string | null
}

type HostCalendarBoardProps = {
  listings: ListingOption[]
  events: CalendarEvent[]
  saveAction: (formData: FormData) => void
  updateBookingAction: EditAction
  updateRequestAction: EditAction
  acceptRequestAction: EditAction
  removeRangeAction: RemoveAction
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Sentinel for the combined "every listing" view. Not a real listing id.
const ALL_LISTINGS = '__all__'

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// Pill colour + primary label for an event on the grid.
// title = who (guest name); subtitle = which listing they are staying in. Status
// is carried by the pill colour + the legend, so the listing name is free to sit
// underneath on every event.
function eventPill(event: CalendarEvent): { className: string; title: string; subtitle: string } {
  if (event.kind === 'block') {
    return {
      className: 'bg-stone-500 text-white',
      title: event.external ? 'Synced block' : 'Blocked',
      subtitle: event.listingTitle,
    }
  }
  if (event.kind === 'request') {
    return { className: 'bg-sky-600 text-white', title: event.guestName || 'Request', subtitle: event.listingTitle }
  }
  if (event.kind === 'booking' && event.status === 'pending') {
    return { className: 'bg-amber-500 text-white', title: event.guestName || 'Guest', subtitle: event.listingTitle }
  }
  return { className: 'bg-green-700 text-white', title: event.guestName || 'Guest', subtitle: event.listingTitle }
}

export function HostCalendarBoard({
  listings,
  events,
  saveAction,
  updateBookingAction,
  updateRequestAction,
  acceptRequestAction,
  removeRangeAction,
}: HostCalendarBoardProps) {
  // With more than one listing, default to a single combined view of them all;
  // a specific listing must be picked to add or edit dates. ALL_LISTINGS is a
  // sentinel, never a real listing id.
  const [selectedListingId, setSelectedListingId] = useState(
    listings.length > 1 ? ALL_LISTINGS : listings[0]?.id || '',
  )
  const isAllListings = selectedListingId === ALL_LISTINGS
  const today = useMemo(() => startOfDay(new Date()), [])
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({})
  const [showBooking, setShowBooking] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestCount, setGuestCount] = useState('1')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Every day → the events (bookings/blocks/requests) covering it, for pills.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      if (selectedListingId !== ALL_LISTINGS && event.listingId !== selectedListingId) continue
      for (const day of expandDays(event.start, event.endExclusive)) {
        const iso = formatDateISO(day)
        const list = map.get(iso)
        if (list) list.push(event)
        else map.set(iso, [event])
      }
    }
    return map
  }, [events, selectedListingId])

  // Weeks (Sun–Sat rows) covering the visible month.
  const weeks = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    const cursor = new Date(first)
    cursor.setDate(first.getDate() - first.getDay()) // back to the Sunday
    const out: Date[][] = []
    while (true) {
      const week: Date[] = []
      for (let i = 0; i < 7; i += 1) {
        week.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      out.push(week)
      if (cursor > last) break
    }
    return out
  }, [viewMonth])

  const startISO = range.from ? formatDateISO(range.from) : ''
  const endISO = range.to ? formatDateISO(range.to) : ''
  const hasRange = Boolean(!isAllListings && selectedListingId && startISO && endISO)

  const clearSelection = () => {
    setRange({})
    setShowBooking(false)
    setGuestName('')
    setGuestCount('1')
    setGuestEmail('')
    setGuestPhone('')
    setNotes('')
    setError(null)
  }

  // Click-to-select: first click sets the start, second sets the end (ordered),
  // a third starts a fresh range. Past days and days with events are not selectable.
  const pickDay = (day: Date) => {
    if (day < today) return
    // In the combined view there is no single listing to add dates to.
    if (isAllListings) return
    setError(null)
    setRange((current) => {
      if (!current.from || (current.from && current.to)) {
        return { from: day, to: undefined }
      }
      return current.from <= day ? { from: current.from, to: day } : { from: day, to: current.from }
    })
  }

  const submit = (kind: 'block' | 'booking') => {
    if (!hasRange) return
    if (kind === 'booking' && !guestName.trim()) return

    // Immediate no-double-booking feedback; the DB also rejects overlaps.
    const overlaps = events.some(
      (event) => event.listingId === selectedListingId && event.start <= endISO && event.endExclusive > startISO,
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
    // The picker end is inclusive; the block form treats end as the last night.
    formData.set('endDate', endISO)
    if (kind === 'booking') {
      formData.set('guestName', guestName.trim())
      formData.set('guests', guestCount)
      formData.set('guestEmail', guestEmail.trim())
      formData.set('guestPhone', guestPhone.trim())
      formData.set('notes', notes.trim())
    }

    startTransition(async () => {
      try {
        await saveAction(formData)
        clearSelection()
      } catch {
        setError('Could not save — those dates may already be taken.')
      }
    })
  }

  const inSelectedRange = (day: Date) => {
    if (!range.from) return false
    if (!range.to) return day.getTime() === range.from.getTime()
    return day >= range.from && day <= range.to
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 text-stone-600 transition hover:border-[#c76f55] hover:text-[#c76f55]"
          >
            ‹
          </button>
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-stone-950">
              {viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-sm font-semibold text-[#c76f55]" dir="rtl">
              {formatHebrewMonthSpan(viewMonth)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 text-stone-600 transition hover:border-[#c76f55] hover:text-[#c76f55]"
          >
            ›
          </button>
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
            <option value={ALL_LISTINGS}>All listings</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-stone-600">
        <LegendDot className="bg-green-700" label="Confirmed / booked" />
        <LegendDot className="bg-amber-500" label="Pending" />
        <LegendDot className="bg-sky-600" label="Request" />
        <LegendDot className="bg-stone-500" label="Blocked" />
        <LegendDot className="bg-[#fbe9c8] ring-1 ring-[#e6c179]" label="Chag" />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-2 pb-2 text-center text-[11px] font-bold uppercase tracking-widest text-stone-400">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>

          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map((day) => {
                  const inMonth = day.getMonth() === viewMonth.getMonth()
                  if (!inMonth) {
                    return <div key={day.toISOString()} className="min-h-[112px]" aria-hidden="true" />
                  }

                  const iso = formatDateISO(day)
                  const dayEvents = eventsByDay.get(iso) || []
                  const { holiday, parsha } = getDayJudaica(day)
                  const isPast = day < today
                  const isToday = day.getTime() === today.getTime()
                  const isSelected = inSelectedRange(day)

                  return (
                    <div
                      key={iso}
                      onClick={() => pickDay(day)}
                      className={`flex min-h-[112px] flex-col rounded-2xl border p-2 text-left transition ${
                        isSelected
                          ? 'border-[#c76f55] bg-[#fff4ef] ring-1 ring-[#c76f55]'
                          : holiday
                            ? 'border-[#e6c179] bg-[#fdf6e8]'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                      } ${isPast ? 'cursor-default opacity-50' : 'cursor-pointer'} ${
                        isToday ? 'ring-2 ring-[#c76f55]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-bold text-stone-900">{day.getDate()}</span>
                        <span className="text-[11px] font-semibold text-stone-400" dir="rtl">
                          {formatHebrewDay(day)}
                        </span>
                      </div>

                      {holiday && (
                        <span className="mt-0.5 truncate text-[11px] font-semibold text-[#a9781f]">{holiday}</span>
                      )}
                      {parsha && (
                        <span className="truncate text-[11px] font-semibold text-[#3b5a7a]">{parsha}</span>
                      )}

                      <div className="mt-1 flex flex-1 flex-col gap-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => {
                          const pill = eventPill(event)
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation()
                                setActiveEvent(event)
                              }}
                              className={`block w-full cursor-pointer rounded-md px-2 py-1 text-left text-[11px] font-semibold leading-tight ${pill.className}`}
                              title={`${pill.title} — ${pill.subtitle}`}
                            >
                              <span className="block truncate">{pill.title}</span>
                              <span className="block truncate text-[10px] font-normal opacity-90">{pill.subtitle}</span>
                            </button>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] font-semibold text-stone-500">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasRange && (
        <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-stone-900">
              {formatDisplayDate(range.from!)} — {formatDisplayDate(range.to!)}
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
            <div className="mt-3 border-t border-stone-200 pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Guest name"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
                />
                <input
                  value={guestCount}
                  onChange={(event) => setGuestCount(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="Number of guests"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
                />
                <input
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  type="email"
                  placeholder="Email (optional)"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
                />
                <input
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  type="tel"
                  placeholder="Phone (optional)"
                  className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
                />
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Notes (optional)"
                className="mt-2 w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => submit('booking')}
                  disabled={pending || !guestName.trim()}
                  className="rounded-full bg-green-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-60"
                >
                  {pending ? 'Saving…' : 'Save booking'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!hasRange && (
        <p className="mt-3 text-xs text-stone-500">
          Click a start day then an end day to block dates or record a booking. Click a booking to edit it.
        </p>
      )}

      {activeEvent && (
        <HostCalendarEventDialog
          key={activeEvent.id}
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
          updateBookingAction={updateBookingAction}
          updateRequestAction={updateRequestAction}
          acceptRequestAction={acceptRequestAction}
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
