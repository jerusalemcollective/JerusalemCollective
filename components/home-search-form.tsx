'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { Calendar } from '@/components/ui/calendar'
import { formatHebrewShortDate } from '@/lib/hebrew-date'
import { formatDateISO } from '@/lib/utils/date'

type DateRange = {
  from?: Date
  to?: Date
}

type PlacePrediction = {
  text: string
  isGoogle?: boolean
  placeId?: string
}

type GoogleSuggestion = {
  placePrediction?: {
    text?: { toString: () => string }
    mainText?: { toString: () => string }
    placeId?: string
  }
}

type PlacesLibrary = {
  AutocompleteSessionToken?: new () => unknown
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: Record<string, unknown>) => Promise<{ suggestions?: GoogleSuggestion[] }>
  }
}

type GoogleMapsValue = {
  maps?: {
    importLibrary?: (library: 'places') => Promise<PlacesLibrary>
    Circle?: new (options: { center: { lat: number; lng: number }; radius: number }) => unknown
  }
}

type MapsWindow = {
  google?: {
    maps?: {
      importLibrary?: (library: 'places') => Promise<PlacesLibrary>
      Circle?: new (options: { center: { lat: number; lng: number }; radius: number }) => unknown
    }
  }
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function formatCompactDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGoogleMapsValue(value: unknown): value is GoogleMapsValue {
  if (!isRecord(value)) return false
  const maps = value.maps
  return maps === undefined || isRecord(maps)
}

function getMapsWindow(): MapsWindow {
  const googleValue: unknown = Reflect.get(window, 'google')
  return isGoogleMapsValue(googleValue)
    ? { google: googleValue }
    : {}
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  )
}

function trackNeighborhoodSearch(neighborhood: string, source: string) {
  if (!neighborhood.trim()) return

  void fetch('/api/neighborhood-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ neighborhood, source }),
  })
}

