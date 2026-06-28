'use client'

import { useMemo, useState } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate } from '@/lib/hebrew-date'
import { formatDateISO } from '@/lib/utils/date'

type ListingOption = {
  id: string
  title: string
}

type HostAvailabilityCalendarProps = {
  listings: ListingOption[]
  addUnavailableRangeAction: (formData: FormData) => void
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function HostAvailabilityCalendar({
  listings,
  addUnavailableRangeAction,
}: HostAvailabilityCalendarProps) {
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || '')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  const hiddenDates = useMemo(
    () => ({
      startDate: dateRange.from ? formatDateISO(dateRange.from) : '',
      endDate: dateRange.to ? formatDateISO(dateRange.to) : '',
    }),
    [dateRange],
  )
  const selectedRange: DayPickerDateRange | undefined = dateRange.from
    ? { from: dateRange.from, to: dateRange.to }
    : undefined

  return (
    <form action={addUnavailableRangeAction} className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Availability</p>
          <h2 className="mt-2 text-2xl font-bold text-stone-950">Block dates</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Choose a stay, select the unavailable dates, and save the block.
          </p>

          <label className="mt-5 block text-sm font-semibold text-stone-700">
            Stay
            <select
              name="listingId"
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

          <input type="hidden" name="startDate" value={hiddenDates.startDate} />
          <input type="hidden" name="endDate" value={hiddenDates.endDate} />

          <label className="mt-4 block text-sm font-semibold text-stone-700">
            Reason
            <input
              name="reason"
              placeholder="Optional note"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
            />
          </label>

          <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Selected range</p>
            <p className="mt-2 text-sm font-semibold text-stone-900">
              {dateRange.from ? formatDisplayDate(dateRange.from) : 'Choose a start date'}
              {' - '}
              {dateRange.to ? formatDisplayDate(dateRange.to) : 'choose an end date'}
            </p>
            {(dateRange.from || dateRange.to) && (
              <p className="mt-1 text-xs font-medium text-stone-500">
                {dateRange.from ? formatHebrewShortDate(dateRange.from) : 'Hebrew start date'}
                {' - '}
                {dateRange.to ? formatHebrewShortDate(dateRange.to) : 'Hebrew end date'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!selectedListingId || !dateRange.from || !dateRange.to}
            className="mt-5 rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save blocked dates
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl bg-[#faf8f6] p-4">
          <div className="rounded-2xl bg-white p-4">
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
              className="w-full"
            />
          </div>
        </div>
      </div>
    </form>
  )
}
