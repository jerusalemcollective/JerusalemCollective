'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const filterPanelRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!filtersOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (
        filterPanelRef.current &&
        event.target instanceof Node &&
        !filterPanelRef.current.contains(event.target)
      ) {
        setFiltersOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [filtersOpen])

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
  const activeFilterCount = [
    checkInValue,
    checkOutValue,
    guests,
    minPrice,
    maxPrice,
    kosherKitchen,
    shabbatElevator,
    physicalKey,
    sukkahBalcony,
    nearSynagogue,
    maxWalkToKotel,
    selectedAmenities.length > 0,
  ].filter(Boolean).length
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
              className="inline-flex items-center rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-300"
            >
              Edit filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#c76f55] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
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
            className="inline-flex items-center rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700"
          >
            {filtersOpen ? 'Close' : 'Filters'}
            {activeFilterCount > 0 && !filtersOpen && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#c76f55] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      )}

      <div
        ref={filterPanelRef}
        className={`${filtersOpen ? 'mt-4 block' : 'hidden'} overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#fbfaf8] shadow-sm`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200/70 bg-white px-5 py-4">
          <div>
            <p className="text-sm font-bold text-stone-950">Refine your stay</p>
            <p className="mt-1 text-xs text-stone-500">
              Choose only the details that matter for this visit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
            aria-label="Close filters"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1.2fr] lg:p-5">
          <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Check in
                </span>
                <input
                  type="date"
                  value={checkInValue}
                  min={todayISO}
                  onChange={(event) => setCheckInValue(event.target.value)}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                />
              </label>
              <span className="hidden pb-3 text-stone-300 sm:block">→</span>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Check out
                </span>
                <input
                  type="date"
                  value={checkOutValue}
                  min={checkInValue || todayISO}
                  onChange={(event) => setCheckOutValue(event.target.value)}
                  className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold text-stone-700">
                Guests
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  placeholder="Any"
                />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Min USD
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
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
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  placeholder="Max"
                />
              </label>
            </div>
          </section>

          <section className="space-y-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <fieldset>
              <legend className="text-sm font-bold text-stone-950">Amenities</legend>
              <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
                {STAY_AMENITY_GROUPS.map((group) => (
                  <section key={group.title} className="border-b border-stone-100 pb-4 last:border-b-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                          {group.title}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {group.description}
                        </p>
                      </div>
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-500">
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
                            className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              checked
                                ? 'border-[#c76f55] bg-[#c76f55] text-white shadow-sm'
                                : 'border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
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

            <fieldset className="rounded-2xl bg-[#F8F5F2] p-4">
              <legend className="text-sm font-bold text-stone-950">Jewish lifestyle</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterToggle checked={kosherKitchen} label="Kosher kitchen" onChange={setKosherKitchen} />
                <FilterToggle checked={shabbatElevator} label="Shabbat elevator" onChange={setShabbatElevator} />
                <FilterToggle checked={physicalKey} label="Physical key entry" onChange={setPhysicalKey} />
                <FilterToggle checked={sukkahBalcony} label="Sukkah balcony" onChange={setSukkahBalcony} />
                <FilterToggle checked={nearSynagogue} label="Near synagogue" onChange={setNearSynagogue} />
              </div>
              <label className="mt-4 block text-xs font-semibold text-stone-600">
                Walking distance to Kotel
                <input
                  type="number"
                  min={1}
                  value={maxWalkToKotel}
                  onChange={(event) => setMaxWalkToKotel(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  placeholder="Within X minutes"
                />
              </label>
            </fieldset>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-200/70 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300"
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
          >
            Search stays
          </button>
        </div>
      </div>

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
      className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        checked
          ? 'border-[#c76f55] bg-[#c76f55] text-white shadow-sm'
          : 'border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
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
