'use client'

import { useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate } from '@/lib/hebrew-date'

type DateRange = {
  from?: Date
  to?: Date
}

type BookingDateRangePickerProps = {
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
}

export function BookingDateRangePicker({
  dateRange,
  setDateRange,
}: BookingDateRangePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

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
        className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
      >
        <div className="grid grid-cols-2">
          <DateCell label="Check-in" date={dateRange.from} />
          <DateCell label="Check-out" date={dateRange.to} noBorder />
        </div>
      </button>

      {showCalendar && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-3xl border border-stone-200 bg-[#faf8f6] shadow-xl shadow-stone-300/30">
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Arrival" date={dateRange.from} />
              <SummaryCard label="Departure" date={dateRange.to} />
            </div>
          </div>

          <div className="mx-4 my-4 rounded-2xl bg-white p-4">
            <Calendar
              mode="range"
              selected={dateRange}
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
              disabled={{ before: new Date() }}
              showOutsideDays={false}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4">
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
    <div className={`${noBorder ? '' : 'border-r border-stone-100'} p-4 text-left`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">
        {date ? format(date, 'EEE, d MMM') : 'Choose date'}
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
        {date ? format(date, 'EEE, d MMM') : 'Select'}
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
