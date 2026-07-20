'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate, getJewishHoliday } from '@/lib/hebrew-date'

function parseLocalDate(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatDateISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatCompactDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
  else params.delete(key)
}

export function StaysFilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showCalendar, setShowCalendar] = useState(false)
  const [checkInValue, setCheckInValue] = useState(searchParams.get('checkIn') || '')
  const [checkOutValue, setCheckOutValue] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests')) || 0)

  useEffect(() => {
    setCheckInValue(searchParams.get('checkIn') || '')
    setCheckOutValue(searchParams.get('checkOut') || '')
    setGuests(Number(searchParams.get('guests')) || 0)
    setShowCalendar(false)
  }, [searchParams])

  useEffect(() => {
    if (!showCalendar) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowCalendar(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCalendar])

  const checkInDate = parseLocalDate(checkInValue)
  const checkOutDate = parseLocalDate(checkOutValue)
  const selectedRange: DayPickerDateRange | undefined = checkInDate
    ? { from: checkInDate, to: checkOutDate }
    : undefined

  const hasFilters = Boolean(
    searchParams.get('checkIn') ||
      searchParams.get('checkOut') ||
      searchParams.get('guests') ||
      ((searchParams.get('neighborhood') || searchParams.get('area')) !== null &&
        (searchParams.get('neighborhood') || searchParams.get('area')) !== 'All'),
  )

  const dateLabel = checkInDate
    ? checkOutDate
      ? `${formatCompactDate(checkInDate)} – ${formatCompactDate(checkOutDate)}`
      : formatCompactDate(checkInDate)
    : 'Any dates'

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams.toString())

    setOrDelete(next, 'checkIn', checkInValue)
    setOrDelete(next, 'checkOut', checkOutValue)
    setOrDelete(next, 'guests', guests > 0 ? String(guests) : '')

    const neighborhood = next.get('neighborhood') || next.get('area')
    if (neighborhood && neighborhood !== 'All') {
      void fetch('/api/neighborhood-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neighborhood, source: 'stays_filter' }),
      })
    }

    const nextQuery = next.toString()
    router.push(nextQuery ? `/stays?${nextQuery}` : '/stays')
    setShowCalendar(false)
  }

  const handleClear = () => {
    setCheckInValue('')
    setCheckOutValue('')
    setGuests(0)
    setShowCalendar(false)
    router.push('/stays')
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          className="flex min-w-0 flex-1 flex-col rounded-2xl px-4 py-2.5 text-left transition hover:bg-stone-50 focus-visible:bg-[#faf8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">Dates</span>
          <span className={`mt-0.5 truncate text-sm ${checkInDate ? 'text-stone-900' : 'text-stone-500'}`}>
            {dateLabel}
          </span>
        </button>

        <div className="rounded-2xl px-4 py-2 sm:w-56">
          <label
            htmlFor="stays-guests"
            className="block text-[11px] font-bold uppercase tracking-widest text-stone-900"
          >
            Guests
          </label>
          <div className="relative mt-0.5">
            <select
              id="stays-guests"
              value={guests}
              onChange={(event) => setGuests(Number(event.target.value))}
              className="w-full cursor-pointer appearance-none border-0 bg-transparent py-0.5 pr-6 text-sm text-stone-900 focus:outline-none"
            >
              <option value={0}>Any</option>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count} guest{count === 1 ? '' : 's'}
                </option>
              ))}
              <option value={10}>10+ guests</option>
            </select>
            <ChevronIcon className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="flex-1 rounded-2xl bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] sm:flex-none"
          >
            Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {showCalendar && (
        <div
          role="presentation"
          onClick={() => setShowCalendar(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select your dates"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:max-w-[720px]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-[#fbf8f5] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">Your dates</p>
                <p className="truncate text-sm font-semibold text-stone-900">
                  {checkInDate ? (
                    <>
                      {formatCompactDate(checkInDate)}
                      {checkOutDate ? ` – ${formatCompactDate(checkOutDate)}` : ''}
                      <span className="ml-2 text-xs font-normal text-stone-500">
                        {formatHebrewShortDate(checkInDate)}
                      </span>
                    </>
                  ) : (
                    'Choose your dates'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                aria-label="Close date picker"
                className="shrink-0 rounded-full p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <Calendar
                mode="range"
                excludeDisabled
                selected={selectedRange}
                onSelect={(range) => {
                  if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
                    setCheckInValue(formatDateISO(range.from))
                    setCheckOutValue('')
                    return
                  }

                  setCheckInValue(range?.from ? formatDateISO(range.from) : '')
                  setCheckOutValue(range?.to ? formatDateISO(range.to) : '')
                }}
                numberOfMonths={2}
                disabled={{ before: new Date() }}
                modifiers={{
                  jewishHoliday: (date) => Boolean(getJewishHoliday(date)),
                }}
                modifiersClassNames={{
                  jewishHoliday: 'font-bold text-[#c76f55]',
                }}
                showOutsideDays={false}
                className="w-full p-0"
                classNames={{
                  months: 'flex flex-col gap-6 md:flex-row md:gap-8',
                  month: 'flex w-full flex-col gap-3',
                  weekday: 'flex-1 text-[10px] font-bold uppercase tracking-wider text-stone-400',
                  week: 'mt-1.5 flex w-full',
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setCheckInValue('')
                  setCheckOutValue('')
                }}
                className="text-xs font-bold text-stone-500 transition hover:text-stone-800"
              >
                Clear dates
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-full bg-[#252525] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#111111]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
