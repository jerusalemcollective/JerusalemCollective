'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = () => setIsDesktop(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

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
    <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-stone-900">Availability</h2>
        <p className="mt-1 text-sm text-stone-500">Greyed dates are unavailable</p>
      </div>
      <div className="overflow-hidden rounded-3xl bg-[#faf8f6] p-4">
        <div className="rounded-2xl bg-white p-4">
          <Calendar
            disabled={disabledDates}
            numberOfMonths={isDesktop ? 2 : 1}
            showOutsideDays={false}
            className="w-full"
          />
        </div>
      </div>
    </section>
  )
}
