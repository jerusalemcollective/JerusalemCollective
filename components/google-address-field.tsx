'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react'

type PlacesLocation = {
  lat: () => number
  lng: () => number
}

type PlaceRecord = {
  formattedAddress?: string
  location?: PlacesLocation
  fetchFields: (options: { fields: string[] }) => Promise<void>
}

type NewPlacePrediction = {
  toPlace: () => PlaceRecord
  text?: { toString: () => string }
  mainText?: { toString: () => string }
}

type NewGoogleSuggestion = {
  placePrediction?: NewPlacePrediction
}

type LegacyPlacePrediction = {
  description: string
  place_id: string
}

type LegacyPlaceResult = {
  formatted_address?: string
  geometry?: {
    location?: PlacesLocation
  }
}

type LegacyAutocompleteService = {
  getPlacePredictions: (
    request: Record<string, unknown>,
    callback: (predictions: LegacyPlacePrediction[] | null, status: string) => void,
  ) => void
}

type LegacyPlacesService = {
  getDetails: (
    request: Record<string, unknown>,
    callback: (place: LegacyPlaceResult | null, status: string) => void,
  ) => void
}

type PlacesLibrary = {
  AutocompleteSessionToken?: new () => unknown
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: Record<string, unknown>) => Promise<{ suggestions?: NewGoogleSuggestion[] }>
  }
  AutocompleteService?: new () => LegacyAutocompleteService
  PlacesService?: new (container: HTMLDivElement) => LegacyPlacesService
  PlacesServiceStatus?: {
    OK: string
  }
}

type GoogleMapsValue = {
  maps?: {
    importLibrary?: (library: 'places') => Promise<PlacesLibrary>
    Circle?: new (options: { center: { lat: number; lng: number }; radius: number }) => unknown
    places?: PlacesLibrary
  }
}

type MapsWindow = {
  google?: {
    maps?: {
      importLibrary?: (library: 'places') => Promise<PlacesLibrary>
      Circle?: new (options: { center: { lat: number; lng: number }; radius: number }) => unknown
      places?: PlacesLibrary
    }
  }
}

type AddressSuggestion = {
  label: string
  newPrediction?: NewPlacePrediction
  legacyPlaceId?: string
  fallbackLatitude?: number
  fallbackLongitude?: number
}

function cleanAddressLabel(label: string) {
  const cleaned = label
    .replace(/,\s*ישראל/g, ', Israel')
    .replace(/,\s*إسرائيل/g, ', Israel')
    .replace(/,\s*ירושלים/g, ', Jerusalem')
    .replace(/,\s*القدس/g, ', Jerusalem')
    .replace(/,\s*מחוז ירושלים/g, ', Jerusalem District')
    .replace(/,\s*منطقة القدس/g, ', Jerusalem District')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !['Israel', 'Jerusalem District'].includes(part))

  const dedupedParts = parts.filter((part, index) => parts.indexOf(part) === index)
  const hasJerusalem = dedupedParts.some((part) => part.toLowerCase() === 'jerusalem')
  const shortenedParts = dedupedParts.slice(0, hasJerusalem ? 3 : 2)

  if (!hasJerusalem) shortenedParts.push('Jerusalem')

  return shortenedParts.join(', ')
}

type BackupAddressSuggestion = {
  id: string
  label: string
  latitude: number
  longitude: number
}

type GoogleAddressFieldProps = {
  value?: string
  defaultValue?: string
  name?: string
  latitudeName?: string
  longitudeName?: string
  defaultLatitude?: number | null
  defaultLongitude?: number | null
  onAddressChange?: (address: string) => void
  onCoordinatesChange?: (latitude: number | null, longitude: number | null) => void
  placeholder?: string
  className?: string
  required?: boolean
}

let googlePlacesPromise: Promise<PlacesLibrary> | null = null

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

function getLoadedPlacesLibrary(): PlacesLibrary | null {
  const mapsWindow = getMapsWindow()
  return mapsWindow.google?.maps?.places || null
}

