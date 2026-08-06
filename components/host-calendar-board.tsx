'use client'

import { useMemo, useState } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate } from '@/lib/hebrew-date'
import { formatDateISO } from '@/lib/utils/date'

type ListingOption = { id: string; title: string }

export type CalendarBooking = {
  listing_id: string
  check_in: string
  check_out: string
  status: string
  guest_name: string | null
}

export type CalendarRange = {
  listing_id: string
  start_date: string
  end_date: string
  reason: string | null
  source: string
}

type HostCalendarBoardProps = {
  listings: ListingOption[]
  bookings: CalendarBooking[]
  ranges: CalendarRange[]
  saveAction: (formData: FormData) => void
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

export function HostCalendarBoard({ listings, bookings, ranges, saveAction }: HostCalendarBoardProps) {
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || '')
  const [mode, setMode] = useState<'block' | 'booking'>('block')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [reason, setReason] = useState('')
  const [guestName, setGuestName] = useState('')

  const { bookedDays, pendingDays, blockedDays } = useMemo(() => {
    const forListing = (id: string) => id === selectedListingId
    const booked: Date[] = []
    const pending: Date[] = []
    const blocked: Date[] = []

    for (const b of bookings) {
      if (!forListing(b.listing_id)) continue
      const days = expandDays(b.check_in, b.check_out)
      if (b.status === 'pending') pending.push(...days)
      else booked.push(...days)
    }
    for (const r of ranges) {
      if (!forListing(r.listing_id)) continue
      const days = expandDays(r.start_date, r.end_date)
      if (r.source === 'manual_booking') booked.push(...days)
      else if (r.source !== 'booking') blocked.push(...days) // 'booking' already covered by bookings
    }
    return { bookedDays: booked, pendingDays: pending, blockedDays: blocked }
  }, [bookings, ranges, selectedListingId])

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
            Select a range on the calendar, then block it off or record a booking.
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
              onSelect={(range) => {
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
              modifiers={{ booked: bookedDays, pending: pendingDays, blocked: blockedDays }}
              modifiersClassNames={{
                booked: '[&_button]:bg-green-100 [&_button]:text-green-900',
                pending: '[&_button]:bg-amber-100 [&_button]:text-amber-900',
                blocked: '[&_button]:bg-stone-200 [&_button]:text-stone-500',
              }}
            />
          </div>
        </div>
      </div>
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
