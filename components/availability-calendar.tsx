'use client'

import { useMemo } from 'react'
import { Calendar } from '@/components/ui/calendar'

type BlockedRange = {
  start_date: string
  end_date: string
}

type AvailabilityCalendarProps = {
  blockedRanges: BlockedRange[]
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

export function AvailabilityCalendar({ blockedRanges }: AvailabilityCalendarProps) {
  const disabledDates = useMemo(
    () => [
      { before: startOfToday() },
      ...blockedRanges.map((range) => ({
        from: parseLocalDate(range.start_date),
        to: parseLocalDate(range.end_date),
      })),
    ],
    [blockedRanges],
  )

  return (
    <section className="mb-8 rounded-3xl bg-white p-5 shadow-sm md:p-7">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Availability</h2>
          <p className="mt-1 text-sm text-stone-500">Greyed dates are unavailable</p>
        </div>
        <p className="text-xs font-semibold text-stone-400">Hebrew dates shown inside each day</p>
      </div>
      <div className="rounded-3xl bg-[#faf8f6] p-3 sm:p-6">
        <div className="mx-auto max-w-[460px] rounded-2xl bg-white p-3 sm:p-5">
          <Calendar
            disabled={disabledDates}
            numberOfMonths={1}
            showOutsideDays={false}
            className="w-full [--cell-size:2.65rem] sm:[--cell-size:3.45rem]"
            classNames={{
              root: 'w-full',
              months: 'flex w-full flex-col',
              month: 'w-full gap-5',
              month_caption: 'min-h-12',
              weekday: 'text-[11px] font-bold uppercase tracking-wider text-stone-400',
              week: 'mt-2 flex w-full gap-1.5',
              weekdays: 'flex gap-1.5',
              day: 'aspect-square flex-1 rounded-2xl',
              day_button: 'rounded-2xl border border-transparent hover:border-stone-200 hover:bg-stone-50',
            }}
          />
        </div>
      </div>
    </section>
  )
}
