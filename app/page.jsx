'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { sampleListings } from '@/lib/sample-listings'
import { Calendar } from '@/components/ui/calendar'

/* ---------- Shared UI primitives ---------- */

const JLMLogo = ({ className = '', variant = 'terracotta' }) => {
  const src =
    variant === 'black'
      ? '/logos/JLM_Collective_Horizontal_Black_Transparent.png'
      : '/logos/JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png'

  return (
    <img
      src={src}
      alt="JLM Collective"
      className={`object-contain ${className}`}
    />
  )
}

const SavedStayIcon = ({ className = '' }) => {
  return (
    <img
      src="/icons/yemin-moshe-save.png"
      alt=""
      aria-hidden="true"
      className={`object-contain ${className}`}
    />
  )
}

const SearchIcon = ({ className = '' }) => (
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

const MapPinIcon = ({ className = '' }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
)

const ShieldIcon = ({ className = '' }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

/* ---------- Data ---------- */

// All Jerusalem neighborhoods for autocomplete
const allNeighborhoods = [
  'Ramat Eshkol',
  'Gush 80',
  'Jerusalem Estates',
  'Romema',
  'Minchas Yitzchok',
  'Rechavia',
  'Shaarei Chesed',
  'Baka',
  'German Colony',
  'Katamon',
  'Mamilla',
  'Nachlaot',
  'Talbiya',
  'Ein Kerem',
  'Old City',
  'City Center',
  'Givat Shaul',
  'Har Nof',
  'Bayit Vegan',
  'Kiryat Moshe',
  'Neve Yaakov',
  'Pisgat Zeev',
  'French Hill',
  'Sanhedria',
  'Mea Shearim',
  'Geula',
  'Armon Hanatziv',
  'Abu Tor',
  'Arnona',
  'Malha',
  'Gilo',
  'Pat',
  'Neve Granot',
  'Neve Shaanan',
  'Beit Hakerem',
]

// Top 4 browsed neighborhoods (can be dynamic from analytics later)
const topNeighborhoods = [
  'Ramat Eshkol',
  'Rechavia',
  'German Colony',
  'Romema',
]

const toFeaturedStay = (listing) => ({
  id: listing.id,
  title: listing.title,
  area: listing.area,
  details: `${listing.bedrooms || 0} bedrooms · sleeps ${listing.max_guests || 0}`,
  priceILS: listing.price_ils ? `₪${listing.price_ils.toLocaleString()}` : 'Price on request',
  priceUSD: listing.price_usd ? `$${listing.price_usd.toLocaleString()}` : '',
})

const defaultFeatured = sampleListings.map(toFeaturedStay)

const exploreBlocks = [
  {
    label: 'Neighbourhoods',
    title: 'Popular areas',
    items: [
      'Ramat Eshkol',
      'Gush 80',
      'Romema',
      'Jerusalem Estates',
      'Minchas Yitzchok',
      'Rechavia',
    ],
  },
  {
    label: 'Themes',
    title: 'Search by what matters',
    items: [
      'Family stays',
      'Shabbos-friendly',
      'Near shuls',
      'Lift access',
      'Sukkah option',
      'Longer visits',
    ],
  },
  {
    label: 'Stay types',
    title: 'Choose your setup',
    items: [
      'Apartments',
      'Garden flats',
      'Penthouses',
      'Large homes',
      'Ground floor',
      'Private entrance',
    ],
  },
]

const getExploreHref = (blockLabel, item) => {
  const params = new URLSearchParams()

  if (blockLabel === 'Neighbourhoods') params.set('neighborhood', item)
  if (blockLabel === 'Themes') params.set('feature', item)
  if (blockLabel === 'Stay types') params.set('type', item)

  return `/stays?${params.toString()}`
}

/* ---------- Page ---------- */

const SearchForm = () => {
  const [neighbourhood, setNeighbourhood] = useState('')
  const [showNeighbourhoodSuggestions, setShowNeighbourhoodSuggestions] = useState(false)
  const [placePredictions, setPlacePredictions] = useState([])
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined })
  const [showCalendar, setShowCalendar] = useState(false)
  const [adults, setAdults] = useState(0)
  const [children, setChildren] = useState(0)
  const [showGuestPanel, setShowGuestPanel] = useState(false)
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  
  const neighbourhoodRef = useRef(null)
  const calendarRef = useRef(null)
  const guestRef = useRef(null)
  const placesLibrary = useRef(null)
  const sessionToken = useRef(null)
  const requestIdRef = useRef(0)

  // Initialize Google Places library (new API)
  useEffect(() => {
    const initGooglePlaces = async () => {
      try {
        if (window.google && window.google.maps) {
          // Use the new importLibrary method for async loading
          const places = await window.google.maps.importLibrary('places')
          placesLibrary.current = places
          sessionToken.current = new places.AutocompleteSessionToken()
        }
      } catch (error) {
        console.log('[v0] Google Places library not available, using local fallback')
      }
    }

    if (window.google) {
      initGooglePlaces()
    } else {
      // Load Google Maps script if not already loaded
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
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (neighbourhoodRef.current && !neighbourhoodRef.current.contains(event.target)) {
        setShowNeighbourhoodSuggestions(false)
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
      if (guestRef.current && !guestRef.current.contains(event.target)) {
        setShowGuestPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch Google Places predictions - Google Places is primary source, local neighborhoods as fallback
  const fetchPlacePredictions = useCallback(async (input) => {
    if (!input || input.length < 2) {
      setPlacePredictions([])
      return
    }

    // Local neighborhoods as fallback
    const localMatches = allNeighborhoods.filter(n => 
      n.toLowerCase().includes(input.toLowerCase())
    )

    // Google Places is the primary source (using new AutocompleteSuggestion API)
    if (placesLibrary.current?.AutocompleteSuggestion) {
      setIsLoadingPlaces(true)
      
      // Increment request ID to handle race conditions
      const currentRequestId = ++requestIdRef.current
      
      try {
        const request = {
          input: input,
          sessionToken: sessionToken.current,
          // Bias results toward Jerusalem area
          locationBias: {
            center: { lat: 31.7683, lng: 35.2137 },
            radius: 20000,
          },
          // Restrict to Israel
          includedRegionCodes: ['il'],
          // Language preference
          language: 'en',
        }
        
        const { suggestions } = await placesLibrary.current.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        
        // Check if this request is still the latest
        if (currentRequestId !== requestIdRef.current) return
        
        setIsLoadingPlaces(false)
        
        if (suggestions && suggestions.length > 0) {
          // Google Places results are primary - format them nicely
          const googlePlaces = suggestions
            .filter(s => s.placePrediction)
            .map(s => {
              const prediction = s.placePrediction
              // Get the text representation
              let description = prediction.text?.toString() || prediction.mainText?.toString() || ''
              
              // Clean up the description - remove redundant ", Israel" and format nicely
              description = description
                .replace(/, Israel$/, '')
                .replace(/, ישראל$/, '')
              
              // If it's clearly in Jerusalem, we can keep it shorter
              if (description.includes('Jerusalem') || description.includes('ירושלים')) {
                description = description
                  .replace(/, Jerusalem District$/, '')
                  .replace(/, מחוז ירושלים$/, '')
              }
              
              return {
                text: description,
                isGoogle: true,
                placeId: prediction.placeId,
              }
            })
          
          // Add local matches that aren't already in Google results
          const localOnly = localMatches
            .filter(local => !googlePlaces.some(g => 
              g.text.toLowerCase().includes(local.toLowerCase()) ||
              local.toLowerCase().includes(g.text.toLowerCase().split(',')[0])
            ))
            .map(text => ({ text, isGoogle: false }))
          
          // Google results first, then local fallbacks
          setPlacePredictions([...googlePlaces, ...localOnly].slice(0, 10))
        } else {
          // No Google results - use local neighborhoods
          setPlacePredictions(localMatches.map(text => ({ text, isGoogle: false })))
        }
      } catch (error) {
        console.log('[v0] Google Places error, using local fallback:', error.message)
        setIsLoadingPlaces(false)
        // Fallback to local neighborhoods only
        setPlacePredictions(localMatches.map(text => ({ text, isGoogle: false })))
      }
    } else {
      // No Google Places available - use local neighborhoods only
      setPlacePredictions(localMatches.map(text => ({ text, isGoogle: false })))
    }
  }, [])

  // Debounce place predictions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showNeighbourhoodSuggestions) {
        fetchPlacePredictions(neighbourhood)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [neighbourhood, showNeighbourhoodSuggestions, fetchPlacePredictions])

  const getDateDisplay = () => {
    if (!dateRange.from) return 'Add dates'
    if (!dateRange.to) return format(dateRange.from, 'd MMM')
    return `${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM')}`
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
    if (dateRange.from) params.set('checkin', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('checkout', format(dateRange.to, 'yyyy-MM-dd'))
    if (adults > 0) params.set('adults', adults.toString())
    if (children > 0) params.set('children', children.toString())
    window.location.href = `/stays${params.toString() ? '?' + params.toString() : ''}`
  }

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-stone-200 bg-white p-2 shadow-2xl shadow-stone-200/50 md:rounded-full">
      <div className="grid grid-cols-1 divide-y divide-stone-100 md:grid-cols-[1.45fr_1fr_1fr_auto] md:divide-x md:divide-y-0">
        
        {/* Neighbourhood Field with Google Places */}
        <div className="relative" ref={neighbourhoodRef}>
          <div className="flex flex-col px-6 py-4 text-left md:rounded-l-full">
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">
              Neighbourhood
            </span>
            <input
              type="text"
              value={neighbourhood}
              onChange={(e) => {
                setNeighbourhood(e.target.value)
                setShowNeighbourhoodSuggestions(true)
              }}
              onFocus={() => setShowNeighbourhoodSuggestions(true)}
              placeholder="Start typing a neighbourhood"
              className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-0"
            />
          </div>
          
          {/* Neighbourhood Suggestions Dropdown */}
          {showNeighbourhoodSuggestions && (placePredictions.length > 0 || isLoadingPlaces) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-xl md:left-2 md:right-auto md:w-80">
              {isLoadingPlaces && placePredictions.length === 0 && (
                <div className="px-4 py-3 text-sm text-stone-500">Searching...</div>
              )}
              {placePredictions.map((place, idx) => (
                <button
                  key={`${place.text || place}-${idx}`}
                  onClick={() => {
                    const selectedText = place.text || place
                    setNeighbourhood(selectedText)
                    setShowNeighbourhoodSuggestions(false)
                    // Reset session token for next search
                    if (placesLibrary.current?.AutocompleteSessionToken) {
                      sessionToken.current = new placesLibrary.current.AutocompleteSessionToken()
                    }
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{place.text || place}</span>
                </button>
              ))}
              {neighbourhood && !placePredictions.some(p => (p.text || p).toLowerCase() === neighbourhood.toLowerCase()) && (
                <button
                  onClick={() => {
                    setShowNeighbourhoodSuggestions(false)
                  }}
                  className="flex w-full items-center gap-3 border-t border-stone-100 px-4 py-2.5 text-left text-sm text-[#c76f55] transition hover:bg-stone-50"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Use &quot;{neighbourhood}&quot;</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Date Range Field */}
        <div className="relative" ref={calendarRef}>
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex w-full flex-col px-6 py-4 text-left hover:bg-stone-50"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">
              Dates
            </span>
            <span className={`mt-1 text-sm ${dateRange.from ? 'text-stone-900' : 'text-stone-500'}`}>
              {getDateDisplay()}
            </span>
          </button>

          {/* Calendar Dropdown */}
          {showCalendar && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-300/40 md:left-1/2 md:right-auto md:w-[390px] md:-translate-x-1/2">
              <div className="border-b border-stone-100 bg-[#fbf8f5] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">Select your stay</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Arrival</p>
                    <p className="mt-1 text-sm font-bold text-stone-950">
                      {dateRange.from ? format(dateRange.from, 'EEE, d MMM') : 'Choose date'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Departure</p>
                    <p className="mt-1 text-sm font-bold text-stone-950">
                      {dateRange.to ? format(dateRange.to, 'EEE, d MMM') : 'Choose date'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    // If user clicks the same date twice or clicks on the "from" date, reset to just that date
                    if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
                      setDateRange({ from: range.from, to: undefined })
                      return
                    }
                    setDateRange(range || { from: undefined, to: undefined })
                    // Only auto-close when we have a proper range (different dates)
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
                  <button
                    onClick={() => {
                      setDateRange({ from: new Date(), to: addDays(new Date(), 7) })
                      setTimeout(() => setShowCalendar(false), 300)
                    }}
                    className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
                  >
                    1 week
                  </button>
                  <button
                    onClick={() => {
                      setDateRange({ from: new Date(), to: addDays(new Date(), 14) })
                      setTimeout(() => setShowCalendar(false), 300)
                    }}
                    className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
                  >
                    2 weeks
                  </button>
                </div>
                <button
                  onClick={() => setDateRange({ from: undefined, to: undefined })}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Guests Field */}
        <div className="relative" ref={guestRef}>
          <button 
            onClick={() => setShowGuestPanel(!showGuestPanel)}
            className="flex w-full flex-col px-6 py-4 text-left hover:bg-stone-50"
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-stone-900">
              People
            </span>
            <span className={`mt-1 text-sm ${adults > 0 || children > 0 ? 'text-stone-900' : 'text-stone-500'}`}>
              {getGuestSummary()}
            </span>
          </button>

          {/* Guest Selector Panel */}
          {showGuestPanel && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-300/40 md:left-auto md:right-0 md:w-[360px]">
              <div className="border-b border-stone-100 bg-[#fbf8f5] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">Guests</p>
                <p className="mt-1 text-sm font-semibold text-stone-950">
                  {adults + children > 0 ? getGuestSummary() : 'Who is coming?'}
                </p>
              </div>

              <div className="space-y-3 p-4">
                {[
                  {
                    label: 'Adults',
                    note: 'Ages 18+',
                    value: adults,
                    setValue: setAdults,
                  },
                  {
                    label: 'Children',
                    note: 'Under 18',
                    value: children,
                    setValue: setChildren,
                  },
                ].map((guestType) => (
                  <div
                    key={guestType.label}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
                  >
                    <div>
                      <div className="text-sm font-bold text-stone-950">{guestType.label}</div>
                      <div className="mt-0.5 text-xs text-stone-500">{guestType.note}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => guestType.setValue(Math.max(0, guestType.value - 1))}
                        disabled={guestType.value === 0}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                          guestType.value === 0
                            ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-300'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
                        }`}
                        aria-label={`Decrease ${guestType.label.toLowerCase()}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>

                      <span className="w-7 text-center text-base font-bold text-stone-950">
                        {guestType.value}
                      </span>

                      <button
                        type="button"
                        onClick={() => guestType.setValue(guestType.value + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 transition hover:border-[#c76f55] hover:text-[#c76f55]"
                        aria-label={`Increase ${guestType.label.toLowerCase()}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-stone-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdults(0)
                    setChildren(0)
                  }}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdults(Math.max(1, adults))
                    setShowGuestPanel(false)
                  }}
                  className="rounded-full bg-stone-100 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
                >
                  Just me
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search Button */}
        <div className="p-2">
          <button 
            onClick={handleSearch}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#c76f55] text-white shadow-sm transition hover:bg-[#b65f47] md:w-16 md:rounded-full"
          >
            <SearchIcon className="h-6 w-6" />
            <span className="sr-only">Search</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const NeighborhoodSearch = () => {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('')
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filteredNeighborhoods = query
    ? allNeighborhoods.filter(n => 
        n.toLowerCase().includes(query.toLowerCase())
      )
    : allNeighborhoods

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (neighborhood) => {
    setSelectedNeighborhood(neighborhood)
    setQuery(neighborhood)
    setIsOpen(false)
    // Navigate to stays page with filter
    window.location.href = `/stays?neighborhood=${encodeURIComponent(neighborhood)}`
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {/* Quick select chips */}
      {topNeighborhoods.map((n) => (
        <button
          key={n}
          onClick={() => handleSelect(n)}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold shadow-sm transition ${
            selectedNeighborhood === n
              ? 'border-[#c76f55] bg-[#c76f55] text-white'
              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          {n}
        </button>
      ))}

      {/* Search input with autocomplete */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search area..."
            className="w-32 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-medium text-stone-700 shadow-sm placeholder:text-stone-400 focus:border-[#c76f55] focus:outline-none focus:ring-1 focus:ring-[#c76f55]"
          />
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Dropdown */}
        {isOpen && filteredNeighborhoods.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-48 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
            {filteredNeighborhoods.map((n) => (
              <button
                key={n}
                onClick={() => handleSelect(n)}
                className="w-full px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JLMCollectiveHomePage() {
  const [featuredStays, setFeaturedStays] = useState(defaultFeatured)

  useEffect(() => {
    async function fetchFeaturedStays() {
      if (!isSupabaseConfigured || !supabase) return

      const { data, error } = await supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
        .order('is_featured', { ascending: false })
        .limit(3)

      if (!error && data?.length) {
        setFeaturedStays(data.map(toFeaturedStay))
      }
    }

    fetchFeaturedStays()
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#2D2D2D] antialiased">
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 text-center md:pt-20">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-stone-200">
            <ShieldIcon className="text-[#c76f55]" />
            <span>Curated Jerusalem listings</span>
          </div>

          <div className="mx-auto mb-8 max-w-4xl">
            <h1 className="text-4xl font-bold tracking-tight text-stone-950 md:text-6xl">
              Discover places to stay in Jerusalem
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
              Short-term Jerusalem homes, beautifully organised in one place.
            </p>
          </div>

<SearchForm />

          <a
            href="/stays?view=map"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm hover:border-stone-500"
          >
            <MapPinIcon className="text-[#c76f55]" />
            Open map view
          </a>
        </section>

        {/* Explore */}
        <section id="explore" className="mx-auto max-w-7xl px-6 pb-8 pt-6">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                Explore
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
                Start with the Jerusalem that suits you
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                From quiet family streets to central locations, explore stays by
                area, setup and trip style.
              </p>
            </div>

            <a
              href="/stays"
              className="w-fit rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm hover:border-stone-500"
            >
              View all collections
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {exploreBlocks.map((block) => (
              <div
                key={block.label}
                className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                  {block.label}
                </p>

                <h3 className="mt-3 text-lg font-bold text-stone-950">
                  {block.title}
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  {block.items.map((item) => (
                    <a
                      key={item}
                      href={getExploreHref(block.label, item)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-3xl border border-stone-200 bg-[#252525] p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#d9937e]">
                Seasonal
              </p>

              <h3 className="mt-3 text-lg font-bold">
                Planning around busy dates?
              </h3>

              <p className="mt-3 text-sm leading-6 text-stone-300">
                Browse stays for Yom Tov, summer visits and longer family trips.
              </p>

              <a
                href="/stays?season=busy-dates"
                className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-950 hover:bg-stone-100"
              >
                See seasonal stays
              </a>
            </div>
          </div>
        </section>

{/* Stays + Map */}
        <section
          id="stays"
          className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]"
        >
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-stone-900">
                  Featured stays
                </h2>
                <p className="text-xs text-stone-500">
                  Browse current listings across Jerusalem
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/stays"
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-bold text-stone-700 shadow-sm hover:bg-stone-50"
                >
                  Filters
                </a>
                <a
                  href="/map"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#252525] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-[#111111]"
                >
                  <MapPinIcon className="h-3 w-3" />
                  Map
                </a>
              </div>
            </div>

            <NeighborhoodSearch />

<div className="grid gap-5 md:grid-cols-3">
              {featuredStays.map((stay) => (
                <a key={stay.title} href={`/listings/${stay.id}`} className="group cursor-pointer">
                  <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-stone-200 shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
                  </div>

                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">
                        {stay.area}
                      </p>
                      <h3 className="mt-0.5 text-sm font-bold leading-tight group-hover:underline">
                        {stay.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {stay.details}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">{stay.priceILS}</p>
                      <p className="text-[10px] font-medium text-stone-400">
                        {stay.priceUSD}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

<aside
            id="map"
            className="sticky top-24 hidden h-[380px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block"
          >
            <div className="relative h-full bg-[#E9DFD2]">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'radial-gradient(#cdbfad 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              />

              <div className="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 shadow-md">
                <div className="text-xs font-bold">Map view</div>
                <div className="text-[10px] text-stone-500">Browse by area</div>
              </div>

              <a
                href="/map"
                className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-stone-800 shadow-md transition hover:bg-stone-50"
              >
                Full screen
              </a>

              <a href="/map" className="absolute left-[38%] top-[26%] rounded-lg bg-[#c76f55] px-2 py-1 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5">
                ₪14.9k
              </a>

              <a href="/map" className="absolute left-[56%] top-[42%] rounded-lg bg-[#c76f55] px-2 py-1 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5">
                ₪18.5k
              </a>

              <a href="/map" className="absolute left-[24%] top-[58%] rounded-lg bg-white px-2 py-1 text-xs font-bold text-stone-800 shadow-lg transition hover:-translate-y-0.5">
                ₪12.9k
              </a>

              <a href="/map" className="absolute left-[48%] top-[70%] rounded-lg bg-white px-2 py-1 text-xs font-bold text-stone-800 shadow-lg transition hover:-translate-y-0.5">
                ₪15.9k
              </a>

              <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-3 shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-[#c76f55]" />
                    <div>
                      <div className="text-xs font-bold">Open full map</div>
                      <div className="text-[10px] text-stone-500">View prices and areas</div>
                    </div>
                  </div>
                  <a
                    href="/map"
                    className="rounded-full bg-[#252525] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#111111]"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </section>

{/* Saved */}
        <section id="saved" className="mx-auto max-w-7xl px-6 pb-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-[#F8F5F2]">
                  <SavedStayIcon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    Keep track of stays you like
                  </h2>
                  <p className="text-xs text-stone-500">
                    Your saved properties will appear here once favourites are connected.
                  </p>
                </div>
              </div>

              <a
                href="/host/register"
                className="w-fit rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 shadow-sm hover:border-stone-500"
              >
                Create account
              </a>
            </div>
          </div>
        </section>

{/* Owner CTA */}
        <section id="owner" className="mx-auto max-w-7xl px-6 pb-12 pt-4">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#252525] shadow-sm">
            <div className="flex flex-col gap-4 p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Have a Jerusalem stay to list?
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-stone-300">
                  Add your property, set your details, and submit it for approval.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <a
                  href="/become-a-host"
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-stone-100"
                >
                  List your stay
                </a>

                <a
                  href="/become-a-host"
                  className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        </section>
</main>
    </div>
  )
}