function loadGooglePlacesLibrary(apiKey: string): Promise<PlacesLibrary> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'))
  }

  const mapsWindow = getMapsWindow()

  if (mapsWindow.google?.maps?.places) {
    return Promise.resolve(mapsWindow.google.maps.places)
  }

  if (mapsWindow.google?.maps?.importLibrary) {
    return mapsWindow.google.maps.importLibrary('places')
  }

  if (!googlePlacesPromise) {
    googlePlacesPromise = new Promise<PlacesLibrary>((resolve, reject) => {
      const finishLoading = async () => {
        try {
          const loadedPlaces = getLoadedPlacesLibrary()
          if (loadedPlaces) {
            resolve(loadedPlaces)
            return
          }

          if (mapsWindow.google?.maps?.importLibrary) {
            resolve(await mapsWindow.google.maps.importLibrary('places'))
            return
          }

          reject(new Error('Google Maps loaded without Places.'))
        } catch (error) {
          reject(error)
        }
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')

      if (existingScript) {
        if (mapsWindow.google?.maps) {
          void finishLoading()
          return
        }

        existingScript.addEventListener('load', finishLoading, { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load.')), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`
      script.async = true
      script.defer = true
      script.onload = finishLoading
      script.onerror = () => reject(new Error('Google Maps script failed to load.'))
      document.head.appendChild(script)
    })
  }

  return googlePlacesPromise
}

export function GoogleAddressField({
  value,
  defaultValue = '',
  name,
  latitudeName,
  longitudeName,
  defaultLatitude = null,
  defaultLongitude = null,
  onAddressChange,
  onCoordinatesChange,
  placeholder,
  className,
  required = false,
}: GoogleAddressFieldProps) {
  const placesLibrary = useRef<PlacesLibrary | null>(null)
  const placesServiceContainerRef = useRef<HTMLDivElement | null>(null)
  const sessionToken = useRef<unknown>(null)
  const requestIdRef = useRef(0)
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [latitude, setLatitude] = useState<number | null>(defaultLatitude)
  const [longitude, setLongitude] = useState<number | null>(defaultLongitude)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isValidated, setIsValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [loadError, setLoadError] = useState('')
  const addressValue = isControlled ? value || '' : internalValue

  async function fetchBackupSuggestions(query: string): Promise<AddressSuggestion[]> {
    const response = await fetch(`/api/address-suggestions?q=${encodeURIComponent(query)}`)
    if (!response.ok) return []

    const data = (await response.json()) as { suggestions?: BackupAddressSuggestion[] }
    return (data.suggestions || []).map((suggestion) => ({
      label: suggestion.label,
      fallbackLatitude: suggestion.latitude,
      fallbackLongitude: suggestion.longitude,
    }))
  }

  useEffect(() => {
    let isMounted = true
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setLoadError('')
      setIsLoading(false)
      return
    }
    const googleMapsApiKey = apiKey

    async function initPlaces() {
      try {
        const places = await loadGooglePlacesLibrary(googleMapsApiKey)
        if (!isMounted) return

        if (!places.AutocompleteService && !places.AutocompleteSuggestion) {
          setLoadError('')
          setIsLoading(false)
          return
        }

        placesLibrary.current = places
        sessionToken.current = places.AutocompleteSessionToken ? new places.AutocompleteSessionToken() : null
        setLoadError('')
        setIsLoading(false)
      } catch (error) {
        console.error('Google address lookup failed:', error)
        if (isMounted) {
          setLoadError('')
          setIsLoading(false)
        }
      }
    }

    void initPlaces()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading || loadError || addressValue.trim().length < 3) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    const timer = window.setTimeout(async () => {
      const places = placesLibrary.current
      const mapsWindow = getMapsWindow()
      const currentRequestId = ++requestIdRef.current
      setIsSearching(true)

      try {
        let nextSuggestions: AddressSuggestion[] = []

        if (places?.AutocompleteService) {
          const service = new places.AutocompleteService()
          const predictions = await new Promise<LegacyPlacePrediction[]>((resolve) => {
            service.getPlacePredictions(
              {
                input: `${addressValue} Jerusalem`,
                componentRestrictions: { country: 'il' },
                types: ['address'],
                language: 'en',
                region: 'il',
              },
              (results) => resolve(results || []),
            )
          })

          nextSuggestions = predictions.slice(0, 8).map((prediction) => ({
            label: cleanAddressLabel(prediction.description),
            legacyPlaceId: prediction.place_id,
          }))
        } else if (places?.AutocompleteSuggestion) {
          const request: Record<string, unknown> = {
            input: `${addressValue} Jerusalem`,
            sessionToken: sessionToken.current,
            includedRegionCodes: ['il'],
            includedPrimaryTypes: ['street_address', 'premise', 'route'],
            language: 'en',
          }

          if (mapsWindow.google?.maps?.Circle) {
            request.locationBias = new mapsWindow.google.maps.Circle({
              center: { lat: 31.7683, lng: 35.2137 },
              radius: 18000,
            })
          }

          const { suggestions: googleSuggestions } =
            await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)

          nextSuggestions = (googleSuggestions || [])
            .map((suggestion): AddressSuggestion | null => {
              const prediction = suggestion.placePrediction
              const label = prediction?.text?.toString() || prediction?.mainText?.toString() || ''
              return prediction && label ? { label: cleanAddressLabel(label), newPrediction: prediction } : null
            })
            .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
            .slice(0, 8)
        }

        if (nextSuggestions.length === 0) {
          nextSuggestions = await fetchBackupSuggestions(addressValue)
        }

        if (currentRequestId !== requestIdRef.current) return

        setSuggestions(nextSuggestions)
        setIsOpen(nextSuggestions.length > 0)
        setHighlightedIndex(-1)
      } catch (error) {
        console.error('Google address suggestions failed:', error)
        if (currentRequestId === requestIdRef.current) {
          const backupSuggestions = await fetchBackupSuggestions(addressValue)
          setSuggestions(backupSuggestions)
          setIsOpen(backupSuggestions.length > 0)
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsSearching(false)
        }
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [addressValue, isLoading, loadError])

  const setAddress = (nextValue: string) => {
    if (!isControlled) setInternalValue(nextValue)
    onAddressChange?.(nextValue)
  }

  const setCoordinates = (nextLatitude: number | null, nextLongitude: number | null) => {
    setLatitude(nextLatitude)
    setLongitude(nextLongitude)
    onCoordinatesChange?.(nextLatitude, nextLongitude)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIsValidated(false)
    setAddress(event.target.value)
    setCoordinates(null, null)
  }

  const handleSelect = async (suggestion: AddressSuggestion) => {
    try {
      let nextAddress = suggestion.label
      let nextLatitude: number | null = null
      let nextLongitude: number | null = null

      if (suggestion.legacyPlaceId && placesLibrary.current?.PlacesService && placesServiceContainerRef.current) {
        const places = placesLibrary.current
        const service = new places.PlacesService(placesServiceContainerRef.current)
        const place = await new Promise<LegacyPlaceResult | null>((resolve) => {
          service.getDetails(
            {
              placeId: suggestion.legacyPlaceId,
              fields: ['formatted_address', 'geometry'],
            },
            (result, status) => {
              const okStatus = places.PlacesServiceStatus?.OK || 'OK'
              resolve(status === okStatus ? result : null)
            },
          )
        })

        nextAddress = cleanAddressLabel(place?.formatted_address || suggestion.label)
        nextLatitude = place?.geometry?.location?.lat() ?? null
        nextLongitude = place?.geometry?.location?.lng() ?? null
      } else if (suggestion.newPrediction) {
        const place = suggestion.newPrediction.toPlace()
        await place.fetchFields({ fields: ['formattedAddress', 'location'] })
        nextAddress = cleanAddressLabel(place.formattedAddress || suggestion.label)
        nextLatitude = place.location?.lat() ?? null
        nextLongitude = place.location?.lng() ?? null
      } else if (suggestion.fallbackLatitude !== undefined && suggestion.fallbackLongitude !== undefined) {
        nextLatitude = suggestion.fallbackLatitude
        nextLongitude = suggestion.fallbackLongitude
      }

      setAddress(nextAddress)
      setCoordinates(nextLatitude, nextLongitude)
      setIsValidated(true)
      setIsOpen(false)
      setSuggestions([])
    } catch (error) {
      console.error('Google address selection failed:', error)
      setLoadError('Address lookup is unavailable. Type the address manually and continue.')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => (current < suggestions.length - 1 ? current + 1 : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => (current > 0 ? current - 1 : suggestions.length - 1))
    } else if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault()
      void handleSelect(suggestions[highlightedIndex])
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <div ref={placesServiceContainerRef} className="hidden" />
      <input
        name={name}
        type="text"
        value={addressValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true)
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="street-address"
        required={required}
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      {latitudeName && <input type="hidden" name={latitudeName} value={latitude ?? ''} />}
      {longitudeName && <input type="hidden" name={longitudeName} value={longitude ?? ''} />}

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-lg"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.label}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`cursor-pointer px-4 py-3 text-sm transition ${
                index === highlightedIndex
                  ? 'bg-[#F8F5F2] text-stone-900'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event: MouseEvent<HTMLLIElement>) => {
                event.preventDefault()
                void handleSelect(suggestion)
              }}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}

      {addressValue && isValidated && (
        <p className="mt-1 text-xs text-green-600">Address validated with Google Maps.</p>
      )}
      {addressValue && !isValidated && !isLoading && !loadError && (
        <p className="mt-1 text-xs text-stone-500">
          {isSearching ? 'Searching Google Maps...' : 'Choose a suggestion or keep your manually typed address.'}
        </p>
      )}
      {isLoading && (
        <p className="mt-1 text-xs text-stone-500">
          Loading Google address suggestions. You can type manually now.
        </p>
      )}
      {loadError && <p className="mt-1 text-xs text-amber-700">{loadError}</p>}
    </div>
  )
}
