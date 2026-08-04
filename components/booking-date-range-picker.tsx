'use client'

import { useEffect, useRef, useState } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate, getJewishHoliday } from '@/lib/hebrew-date'

type DateRange = {
  from?: Date
  to?: Date
}

type BookingDateRangePickerProps = {
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  blockedRanges?: {
    start_date: string
    end_date: string
  }[]
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatCompactDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Blocked ranges are stored end-exclusive (end_date = checkout / day-after-block).
// react-day-picker's `to` is inclusive, so grey through end_date - 1 so a
// same-day turnover check-in stays selectable.
function blockedRangeInclusiveEnd(endDate: string) {
  const date = parseLocalDate(endDate)
  date.setDate(date.getDate() - 1)
  return date
}

export function BookingDateRangePicker({
  dateRange,
  setDateRange,
  blockedRanges = [],
}: BookingDateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const disabledDates = [
    { before: new Date() },
    ...blockedRanges.map((range) => ({
      from: parseLocalDate(range.start_date),
      to: blockedRangeInclusiveEnd(range.end_date),
    })),
  ]
  const selectedRange: DayPickerDateRange | undefined = dateRange.from
    ? { from: dateRange.from, to: dateRange.to }
    : undefined

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={calendarRef}>
      <button
        type="button"
        onClick={() => setShowCalendar((open) => !open)}
        className="w-full overflow-hidden rounded-[1.35rem] border border-stone-200 bg-white shadow-sm transition hover:border-stone-300 hover:shadow-md"
      >
        <div className="grid grid-cols-2">
          <DateCell label="Check-in" date={dateRange.from} />
          <DateCell label="Check-out" date={dateRange.to} noBorder />
        </div>
      </button>

      {showCalendar && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[min(92vw,460px)] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-300/30">
          <div className="border-b border-stone-100 bg-[#fbfaf8] px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Arrival" date={dateRange.from} />
              <SummaryCard label="Departure" date={dateRange.to} />
            </div>
          </div>

          <div className="mx-4 my-4 rounded-[1.5rem] bg-white p-5 ring-1 ring-stone-100">
            <Calendar
              mode="range"
              excludeDisabled
              selected={selectedRange}
              onSelect={(range) => {
                if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
                  setDateRange({ from: range.from, to: undefined })
                  return
                }

                setDateRange(range || { from: undefined, to: undefined })

                if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                  setTimeout(() => setShowCalendar(false), 300)
                }
              }}
              numberOfMonths={1}
              disabled={disabledDates}
              modifiers={{
                jewishHoliday: (date) => Boolean(getJewishHoliday(date)),
              }}
              modifiersClassNames={{
                jewishHoliday: 'font-bold text-[#c76f55]',
              }}
              showOutsideDays={false}
              className="w-full [--cell-size:2.75rem]"
              classNames={{
                root: 'w-full',
                months: 'flex w-full flex-col',
                month: 'w-full gap-5',
                month_caption: 'min-h-12',
                weekday: 'text-[10px] font-bold uppercase tracking-wider text-stone-400',
                week: 'mt-2 flex w-full gap-2',
                weekdays: 'flex gap-2',
                day: 'aspect-square flex-1 rounded-2xl',
                day_button: 'rounded-2xl border border-transparent text-sm hover:border-stone-200 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30',
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 bg-[#fbfaf8] px-5 py-4">
            <div className="flex items-center gap-2">
              <QuickRangeButton
                label="1 week"
                onClick={() => {
                  setDateRange({ from: new Date(), to: addDays(new Date(), 7) })
                  setTimeout(() => setShowCalendar(false), 300)
                }}
              />
              <QuickRangeButton
                label="2 weeks"
                onClick={() => {
                  setDateRange({ from: new Date(), to: addDays(new Date(), 14) })
                  setTimeout(() => setShowCalendar(false), 300)
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setDateRange({ from: undefined, to: undefined })}
              className="text-xs font-semibold text-stone-400 transition hover:text-stone-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DateCell({
  label,
  date,
  noBorder = false,
}: {
  label: string
  date?: Date
  noBorder?: boolean
}) {
  return (
    <div className={`${noBorder ? '' : 'border-r border-stone-100'} p-4 text-left md:p-5`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">
        {date ? formatCompactDate(date) : 'Choose date'}
      </p>
      {date && (
        <p className="mt-1 text-[11px] font-medium text-stone-500">
          {formatHebrewShortDate(date)}
        </p>
      )}
    </div>
  )
}

function SummaryCard({ label, date }: { label: string; date?: Date }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-stone-800">
        {date ? formatCompactDate(date) : 'Select'}
      </p>
      {date && (
        <p className="mt-1 text-[11px] font-medium text-stone-500">
          {formatHebrewShortDate(date)}
        </p>
      )}
    </div>
  )
}

function QuickRangeButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition hover:bg-stone-50"
    >
      {label}
    </button>
  )
}
