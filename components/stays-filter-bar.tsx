'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate, getJewishHoliday } from '@/lib/hebrew-date'
import { STAY_AMENITY_GROUPS, getAmenityLabel, slugifyAmenity } from '@/lib/stay-amenities'

const PRICE_PRESETS = [
  { label: 'Under $150', min: '', max: '150' },
  { label: '$150-$250', min: '150', max: '250' },
  { label: '$250-$400', min: '250', max: '400' },
  { label: '$400+', min: '400', max: '' },
]

function parseLocalDate(value: string | null) {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatSummaryDate(value: string | null) {
  if (!value) return null
  return (
    parseLocalDate(value)?.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    }) || null
  )
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
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
    if (activeMinPrice && activeMaxPrice) items.push(`$${activeMinPrice}-$${activeMaxPrice} / night`)
    else if (activeMinPrice) items.push(`From $${activeMinPrice} / night`)
    else if (activeMaxPrice) items.push(`Up to $${activeMaxPrice} / night`)

    if (activeAmenities.length > 0) {
      const amenityLabels = activeAmenities
        .map((amenity) => getAmenityLabel(amenity) || amenity)
        .slice(0, 2)
      const remainingCount = activeAmenities.length - amenityLabels.length
      items.push(
        remainingCount > 0 ? `${amenityLabels.join(', ')} +${remainingCount} more` : amenityLabels.join(', '),
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
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
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
    <div className="rounded-full border border-stone-200 bg-white p-2 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 py-2 text-left transition hover:bg-stone-50"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F8F5F2] text-[#c76f55]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16" />
              <path d="M7 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
              <path d="M4 17h16" />
              <path d="M13 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-stone-950">
              {summaryItems.length > 0 ? summaryItems.join(' \u00b7 ') : 'All Jerusalem stays'}
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              {hasFilters ? 'Filtered stays' : 'Dates, guests, price, amenities'}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2 px-1 pb-1 md:px-0 md:pb-0">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300 md:flex-none"
          >
            Filters
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
              className="rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 pb-3 pt-10 sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFiltersOpen(false)
          }}
        >
          <div className="flex max-h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5">
            <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-stone-100 px-4 py-4">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
                aria-label="Close filters"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-stone-950">Filters</p>
                <p className="mt-0.5 text-xs text-stone-500">Refine your Jerusalem stay</p>
              </div>
              <span />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <section className="border-b border-stone-100 px-5 py-6 md:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-stone-950">Trip details</h3>
                    <p className="mt-1 text-sm text-stone-500">Set the basics first, then tune the stay.</p>
                  </div>
                </div>

                <StaysDateRangeFilter
                  checkInValue={checkInValue}
                  checkOutValue={checkOutValue}
                  onChange={(range) => {
                    setCheckInValue(range.from ? formatDateISO(range.from) : '')
                    setCheckOutValue(range.to ? formatDateISO(range.to) : '')
                  }}
                />

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)]">
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
                  <NightlyBudgetFilter
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    onMinPriceChange={setMinPrice}
                    onMaxPriceChange={setMaxPrice}
                  />
                </div>
              </section>

              <section className="border-b border-stone-100 px-5 py-6 md:px-7">
                <h3 className="text-base font-bold text-stone-950">Amenities</h3>
                <p className="mt-1 text-sm text-stone-500">Choose the comforts that change the stay.</p>

                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  {STAY_AMENITY_GROUPS.map((group) => {
                    const selectedCount = group.amenities.filter((amenity) =>
                      selectedAmenities.includes(slugifyAmenity(amenity)),
                    ).length

                    return (
                      <section key={group.title} className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{group.title}</p>
                            <p className="mt-1 text-xs leading-5 text-stone-500">{group.description}</p>
                          </div>
                          {selectedCount > 0 && (
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c76f55] px-2 text-[11px] font-bold text-white">
                              {selectedCount}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {group.amenities.map((amenity) => {
                            const value = slugifyAmenity(amenity)
                            const checked = selectedAmenities.includes(value)

                            return (
                              <FilterToggle
                                key={amenity}
                                checked={checked}
                                label={amenity}
                                onChange={() => toggleAmenity(amenity)}
                              />
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>

              <section className="px-5 py-6 md:px-7">
                <h3 className="text-base font-bold text-stone-950">Jewish lifestyle</h3>
                <p className="mt-1 text-sm text-stone-500">Practical details for Shabbos, Yom Tov, and daily rhythm.</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <FilterToggle checked={kosherKitchen} label="Kosher kitchen" onChange={setKosherKitchen} />
                  <FilterToggle checked={shabbatElevator} label="Shabbat elevator" onChange={setShabbatElevator} />
                  <FilterToggle checked={physicalKey} label="Physical key entry" onChange={setPhysicalKey} />
                  <FilterToggle checked={sukkahBalcony} label="Sukkah balcony" onChange={setSukkahBalcony} />
                  <FilterToggle checked={nearSynagogue} label="Near synagogue" onChange={setNearSynagogue} />
                </div>

                <label className="mt-5 block max-w-sm text-sm font-semibold text-stone-700">
                  Walking distance to Kotel
                  <input
                    type="number"
                    min={1}
                    value={maxWalkToKotel}
                    onChange={(event) => setMaxWalkToKotel(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                    placeholder="Within X minutes"
                  />
                </label>
              </section>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-white px-5 py-4 md:px-7">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-bold text-stone-700 underline-offset-4 transition hover:text-stone-950 hover:underline"
              >
                Clear all
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="hidden rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300 sm:inline-flex"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
                >
                  Show stays
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NightlyBudgetFilter({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: {
  minPrice: string
  maxPrice: string
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
}) {
  return (
    <div className="rounded-[1.35rem] border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-700">Nightly budget</p>
          <p className="mt-1 text-xs text-stone-500">Filter by the listed price per night in USD.</p>
        </div>
        {(minPrice || maxPrice) && (
          <button
            type="button"
            onClick={() => {
              onMinPriceChange('')
              onMaxPriceChange('')
            }}
            className="text-xs font-semibold text-stone-400 transition hover:text-stone-700"
          >
            Clear price
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRICE_PRESETS.map((preset) => {
          const selected = minPrice === preset.min && maxPrice === preset.max

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                onMinPriceChange(preset.min)
                onMaxPriceChange(preset.max)
              }}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                selected
                  ? 'border-[#c76f55] bg-[#c76f55] text-white shadow-sm'
                  : 'border-stone-200 bg-[#fbfaf8] text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">
          From
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => onMinPriceChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
            placeholder="$0"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-stone-400">
          Up to
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
            placeholder="Any price"
          />
        </label>
      </div>
    </div>
  )
}

function StaysDateRangeFilter({
  checkInValue,
  checkOutValue,
  onChange,
}: {
  checkInValue: string
  checkOutValue: string
  onChange: (range: { from?: Date; to?: Date }) => void
}) {
  const checkInDate = parseLocalDate(checkInValue)
  const checkOutDate = parseLocalDate(checkOutValue)
  const selectedRange: DayPickerDateRange | undefined = checkInDate
    ? { from: checkInDate, to: checkOutDate }
    : undefined

  return (
    <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-[#fbfaf8] shadow-sm">
      <div className="grid grid-cols-2 border-b border-stone-100 bg-white">
        <DateSummaryCell label="Check in" date={checkInDate} />
        <DateSummaryCell label="Check out" date={checkOutDate} noBorder />
      </div>

      <div className="p-3 sm:p-4">
        <Calendar
          mode="range"
          excludeDisabled
          selected={selectedRange}
          onSelect={(range) => {
            if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
              onChange({ from: range.from, to: undefined })
              return
            }

            onChange(range || { from: undefined, to: undefined })
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
          className="w-full rounded-[1.35rem] bg-white p-4 [--cell-size:2.55rem] sm:[--cell-size:2.75rem]"
          classNames={{
            root: 'w-full',
            months: 'flex w-full flex-col',
            month: 'w-full gap-5',
            month_caption: 'min-h-12',
            weekday: 'text-[10px] font-bold uppercase tracking-wider text-stone-400',
            week: 'mt-2 flex w-full gap-1.5 sm:gap-2',
            weekdays: 'flex gap-1.5 sm:gap-2',
            day: 'aspect-square flex-1 rounded-2xl',
            day_button:
              'rounded-2xl border border-transparent text-sm hover:border-stone-200 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30',
          }}
        />
      </div>

      <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4">
        <p className="text-xs leading-5 text-stone-500">Select arrival and departure dates.</p>
        <button
          type="button"
          onClick={() => onChange({ from: undefined, to: undefined })}
          className="text-xs font-semibold text-stone-400 transition hover:text-stone-700"
        >
          Clear dates
        </button>
      </div>
    </div>
  )
}

function DateSummaryCell({
  label,
  date,
  noBorder = false,
}: {
  label: string
  date?: Date
  noBorder?: boolean
}) {
  return (
    <div className={`${noBorder ? '' : 'border-r border-stone-100'} min-h-24 p-4 text-left sm:p-5`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">{date ? formatCompactDate(date) : 'Choose date'}</p>
      {date && <p className="mt-1 text-[11px] font-medium text-stone-500">{formatHebrewShortDate(date)}</p>}
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
      className={`inline-flex cursor-pointer items-center rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
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