export function HomeSearchForm() {
  const [neighbourhood, setNeighbourhood] = useState('')
  const [showNeighbourhoodSuggestions, setShowNeighbourhoodSuggestions] = useState(false)
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([])
  const [dateRange, setDateRange] = useState<DateRange>({})
  const [showCalendar, setShowCalendar] = useState(false)
  const [adults, setAdults] = useState(0)
  const [children, setChildren] = useState(0)
  const [showGuestPanel, setShowGuestPanel] = useState(false)
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [shouldLoadPlaces, setShouldLoadPlaces] = useState(false)
  const neighbourhoodRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<HTMLDivElement | null>(null)
  const guestRef = useRef<HTMLDivElement | null>(null)
  const placesLibrary = useRef<PlacesLibrary | null>(null)
  const sessionToken = useRef<unknown>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!shouldLoadPlaces) return

    const mapsWindow = getMapsWindow()
    const initGooglePlaces = async () => {
      try {
        if (mapsWindow.google?.maps?.importLibrary) {
          const places = await mapsWindow.google.maps.importLibrary('places')
          placesLibrary.current = places
          sessionToken.current = places.AutocompleteSessionToken ? new places.AutocompleteSessionToken() : null
        }
      } catch {
        console.log('[v0] Google Places library not available, using local fallback')
      }
    }

    if (mapsWindow.google) {
      void initGooglePlaces()
    } else {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (!existingScript) {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&libraries=places&loading=async`
        script.async = true
        script.onload = initGooglePlaces
        document.head.appendChild(script)
      } else {
        existingScript.addEventListener('load', initGooglePlaces)
      }
    }
  }, [shouldLoadPlaces])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (neighbourhoodRef.current && !neighbourhoodRef.current.contains(event.target as Node)) {
        setShowNeighbourhoodSuggestions(false)
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
      if (guestRef.current && !guestRef.current.contains(event.target as Node)) {
        setShowGuestPanel(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchPlacePredictions = useCallback(async (input: string) => {
    if (!input || input.length < 2) {
      setPlacePredictions([])
      return
    }

    const localMatches = allNeighborhoods.filter((neighborhood) =>
      neighborhood.toLowerCase().includes(input.toLowerCase()),
    )

    const mapsWindow = getMapsWindow()
    if (placesLibrary.current?.AutocompleteSuggestion && mapsWindow.google?.maps?.Circle) {
      setIsLoadingPlaces(true)
      const currentRequestId = ++requestIdRef.current

      try {
        const jerusalemCircle = new mapsWindow.google.maps.Circle({
          center: { lat: 31.7683, lng: 35.2137 },
          radius: 25000,
        })
        const { suggestions } = await placesLibrary.current.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: `${input} Jerusalem`,
          sessionToken: sessionToken.current,
          locationBias: jerusalemCircle,
          includedRegionCodes: ['il'],
          language: 'en',
        })

        if (currentRequestId !== requestIdRef.current) return

        setIsLoadingPlaces(false)

        if (suggestions?.length) {
          const googlePlaces = suggestions
            .filter((suggestion) => suggestion.placePrediction)
            .map((suggestion) => {
              const prediction = suggestion.placePrediction
              let description = prediction?.text?.toString() || prediction?.mainText?.toString() || ''
              description = description
                .replace(/, Israel$/, '')
                .replace(/, ×™×©×¨××œ$/, '')

              if (description.includes('Jerusalem') || description.includes('×™×¨×•×©×œ×™×')) {
                description = description
                  .replace(/, Jerusalem District$/, '')
                  .replace(/, ×ž×—×•×– ×™×¨×•×©×œ×™×$/, '')
              }

              return {
                text: description,
                isGoogle: true,
                placeId: prediction?.placeId,
              }
            })
          const localOnly = localMatches
            .filter((local) => !googlePlaces.some((googlePlace) =>
              googlePlace.text.toLowerCase().includes(local.toLowerCase()) ||
              local.toLowerCase().includes(googlePlace.text.toLowerCase().split(',')[0]),
            ))
            .map((text) => ({ text, isGoogle: false }))

          setPlacePredictions([...googlePlaces, ...localOnly].slice(0, 10))
        } else {
          setPlacePredictions(localMatches.map((text) => ({ text, isGoogle: false })))
        }
      } catch (error) {
        console.log('[v0] Google Places error, using local fallback:', error instanceof Error ? error.message : error)
        setIsLoadingPlaces(false)
        setPlacePredictions(localMatches.map((text) => ({ text, isGoogle: false })))
      }
    } else {
      setPlacePredictions(localMatches.map((text) => ({ text, isGoogle: false })))
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showNeighbourhoodSuggestions) {
        void fetchPlacePredictions(neighbourhood)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [neighbourhood, showNeighbourhoodSuggestions, fetchPlacePredictions])

  const getDateDisplay = () => {
    if (!dateRange.from) return 'Add dates'
    if (!dateRange.to) return formatShortDate(dateRange.from)
    return `${formatShortDate(dateRange.from)} - ${formatShortDate(dateRange.to)}`
  }

  const getGuestSummary = () => {
    if (adults === 0 && children === 0) return 'Add guests'
    const parts = []
    if (adults > 0) parts.push(`${adults} adult${adults > 1 ? 's' : ''}`)
    if (children > 0) parts.push(`${children} child${children > 1 ? 'ren' : ''}`)
    return parts.join(', ')
  }

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (neighbourhood) params.set('neighborhood', neighbourhood)
    if (dateRange.from) params.set('checkIn', formatDateISO(dateRange.from))
    if (dateRange.to) params.set('checkOut', formatDateISO(dateRange.to))
    if (adults + children > 0) params.set('guests', String(adults + children))
    if (neighbourhood) trackNeighborhoodSearch(neighbourhood, 'hero_search')
    window.location.href = `/stays${params.toString() ? `?${params.toString()}` : ''}`
  }

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-200/40">
      <div className="grid grid-cols-1 divide-y divide-stone-100 md:grid-cols-[1.45fr_1fr_1fr_auto] md:divide-x md:divide-y-0">
        <div className="relative" ref={neighbourhoodRef}>
          <div className="flex flex-col rounded-2xl px-5 py-3 text-left transition focus-within:bg-[#faf8f6] focus-within:ring-2 focus-within:ring-stone-400">
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">Neighbourhood</span>
            <input
              type="text"
              value={neighbourhood}
              onChange={(event) => {
                setNeighbourhood(event.target.value)
                setShowNeighbourhoodSuggestions(true)
                setShouldLoadPlaces(true)
              }}
              onFocus={() => {
                setShowNeighbourhoodSuggestions(true)
                setShouldLoadPlaces(true)
              }}
              placeholder="Rechavia, German Colony, Old City..."
              className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none"
            />
          </div>

          {showNeighbourhoodSuggestions && (placePredictions.length > 0 || isLoadingPlaces) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-xl md:left-2 md:right-auto md:w-80">
              {isLoadingPlaces && placePredictions.length === 0 && (
                <div className="px-4 py-3 text-sm text-stone-500">Searching...</div>
              )}
              {placePredictions.map((place, index) => (
                <button
                  key={`${place.text}-${index}`}
                  onClick={() => {
                    setNeighbourhood(place.text)
                    setShowNeighbourhoodSuggestions(false)
                    if (placesLibrary.current?.AutocompleteSessionToken) {
                      sessionToken.current = new placesLibrary.current.AutocompleteSessionToken()
                    }
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  <MapPinSmallIcon />
                  <span className="truncate">{place.text}</span>
                </button>
              ))}
              {neighbourhood && !placePredictions.some((place) => place.text.toLowerCase() === neighbourhood.toLowerCase()) && (
                <button
                  onClick={() => setShowNeighbourhoodSuggestions(false)}
                  className="flex w-full items-center gap-3 border-t border-stone-100 px-4 py-2.5 text-left text-sm text-[#c76f55] transition hover:bg-stone-50"
                >
                  <PlusIcon />
                  <span>Use &quot;{neighbourhood}&quot;</span>
                </button>
              )}
            </div>
          )}
        </div>

        <DateSelector
          calendarRef={calendarRef}
          dateRange={dateRange}
          setDateRange={setDateRange}
          showCalendar={showCalendar}
          setShowCalendar={setShowCalendar}
          getDateDisplay={getDateDisplay}
        />

        <GuestSelector
          guestRef={guestRef}
          adults={adults}
          children={children}
          setAdults={setAdults}
          setChildren={setChildren}
          showGuestPanel={showGuestPanel}
          setShowGuestPanel={setShowGuestPanel}
          getGuestSummary={getGuestSummary}
        />

        <div className="p-2">
          <button
            onClick={handleSearch}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#252525] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#111111]"
          >
            <SearchIcon className="h-5 w-5" />
            Search
          </button>
        </div>
      </div>
    </div>
  )
}

function DateSelector({
  calendarRef,
  dateRange,
  setDateRange,
  showCalendar,
  setShowCalendar,
  getDateDisplay,
}: {
  calendarRef: RefObject<HTMLDivElement | null>
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  showCalendar: boolean
  setShowCalendar: Dispatch<SetStateAction<boolean>>
  getDateDisplay: () => string
}) {
  const selectedRange: DayPickerDateRange | undefined = dateRange.from
    ? { from: dateRange.from, to: dateRange.to }
    : undefined

  return (
    <div className="relative" ref={calendarRef}>
      <button onClick={() => setShowCalendar(!showCalendar)} className="flex w-full flex-col rounded-2xl px-5 py-3 text-left transition hover:bg-stone-50 focus-visible:bg-[#faf8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">Dates</span>
        <span className={`mt-1 text-sm ${dateRange.from ? 'text-stone-900' : 'text-stone-500'}`}>{getDateDisplay()}</span>
      </button>

      {showCalendar && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-300/40 md:left-1/2 md:right-auto md:w-[390px] md:-translate-x-1/2">
          <div className="border-b border-stone-100 bg-[#fbf8f5] px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">Select your stay</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <DateSummary label="Arrival" date={dateRange.from} />
              <DateSummary label="Departure" date={dateRange.to} />
            </div>
          </div>
          <div className="p-5">
            <Calendar
              mode="range"
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
              disabled={{ before: new Date() }}
              showOutsideDays={false}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between border-t border-stone-100 bg-white px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { setDateRange({ from: new Date(), to: addDays(new Date(), 7) }); setTimeout(() => setShowCalendar(false), 300) }} className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200">1 week</button>
              <button onClick={() => { setDateRange({ from: new Date(), to: addDays(new Date(), 14) }); setTimeout(() => setShowCalendar(false), 300) }} className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200">2 weeks</button>
            </div>
            <button onClick={() => setDateRange({ from: undefined, to: undefined })} className="text-xs font-bold text-stone-500 hover:text-stone-800">Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DateSummary({ label, date }: { label: string; date?: Date }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-stone-950">{date ? formatCompactDate(date) : 'Choose date'}</p>
      {date && <p className="mt-1 text-[11px] font-medium text-stone-500">{formatHebrewShortDate(date)}</p>}
    </div>
  )
}

function GuestSelector({
  guestRef,
  adults,
  children,
  setAdults,
  setChildren,
  showGuestPanel,
  setShowGuestPanel,
  getGuestSummary,
}: {
  guestRef: RefObject<HTMLDivElement | null>
  adults: number
  children: number
  setAdults: Dispatch<SetStateAction<number>>
  setChildren: Dispatch<SetStateAction<number>>
  showGuestPanel: boolean
  setShowGuestPanel: Dispatch<SetStateAction<boolean>>
  getGuestSummary: () => string
}) {
  return (
    <div className="relative" ref={guestRef}>
      <button onClick={() => setShowGuestPanel(!showGuestPanel)} className="flex w-full flex-col rounded-2xl px-5 py-3 text-left transition hover:bg-stone-50 focus-visible:bg-[#faf8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">People</span>
        <span className={`mt-1 text-sm ${adults > 0 || children > 0 ? 'text-stone-900' : 'text-stone-500'}`}>{getGuestSummary()}</span>
      </button>

      {showGuestPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-300/40 md:left-auto md:right-0 md:w-[360px]">
          <div className="border-b border-stone-100 bg-[#fbf8f5] px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">Guests</p>
            <p className="mt-1 text-sm font-semibold text-stone-950">{adults + children > 0 ? getGuestSummary() : 'Who is coming?'}</p>
          </div>
          <div className="space-y-3 p-4">
            <GuestRow label="Adults" note="Ages 18+" value={adults} setValue={setAdults} />
            <GuestRow label="Children" note="Under 18" value={children} setValue={setChildren} />
          </div>
          <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4">
            <button type="button" onClick={() => { setAdults(0); setChildren(0) }} className="text-xs font-bold text-stone-500 hover:text-stone-800">Clear</button>
            <button type="button" onClick={() => { setAdults(Math.max(1, adults)); setShowGuestPanel(false) }} className="rounded-full bg-stone-100 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200">Just me</button>
          </div>
        </div>
      )}
    </div>
  )
}

function GuestRow({
  label,
  note,
  value,
  setValue,
}: {
  label: string
  note: string
  value: number
  setValue: Dispatch<SetStateAction<number>>
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div>
        <div className="text-sm font-bold text-stone-950">{label}</div>
        <div className="mt-0.5 text-xs text-stone-500">{note}</div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setValue(Math.max(0, value - 1))} disabled={value === 0} className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${value === 0 ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300' : 'border-stone-300 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'}`} aria-label={`Decrease ${label.toLowerCase()}`}>
          <MinusIcon />
        </button>
        <span className="w-7 text-center text-base font-bold text-stone-950">{value}</span>
        <button type="button" onClick={() => setValue(value + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#c76f55] hover:text-[#c76f55]" aria-label={`Increase ${label.toLowerCase()}`}>
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

export function HomeNeighborhoodSearch({ popularNeighborhoods }: { popularNeighborhoods: string[] }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const filteredNeighborhoods = query
    ? allNeighborhoods.filter((neighborhood) => neighborhood.toLowerCase().includes(query.toLowerCase()))
    : allNeighborhoods

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (neighborhood: string) => {
    setSelectedNeighborhood(neighborhood)
    setQuery(neighborhood)
    setIsOpen(false)
    trackNeighborhoodSearch(neighborhood, 'featured_neighborhood')
    window.location.href = `/stays?neighborhood=${encodeURIComponent(neighborhood)}`
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {popularNeighborhoods.map((neighborhood) => (
        <button
          key={neighborhood}
          onClick={() => handleSelect(neighborhood)}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold shadow-sm transition ${
            selectedNeighborhood === neighborhood
              ? 'border-[#c76f55] bg-[#c76f55] text-white'
              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          {neighborhood}
        </button>
      ))}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search area..."
            className="w-32 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-medium text-stone-700 shadow-sm placeholder:text-stone-500 focus:border-[#c76f55] focus:outline-none focus:ring-1 focus:ring-[#c76f55]"
          />
          <SearchSmallIcon />
        </div>
        {isOpen && filteredNeighborhoods.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-48 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
            {filteredNeighborhoods.map((neighborhood) => (
              <button
                key={neighborhood}
                onClick={() => handleSelect(neighborhood)}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
              >
                {neighborhood}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MapPinSmallIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SearchSmallIcon() {
  return (
    <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  )
}
