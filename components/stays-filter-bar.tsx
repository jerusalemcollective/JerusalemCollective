'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate, getJewishHoliday } from '@/lib/hebrew-date'
import { createClient } from '@/lib/supabase/client'
import { convert, type FxRates } from '@/lib/fx'
import { normalizeCurrency } from '@/lib/currencies'
import { PriceRangeSlider } from '@/components/price-range-slider'

const NIGHTLY_USD_CEILING = 1500

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

const FEATURE_TOGGLES = [
  { key: 'shabbatElevator', label: 'Shabbos elevator' },
  { key: 'physicalKey', label: 'Keyless entry for Shabbos' },
  { key: 'sukkahBalcony', label: 'Sukkah / sukkah balcony' },
  { key: 'centralAc', label: 'Air conditioning' },
] as const

type FeatureKey = (typeof FEATURE_TOGGLES)[number]['key']

export function StaysFilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showCalendar, setShowCalendar] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [checkInValue, setCheckInValue] = useState(searchParams.get('checkIn') || '')
  const [checkOutValue, setCheckOutValue] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests')) || 0)
  const [bedrooms, setBedrooms] = useState(Number(searchParams.get('bedrooms')) || 0)
  const [preferredCurrency, setPreferredCurrency] = useState('USD')
  const [rates, setRates] = useState<FxRates>({})
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(0)
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    shabbatElevator: Boolean(searchParams.get('shabbatElevator')),
    physicalKey: Boolean(searchParams.get('physicalKey')),
    sukkahBalcony: Boolean(searchParams.get('sukkahBalcony')),
    centralAc: Boolean(searchParams.get('centralAc')),
  })

  useEffect(() => {
    setCheckInValue(searchParams.get('checkIn') || '')
    setCheckOutValue(searchParams.get('checkOut') || '')
    setGuests(Number(searchParams.get('guests')) || 0)
    setBedrooms(Number(searchParams.get('bedrooms')) || 0)
    setFeatures({
      shabbatElevator: Boolean(searchParams.get('shabbatElevator')),
      physicalKey: Boolean(searchParams.get('physicalKey')),
      sukkahBalcony: Boolean(searchParams.get('sukkahBalcony')),
      centralAc: Boolean(searchParams.get('centralAc')),
    })
    setShowCalendar(false)
    setShowFilters(false)
  }, [searchParams])

  // Load the guest's preferred display currency + live FX rates so the price
  // range can be shown and dragged in their own currency.
  useEffect(() => {
    let active = true
    fetch('/api/fx')
      .then((response) => response.json())
      .then((data) => {
        if (active && data?.rates) setRates(data.rates as FxRates)
      })
      .catch(() => {})

    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      void supabase
        .from('profiles')
        .select('preferred_currency')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data?.preferred_currency) {
            setPreferredCurrency(normalizeCurrency(data.preferred_currency))
          }
        })
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!showCalendar && !showFilters) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCalendar(false)
        setShowFilters(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCalendar, showFilters])

  const checkInDate = parseLocalDate(checkInValue)
  const checkOutDate = parseLocalDate(checkOutValue)
  const selectedRange: DayPickerDateRange | undefined = checkInDate
    ? { from: checkInDate, to: checkOutDate }
    : undefined

  const nights =
    checkInDate && checkOutDate
      ? Math.max(0, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86_400_000))
      : 0
  const nightsForCalc = nights > 0 ? nights : 1
  const priceCeiling = Math.max(
    100,
    Math.round(convert(NIGHTLY_USD_CEILING, 'USD', preferredCurrency, rates) * nightsForCalc),
  )
  const priceLabel =
    nights > 0
      ? `Total for ${nights} night${nights === 1 ? '' : 's'} (${preferredCurrency})`
      : `Price per night (${preferredCurrency})`

  // Derive the slider position from the URL (stored as per-night USD) into the
  // preferred-currency total whenever currency, rates, dates, or the URL change.
  useEffect(() => {
    const urlMin = Number(searchParams.get('minPrice')) || 0
    const urlMax = Number(searchParams.get('maxPrice')) || 0
    const toPreferredTotal = (usdPerNight: number) =>
      Math.round(convert(usdPerNight, 'USD', preferredCurrency, rates) * nightsForCalc)
    const ceiling = Math.max(
      100,
      Math.round(convert(NIGHTLY_USD_CEILING, 'USD', preferredCurrency, rates) * nightsForCalc),
    )
    setPriceMin(urlMin ? toPreferredTotal(urlMin) : 0)
    setPriceMax(urlMax ? Math.min(toPreferredTotal(urlMax), ceiling) : ceiling)
  }, [searchParams, preferredCurrency, rates, nightsForCalc])

  const priceIsFiltered = priceMin > 0 || (priceMax > 0 && priceMax < priceCeiling)
  const activeFeatureCount =
    FEATURE_TOGGLES.filter((toggle) => features[toggle.key]).length +
    (bedrooms > 0 ? 1 : 0) +
    (priceIsFiltered ? 1 : 0)

  const hasFilters = Boolean(
    searchParams.get('checkIn') ||
      searchParams.get('checkOut') ||
      searchParams.get('guests') ||
      searchParams.get('bedrooms') ||
      searchParams.get('minPrice') ||
      searchParams.get('maxPrice') ||
      FEATURE_TOGGLES.some((toggle) => searchParams.get(toggle.key)) ||
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
    setOrDelete(next, 'bedrooms', bedrooms > 0 ? String(bedrooms) : '')
    // The slider works in the guest's currency (a total when dates are chosen);
    // the listing query filters on per-night USD, so convert back here.
    const toUsdPerNight = (preferredTotal: number) =>
      Math.round(convert(preferredTotal, preferredCurrency, 'USD', rates) / nightsForCalc)
    setOrDelete(next, 'minPrice', priceMin > 0 ? String(toUsdPerNight(priceMin)) : '')
    setOrDelete(
      next,
      'maxPrice',
      priceMax > 0 && priceMax < priceCeiling ? String(toUsdPerNight(priceMax)) : '',
    )
    FEATURE_TOGGLES.forEach((toggle) => setOrDelete(next, toggle.key, features[toggle.key] ? '1' : ''))
    next.delete('page')

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
    setShowFilters(false)
  }

  const handleClear = () => {
    setCheckInValue('')
    setCheckOutValue('')
    setGuests(0)
    setBedrooms(0)
    setPriceMin(0)
    setPriceMax(priceCeiling)
    setFeatures({ shabbatElevator: false, physicalKey: false, sukkahBalcony: false, centralAc: false })
    setShowCalendar(false)
    setShowFilters(false)
    router.push('/stays')
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className="flex w-full min-w-0 flex-col rounded-2xl px-4 py-2.5 text-left transition hover:bg-stone-50 focus-visible:bg-[#faf8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">Dates</span>
            <span className={`mt-0.5 truncate text-sm ${checkInDate ? 'text-stone-900' : 'text-stone-500'}`}>
              {dateLabel}
            </span>
          </button>

          {showCalendar && (
            <>
              {/* Click-outside: dimmed sheet backdrop on mobile, transparent catcher on desktop. */}
              <div
                role="presentation"
                onClick={() => setShowCalendar(false)}
                className="fixed inset-0 z-40 bg-black/45 sm:bg-transparent"
              />
              {/* Bottom sheet on mobile; a dropdown anchored under the Dates button on desktop. */}
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Select your dates"
                className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[85vh] w-auto max-w-[440px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mx-0 sm:mt-2 sm:max-h-none sm:w-[440px] sm:max-w-none"
              >
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
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

                <div className="overflow-y-auto p-3 sm:overflow-visible">
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
                    numberOfMonths={1}
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
                      month: 'flex w-full flex-col gap-3',
                      weekday: 'flex-1 text-[10px] font-bold uppercase tracking-wider text-stone-500',
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
            </>
          )}
        </div>

        <div className="rounded-2xl px-4 py-2 sm:w-44">
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

        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-left transition hover:bg-stone-50 sm:w-40"
        >
          <span className="flex flex-col">
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">Filters</span>
            <span className={`mt-0.5 text-sm ${activeFeatureCount ? 'text-stone-900' : 'text-stone-500'}`}>
              {activeFeatureCount ? `${activeFeatureCount} selected` : 'Any'}
            </span>
          </span>
          <ChevronIcon className="h-4 w-4 text-stone-400" />
        </button>

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

      {showFilters && (
        <div
          role="presentation"
          onClick={() => setShowFilters(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
              <p className="text-sm font-bold text-stone-900">Filters</p>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                className="rounded-full p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <label className="block">
                <span className="text-sm font-semibold text-stone-900">Bedrooms</span>
                <select
                  value={bedrooms}
                  onChange={(event) => setBedrooms(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900"
                >
                  <option value={0}>Any</option>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count}+ bedroom{count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-sm font-semibold text-stone-900">{priceLabel}</span>
                <div className="mt-3">
                  <PriceRangeSlider
                    max={priceCeiling}
                    valueMin={priceMin}
                    valueMax={priceMax}
                    currency={preferredCurrency}
                    onChange={(min, max) => {
                      setPriceMin(min)
                      setPriceMax(max)
                    }}
                  />
                </div>
              </div>

              <div>
                <span className="text-sm font-semibold text-stone-900">Features</span>
                <div className="mt-2 space-y-2">
                  {FEATURE_TOGGLES.map((toggle) => (
                    <label
                      key={toggle.key}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-300"
                    >
                      <input
                        type="checkbox"
                        checked={features[toggle.key]}
                        onChange={(event) =>
                          setFeatures((current) => ({ ...current, [toggle.key]: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-stone-300 text-[#c76f55] focus:ring-[#c76f55]"
                      />
                      {toggle.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setBedrooms(0)
                  setPriceMin(0)
                  setPriceMax(priceCeiling)
                  setFeatures({ shabbatElevator: false, physicalKey: false, sukkahBalcony: false, centralAc: false })
                }}
                className="text-xs font-bold text-stone-500 transition hover:text-stone-800"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-full bg-[#252525] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]"
              >
                Show stays
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
