'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { STAY_AMENITY_GROUPS, getAmenityLabel, slugifyAmenity } from '@/lib/stay-amenities'

function parseLocalDate(value: string | null) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatSummaryDate(value: string | null) {
  if (!value) return null
  return parseLocalDate(value)?.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  }) || null
}

export function StaysFilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [checkInValue, setCheckInValue] = useState(searchParams.get('checkIn') || '')
  const [checkOutValue, setCheckOutValue] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(searchParams.get('guests') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [kosherKitchen, setKosherKitchen] = useState(searchParams.get('kosherKitchen') === '1')
  const [shabbatElevator, setShabbatElevator] = useState(searchParams.get('shabbatElevator') === '1')
  const [physicalKey, setPhysicalKey] = useState(searchParams.get('physicalKey') === '1')
  const [sukkahBalcony, setSukkahBalcony] = useState(searchParams.get('sukkahBalcony') === '1')
  const [nearSynagogue, setNearSynagogue] = useState(searchParams.get('nearSynagogue') === '1')
  const [maxWalkToKotel, setMaxWalkToKotel] = useState(searchParams.get('maxWalkToKotel') || '')
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    searchParams.get('amenities')?.split(',').filter(Boolean) || [],
  )
  const todayISO = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    setCheckInValue(searchParams.get('checkIn') || '')
    setCheckOutValue(searchParams.get('checkOut') || '')
    setGuests(searchParams.get('guests') || '')
    setMinPrice(searchParams.get('minPrice') || '')
    setMaxPrice(searchParams.get('maxPrice') || '')
    setKosherKitchen(searchParams.get('kosherKitchen') === '1')
    setShabbatElevator(searchParams.get('shabbatElevator') === '1')
    setPhysicalKey(searchParams.get('physicalKey') === '1')
    setSukkahBalcony(searchParams.get('sukkahBalcony') === '1')
    setNearSynagogue(searchParams.get('nearSynagogue') === '1')
    setMaxWalkToKotel(searchParams.get('maxWalkToKotel') || '')
    setSelectedAmenities(searchParams.get('amenities')?.split(',').filter(Boolean) || [])
    setFiltersOpen(false)
  }, [searchParams])

  const hasFilters = useMemo(
    () =>
      Boolean(
        searchParams.get('neighborhood') ||
          searchParams.get('area') ||
          searchParams.get('checkIn') ||
          searchParams.get('checkOut') ||
          searchParams.get('guests') ||
          searchParams.get('minPrice') ||
          searchParams.get('maxPrice') ||
          searchParams.get('amenities') ||
          searchParams.get('kosherKitchen') ||
          searchParams.get('shabbatElevator') ||
          searchParams.get('physicalKey') ||
          searchParams.get('sukkahBalcony') ||
          searchParams.get('nearSynagogue') ||
          searchParams.get('maxWalkToKotel'),
      ),
    [searchParams],
  )
  const showSummary = !filtersOpen
  const activeArea = searchParams.get('neighborhood') || searchParams.get('area')
  const summaryItems = useMemo(() => {
    const items: string[] = []
    const checkIn = formatSummaryDate(searchParams.get('checkIn'))
    const checkOut = formatSummaryDate(searchParams.get('checkOut'))
    const activeGuests = searchParams.get('guests')
    const activeMinPrice = searchParams.get('minPrice')
    const activeMaxPrice = searchParams.get('maxPrice')
    const activeAmenities = searchParams.get('amenities')?.split(',').filter(Boolean) || []
    const activeJewishFilters = [
      searchParams.get('kosherKitchen') ? 'Kosher kitchen' : null,
      searchParams.get('shabbatElevator') ? 'Shabbat elevator' : null,
      searchParams.get('physicalKey') ? 'Physical key' : null,
      searchParams.get('sukkahBalcony') ? 'Sukkah balcony' : null,
      searchParams.get('nearSynagogue') ? 'Near synagogue' : null,
      searchParams.get('maxWalkToKotel') ? `Within ${searchParams.get('maxWalkToKotel')} min to Kotel` : null,
    ].filter((item): item is string => Boolean(item))

    if (activeArea && activeArea !== 'All') items.push(activeArea)
    if (checkIn && checkOut) items.push(`${checkIn}-${checkOut}`)
    else if (checkIn) items.push(`From ${checkIn}`)
    else if (checkOut) items.push(`Until ${checkOut}`)
    if (activeGuests) items.push(`${activeGuests} guest${activeGuests === '1' ? '' : 's'}`)
    if (activeMinPrice && activeMaxPrice) items.push(`$${activeMinPrice}-$${activeMaxPrice}`)
    else if (activeMinPrice) items.push(`From $${activeMinPrice}`)
    else if (activeMaxPrice) items.push(`Up to $${activeMaxPrice}`)

    if (activeAmenities.length > 0) {
      const amenityLabels = activeAmenities
        .map((amenity) => getAmenityLabel(amenity) || amenity)
        .slice(0, 2)
      const remainingCount = activeAmenities.length - amenityLabels.length
      items.push(
        remainingCount > 0
          ? `${amenityLabels.join(', ')} +${remainingCount} more`
          : amenityLabels.join(', '),
      )
    }

    if (activeJewishFilters.length > 0) {
      items.push(activeJewishFilters.slice(0, 2).join(', '))
    }

    return items
  }, [activeArea, searchParams])

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

    setOrDelete(next, 'checkIn', checkInValue)
    setOrDelete(next, 'checkOut', checkOutValue)
    setOrDelete(next, 'guests', guests)
    setOrDelete(next, 'minPrice', minPrice)
    setOrDelete(next, 'maxPrice', maxPrice)
    setOrDelete(next, 'amenities', selectedAmenities.join(','))
    setOrDelete(next, 'kosherKitchen', kosherKitchen ? '1' : '')
    setOrDelete(next, 'shabbatElevator', shabbatElevator ? '1' : '')
    setOrDelete(next, 'physicalKey', physicalKey ? '1' : '')
    setOrDelete(next, 'sukkahBalcony', sukkahBalcony ? '1' : '')
    setOrDelete(next, 'nearSynagogue', nearSynagogue ? '1' : '')
    setOrDelete(next, 'maxWalkToKotel', maxWalkToKotel)

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
    setFiltersOpen(false)
  }

  const handleClear = () => {
    router.push('/stays')
    setCheckInValue('')
    setCheckOutValue('')
    setGuests('')
    setMinPrice('')
    setMaxPrice('')
    setKosherKitchen(false)
    setShabbatElevator(false)
    setPhysicalKey(false)
    setSukkahBalcony(false)
    setNearSynagogue(false)
    setMaxWalkToKotel('')
    setSelectedAmenities([])
    setFiltersOpen(false)
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
      {showSummary ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-950">
              {summaryItems.length > 0 ? summaryItems.join(' · ') : 'All Jerusalem stays'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {hasFilters ? 'Filtered stays' : 'Dates, guests, price, amenities'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300"
            >
              Edit filters
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full bg-[#c76f55] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b85f47]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <div>
            <p className="text-sm font-bold text-stone-950">Search filters</p>
            <p className="text-xs text-stone-500">Dates, guests, price, amenities</p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700"
          >
            {filtersOpen ? 'Close' : 'Filters'}
          </button>
        </div>
      )}

      <div className={`${filtersOpen ? 'mt-4 grid' : 'hidden'} gap-4 lg:grid-cols-[minmax(260px,1.4fr)_0.55fr_0.8fr_1.2fr_1fr_auto] lg:items-start`}>
        <div className="flex items-center gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Check in
            </span>
            <input
              type="date"
              value={checkInValue}
              min={todayISO}
              onChange={(event) => setCheckInValue(event.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#c76f55] focus:outline-none"
            />
          </label>
          <span className="mt-5 text-stone-400">→</span>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Check out
            </span>
            <input
              type="date"
              value={checkOutValue}
              min={checkInValue || todayISO}
              onChange={(event) => setCheckOutValue(event.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#c76f55] focus:outline-none"
            />
          </label>
        </div>

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
          <div className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3">
            {STAY_AMENITY_GROUPS.map((group) => (
              <section key={group.title}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{group.title}</p>
                  <span className="text-[11px] font-semibold text-stone-400">
                    {group.amenities.filter((amenity) => selectedAmenities.includes(slugifyAmenity(amenity))).length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.amenities.map((amenity) => {
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
              </section>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-stone-700">Jewish lifestyle</legend>
          <div className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <FilterToggle checked={kosherKitchen} label="Kosher kitchen" onChange={setKosherKitchen} />
              <FilterToggle checked={shabbatElevator} label="Shabbat elevator" onChange={setShabbatElevator} />
              <FilterToggle checked={physicalKey} label="Physical key entry" onChange={setPhysicalKey} />
              <FilterToggle checked={sukkahBalcony} label="Sukkah balcony" onChange={setSukkahBalcony} />
              <FilterToggle checked={nearSynagogue} label="Near synagogue" onChange={setNearSynagogue} />
            </div>
            <label className="block text-xs font-semibold text-stone-600">
              Walking distance to Kotel
              <input
                type="number"
                min={1}
                value={maxWalkToKotel}
                onChange={(event) => setMaxWalkToKotel(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#c76f55] focus:outline-none"
                placeholder="Within X minutes"
              />
            </label>
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

      {hasFilters && filtersOpen && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 text-sm font-semibold text-[#c76f55] hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

function FilterToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        checked ? 'bg-[#c76f55] text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  )
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}
