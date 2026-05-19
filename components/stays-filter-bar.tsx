'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookingDateRangePicker } from '@/components/booking-date-range-picker'
import { STAY_AMENITIES, slugifyAmenity } from '@/lib/stay-amenities'

type DateRange = {
  from?: Date
  to?: Date
}

function parseLocalDate(value: string | null) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatDateParam(date?: Date) {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function StaysFilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: parseLocalDate(searchParams.get('checkIn')),
    to: parseLocalDate(searchParams.get('checkOut')),
  })
  const [guests, setGuests] = useState(searchParams.get('guests') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    searchParams.get('amenities')?.split(',').filter(Boolean) || [],
  )

  useEffect(() => {
    setDateRange({
      from: parseLocalDate(searchParams.get('checkIn')),
      to: parseLocalDate(searchParams.get('checkOut')),
    })
    setGuests(searchParams.get('guests') || '')
    setMinPrice(searchParams.get('minPrice') || '')
    setMaxPrice(searchParams.get('maxPrice') || '')
    setSelectedAmenities(searchParams.get('amenities')?.split(',').filter(Boolean) || [])
  }, [searchParams])

  const hasFilters = useMemo(
    () =>
      Boolean(
        searchParams.get('checkIn') ||
          searchParams.get('checkOut') ||
          searchParams.get('guests') ||
          searchParams.get('minPrice') ||
          searchParams.get('maxPrice') ||
          searchParams.get('amenities'),
      ),
    [searchParams],
  )

  const toggleAmenity = (amenity: string) => {
    const value = slugifyAmenity(amenity)
    setSelectedAmenities((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  const handleSearch = () => {
    const next = new URLSearchParams(searchParams.toString())
    const checkIn = formatDateParam(dateRange.from)
    const checkOut = formatDateParam(dateRange.to)

    setOrDelete(next, 'checkIn', checkIn)
    setOrDelete(next, 'checkOut', checkOut)
    setOrDelete(next, 'guests', guests)
    setOrDelete(next, 'minPrice', minPrice)
    setOrDelete(next, 'maxPrice', maxPrice)
    setOrDelete(next, 'amenities', selectedAmenities.join(','))

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
    setMobileOpen(false)
  }

  const handleClear = () => {
    router.push('/stays')
    setDateRange({})
    setGuests('')
    setMinPrice('')
    setMaxPrice('')
    setSelectedAmenities([])
    setMobileOpen(false)
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p className="text-sm font-bold text-stone-950">Search filters</p>
          <p className="text-xs text-stone-500">Dates, guests, price, amenities</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700"
        >
          {mobileOpen ? 'Close' : 'Filters'}
        </button>
      </div>

      <div className={`${mobileOpen ? 'mt-4 grid' : 'hidden'} gap-4 lg:grid lg:grid-cols-[minmax(260px,1.4fr)_0.55fr_0.8fr_1.3fr_auto] lg:items-start`}>
        <BookingDateRangePicker dateRange={dateRange} setDateRange={setDateRange} />

        <label className="block text-sm font-semibold text-stone-700">
          Guests
          <input
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="mt-2 h-[74px] w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
            placeholder="Any"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold text-stone-700">
            Min USD
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              className="mt-2 h-[74px] w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
              placeholder="Min"
            />
          </label>
          <label className="block text-sm font-semibold text-stone-700">
            Max USD
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              className="mt-2 h-[74px] w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
              placeholder="Max"
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-stone-700">Amenities</legend>
          <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3">
            {STAY_AMENITIES.map((amenity) => {
              const value = slugifyAmenity(amenity)
              const checked = selectedAmenities.includes(value)

              return (
                <label
                  key={amenity}
                  className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    checked ? 'bg-[#c76f55] text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAmenity(amenity)}
                    className="sr-only"
                  />
                  {amenity}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex gap-2 lg:flex-col lg:pt-7">
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300"
          >
            Clear
          </button>
        </div>
      </div>

      {hasFilters && !mobileOpen && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 text-sm font-semibold text-[#c76f55] hover:underline lg:hidden"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}
