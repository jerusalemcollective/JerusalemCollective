'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { ensureHostProfile } from '@/lib/host-profile'
import { HOST_TERMS, HOST_TERMS_LAST_UPDATED, HOST_TERMS_VERSION } from '@/lib/host-terms'
import { GoogleAddressField } from '@/components/google-address-field'
import { AmenitySelector } from '@/components/amenity-selector'

type PhotoUpload = {
  file: File
  preview: string
  label: string
}

type DocumentUpload = {
  file: File
  preview: string | null
  name: string
  type: string
}

type HostType = 'owner' | 'representative'

type CurrencyPreference = 'ILS' | 'USD' | 'Both'

type FormState = {
  host_name: string
  display_name: string
  show_full_name: boolean
  email: string
  phone: string
  whatsapp_number: string
  host_type: HostType
  host_role: string
  has_permission: boolean
  apartment_title: string
  area: string
  exact_address: string
  address_latitude: number | null
  address_longitude: number | null
  bedrooms: string
  bathrooms: string
  sleeps: string
  sleeping_setup: string
  currency_preference: CurrencyPreference
  price_ils: string
  price_usd: string
  amenities: string[]
  kosher_kitchen_level: string
  shabbat_elevator: boolean
  physical_key_entry: boolean
  shabbat_clock: boolean
  sukkah_balcony: boolean
  near_synagogue: boolean
  walking_minutes_to_kotel: string
  central_ac: boolean
  american_washer_dryer: boolean
  american_mattress: boolean
  powerful_water_heater: boolean
  description: string
  photo_link: string
  photos: PhotoUpload[]
  uploaded_photo_urls: string[]
  verification_doc: DocumentUpload | null
  verification_doc_type: string
  id_doc: DocumentUpload | null
  id_doc_type: string
  confirmation: boolean
  host_terms_accepted: boolean
}

type SavedListingDraft = Omit<FormState, 'photos' | 'verification_doc' | 'id_doc'> & {
  step: number
  saved_at: string
}

type UploadProgress = {
  completed: number
  total: number
  current: string
}

type AiSuggestion = {
  title?: string
  description?: string
  highlights?: string[]
  error?: string
}

type HostListingBlockStatus = {
  listing_blocked?: unknown
  listing_blocked_reason?: unknown
}

type AddressSelection = {
  address: string
  latitude: number
  longitude: number
}

type PlacesLocation = {
  lat: () => number
  lng: () => number
}

type PlaceRecord = {
  formattedAddress?: string
  location?: PlacesLocation
  fetchFields: (options: { fields: string[] }) => Promise<void>
}

type PlacePrediction = {
  toPlace: () => PlaceRecord
  text?: { toString: () => string }
  mainText?: { toString: () => string }
}

type GoogleAddressSuggestion = {
  placePrediction?: PlacePrediction
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

type AddressSuggestion = {
  label: string
  prediction?: PlacePrediction
  placeId?: string
}

type PlacesLibrary = {
  AutocompleteSessionToken?: new () => unknown
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: Record<string, unknown>) => Promise<{ suggestions?: GoogleAddressSuggestion[] }>
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

function getMapsWindow(): MapsWindow {
  const googleValue: unknown = Reflect.get(window, 'google')
  return isGoogleMapsValue(googleValue)
    ? { google: googleValue }
    : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getHostListingBlockStatus(value: unknown) {
  if (!isRecord(value)) {
    return { blocked: false, reason: null }
  }

  const status = value as HostListingBlockStatus
  return {
    blocked: status.listing_blocked === true,
    reason:
      typeof status.listing_blocked_reason === 'string'
        ? status.listing_blocked_reason
        : null,
  }
}

function isGoogleMapsValue(value: unknown): value is GoogleMapsValue {
  if (!isRecord(value)) return false
  const maps = value.maps
  return maps === undefined || isRecord(maps)
}

// Jerusalem neighbourhoods for autocomplete suggestions
const neighbourhoods = [
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

type NeighbourhoodAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Neighbourhood autocomplete component
function NeighbourhoodAutocomplete({ value, onChange, placeholder, className }: NeighbourhoodAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value || '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return []
    const query = inputValue.toLowerCase()
    return neighbourhoods.filter((neighbourhood) => 
      neighbourhood.toLowerCase().includes(query)
    ).slice(0, 8) // Limit to 8 suggestions
  }, [inputValue])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onChange(val)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSelect = (neighbourhood: string) => {
    setInputValue(neighbourhood)
    onChange(neighbourhood)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => setIsOpen(false), 150)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue.trim() && setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />
      
      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-lg"
          role="listbox"
        >
          {suggestions.map((neighbourhood, index) => (
            <li
              key={neighbourhood}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`cursor-pointer px-4 py-3 text-sm transition ${
                index === highlightedIndex 
                  ? 'bg-[#F8F5F2] text-stone-900' 
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e: MouseEvent<HTMLLIElement>) => {
                e.preventDefault() // Prevent blur before click
                handleSelect(neighbourhood)
              }}
            >
              {neighbourhood}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

let googlePlacesPromise: Promise<PlacesLibrary> | null = null

function loadGooglePlacesLibrary(apiKey: string): Promise<PlacesLibrary> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'))
  }

  const mapsWindow = getMapsWindow()

  if (mapsWindow.google?.maps?.importLibrary) {
    return mapsWindow.google.maps.importLibrary('places')
  }

  if (!googlePlacesPromise) {
    googlePlacesPromise = new Promise<PlacesLibrary>((resolve, reject) => {
      const finishLoading = async () => {
        try {
          if (!mapsWindow.google?.maps?.importLibrary) {
            reject(new Error('Google Maps loaded without the Places library.'))
            return
          }

          const places = await mapsWindow.google.maps.importLibrary('places')
          resolve(places)
        } catch (error) {
          reject(error)
        }
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')

      if (existingScript) {
        if (mapsWindow.google?.maps?.importLibrary) {
          finishLoading()
          return
        }

        existingScript.addEventListener('load', finishLoading, { once: true })
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Google Maps script failed to load.')),
          { once: true },
        )
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.onload = finishLoading
      script.onerror = () => reject(new Error('Google Maps script failed to load.'))
      document.head.appendChild(script)
    })
  }

  return googlePlacesPromise
}

type AddressAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onSelect: (selection: AddressSelection) => void
  placeholder?: string
  className?: string
}

// Address autocomplete using Google Places API
function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }: AddressAutocompleteProps) {
  const placesLibrary = useRef<PlacesLibrary | null>(null)
  const placesServiceContainerRef = useRef<HTMLDivElement | null>(null)
  const sessionToken = useRef<unknown>(null)
  const requestIdRef = useRef(0)
  const [inputValue, setInputValue] = useState(value || '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isValidated, setIsValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '')
    }
  }, [value])

  useEffect(() => {
    let isMounted = true

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error('No Google Maps API key found')
      setLoadError('Address lookup is not configured yet. You can still type the address manually.')
      setIsLoading(false)
      return
    }
    const googleMapsApiKey = apiKey

    async function initAutocomplete() {
      try {
        const places = await loadGooglePlacesLibrary(googleMapsApiKey)

        if (!isMounted) return

        if (!places.AutocompleteSuggestion && !places.AutocompleteService) {
          setLoadError('Google address lookup is unavailable right now. Type the address manually and continue.')
          setIsLoading(false)
          return
        }

        placesLibrary.current = places
        sessionToken.current = places.AutocompleteSessionToken ? new places.AutocompleteSessionToken() : null
        setLoadError('')
        setIsLoading(false)
      } catch (err) {
        console.error('Error initializing autocomplete:', err)

        if (isMounted) {
          setLoadError('Google address lookup is unavailable right now. Type the address manually and continue.')
          setIsLoading(false)
        }
      }
    }

    initAutocomplete()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isLoading || loadError || value.trim().length < 3) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    const timer = window.setTimeout(async () => {
      const places = placesLibrary.current
      const mapsWindow = getMapsWindow()

      if (!places?.AutocompleteSuggestion && !places?.AutocompleteService) return

      const currentRequestId = ++requestIdRef.current
      setIsSearching(true)

      try {
        let nextSuggestions: AddressSuggestion[] = []

        if (places.AutocompleteSuggestion) {
          const request: Record<string, unknown> = {
            input: `${value} Jerusalem`,
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
              if (!prediction) return null

              const label = prediction.text?.toString() || prediction.mainText?.toString() || ''
              if (!label) return null

              return { label, prediction }
            })
            .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
            .slice(0, 8)
        } else if (places.AutocompleteService) {
          const service = new places.AutocompleteService()
          const predictions = await new Promise<LegacyPlacePrediction[]>((resolve) => {
            service.getPlacePredictions(
              {
                input: `${value} Jerusalem`,
                componentRestrictions: { country: 'il' },
                types: ['address'],
              },
              (results) => resolve(results || []),
            )
          })

          nextSuggestions = predictions.slice(0, 8).map((prediction) => ({
            label: prediction.description,
            placeId: prediction.place_id,
          }))
        }

        if (currentRequestId !== requestIdRef.current) return

        setSuggestions(nextSuggestions)
        setIsOpen(nextSuggestions.length > 0)
        setHighlightedIndex(-1)
      } catch (error) {
        console.error('Google address lookup error:', error instanceof Error ? error.message : error)
        if (currentRequestId === requestIdRef.current) {
          setSuggestions([])
          setIsOpen(false)
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [value, isLoading, loadError])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setInputValue(nextValue)
    setIsValidated(false)
    onChange(nextValue)
  }

  const handleSelect = async (suggestion: AddressSuggestion) => {
    try {
      let address = suggestion.label
      let latitude: number | null = null
      let longitude: number | null = null

      if (suggestion.prediction) {
        const place = suggestion.prediction.toPlace()
        await place.fetchFields({
          fields: ['formattedAddress', 'location'],
        })

        address = place.formattedAddress || suggestion.label
        latitude = place.location?.lat() ?? null
        longitude = place.location?.lng() ?? null
      } else {
        const places = placesLibrary.current
        const PlacesService = places?.PlacesService
        const serviceContainer = placesServiceContainerRef.current

        if (suggestion.placeId && PlacesService && serviceContainer) {
          const service = new PlacesService(serviceContainer)
          const place = await new Promise<LegacyPlaceResult | null>((resolve) => {
            service.getDetails(
              {
                placeId: suggestion.placeId,
                fields: ['formatted_address', 'geometry'],
              },
              (result, status) => {
                const okStatus = places?.PlacesServiceStatus?.OK || 'OK'
                resolve(status === okStatus ? result : null)
              },
            )
          })

          address = place?.formatted_address || suggestion.label
          latitude = place?.geometry?.location?.lat() ?? null
          longitude = place?.geometry?.location?.lng() ?? null
        }
      }

      setInputValue(address)
      setIsValidated(true)
      setIsOpen(false)
      setSuggestions([])
      onChange(address)

      if (latitude !== null && longitude !== null) {
        onSelect({
          address,
          latitude,
          longitude,
        })
      }
    } catch (error) {
      console.error('Google address selection error:', error instanceof Error ? error.message : error)
      setLoadError('Google address lookup is unavailable right now. Type the address manually and continue.')
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

  const handleBlur = () => {
    window.setTimeout(() => setIsOpen(false), 150)
  }

  return (
    <div className="relative">
      <div ref={placesServiceContainerRef} className="hidden" />
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true)
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-2 shadow-lg"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.label}
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

      {value && isValidated && (
        <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Address validated</span>
        </div>
      )}
      {value && !isValidated && !isLoading && !loadError && (
        <div className="mt-1 text-xs text-stone-500">
          {isSearching ? 'Searching Google Maps...' : 'Choose a suggestion or keep your manually typed address.'}
        </div>
      )}
      {isLoading && (
        <div className="mt-1 text-xs text-stone-500">
          Loading Google address suggestions. You can type manually now.
        </div>
      )}
      {loadError && (
        <div className="mt-1 text-xs text-amber-700">
          {loadError}
        </div>
      )}
    </div>
  )
}

const initialForm: FormState = {
  host_name: '',
  display_name: '',
  show_full_name: false,
  email: '',
  phone: '',
  whatsapp_number: '',
  host_type: 'owner',
  host_role: '',
  has_permission: false,

apartment_title: '',
  area: '',
  exact_address: '',
  address_latitude: null,
  address_longitude: null,

  bedrooms: '',
  bathrooms: '',
  sleeps: '',
  sleeping_setup: '',

  currency_preference: 'ILS',
  price_ils: '',
  price_usd: '',

amenities: [],
  kosher_kitchen_level: '',
  shabbat_elevator: false,
  physical_key_entry: false,
  shabbat_clock: false,
  sukkah_balcony: false,
  near_synagogue: false,
  walking_minutes_to_kotel: '',
  central_ac: false,
  american_washer_dryer: false,
  american_mattress: false,
  powerful_water_heater: false,

description: '',
  photo_link: '',
  photos: [], // Array of { file: File, preview: string }
  uploaded_photo_urls: [], // Array of uploaded URLs
  
  // Verification document (proof of right to host)
  verification_doc: null, // { file: File, preview: string }
  verification_doc_type: '',
  
  // ID document
  id_doc: null, // { file: File, preview: string }
  id_doc_type: '',
  
  confirmation: false,
  host_terms_accepted: false,
}

const idDocTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'national_id', label: 'National ID card (Teudat Zehut)' },
  { value: 'residence_permit', label: 'Residence permit' },
]

const verificationDocTypes = [
  { value: 'utility_bill', label: 'Utility bill (gas, electric, water, council tax, broadband)' },
  { value: 'mortgage_statement', label: 'Mortgage statement' },
  { value: 'property_tax', label: 'Property tax or council tax bill' },
  { value: 'lease_agreement', label: 'Lease agreement (with subletting permission)' },
  { value: 'authorisation_letter', label: 'Letter of authorisation from property owner' },
  { value: 'business_registration', label: 'Business registration documents' },
  { value: 'insurance_document', label: 'Insurance document showing property address' },
]

const steps = [
  'Contact details',
  'Stay details',
  'Location',
  'Guests & rooms',
  'Pricing',
  'Amenities',
  'Photos',
  'Verification',
  'Confirm',
]

const minimumPhotoCount = 5
const maxListingPhotoCount = 20
const maxListingPhotoSizeMb = 10
const listingDraftStorageKey = 'jlm-listing-draft-v1'
const listingPhotoTypes = ['image/jpeg', 'image/png', 'image/webp']
const isSupabaseEnvReady = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

function getImageExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function getUploadFailureMessage(fileName: string, message?: string) {
  const lowerMessage = message?.toLowerCase() || ''

  if (lowerMessage.includes('bucket') || lowerMessage.includes('not found')) {
    return 'Photo upload storage is not set up yet. Please run the listing photos storage SQL in Supabase.'
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('permission')) {
    return 'Photo upload permission is blocked in Supabase. Please run the listing photos storage SQL in Supabase.'
  }

  if (lowerMessage.includes('size') || lowerMessage.includes('too large')) {
    return `${fileName} is too large. Please use an image under ${maxListingPhotoSizeMb}MB.`
  }

  return message
    ? `Failed to upload ${fileName}: ${message}`
    : `Failed to upload ${fileName}. Please try again.`
}

const AGENCY_AGREEMENT_STORAGE_KEY = 'jlm.agencyAgreementAccepted'

export default function BecomeAHostPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [draftReady, setDraftReady] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [showMissingStepWarnings, setShowMissingStepWarnings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [hostId, setHostId] = useState<string | null>(null)
  const [checkingHost, setCheckingHost] = useState(true)
  const [accountUser, setAccountUser] = useState<User | null>(null)
  const [requiresHostTermsAcceptance, setRequiresHostTermsAcceptance] = useState(true)
  const [hostTermsAcceptedAt, setHostTermsAcceptedAt] = useState<string | null>(null)
  const [showHostTermsModal, setShowHostTermsModal] = useState(false)
  const [agencyAccepted, setAgencyAccepted] = useState(false)
  const [agencyGateReady, setAgencyGateReady] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translateError, setTranslateError] = useState('')
  const [translateResult, setTranslateResult] = useState<{
    title: string
    description: string
  } | null>(null)
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null)
  const [isPhotoDropActive, setIsPhotoDropActive] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState('')
  const [verificationDocError, setVerificationDocError] = useState('')
  const [idDocError, setIdDocError] = useState('')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const photoSwipeStartRef = useRef<{ index: number; x: number; pointerId: number } | null>(null)
  // F4: reuse the created application + resume photo uploads on retry, so a
  // failed-then-retried submit can't create duplicate applications/photos.
  const submittedApplicationIdRef = useRef<string | null>(null)
  const uploadedPhotoCountRef = useRef(0)

  const progress = useMemo(() => {
    return Math.round(((step + 1) / steps.length) * 100)
  }, [step])

  useEffect(() => {
    try {
      if (window.localStorage.getItem(AGENCY_AGREEMENT_STORAGE_KEY) === '1') {
        setAgencyAccepted(true)
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — show the gate.
    }
    setAgencyGateReady(true)
  }, [])

  const acceptAgencyAgreement = () => {
    try {
      window.localStorage.setItem(AGENCY_AGREEMENT_STORAGE_KEY, '1')
    } catch {
      // Non-fatal: acceptance just won't persist across reloads.
    }
    setAgencyAccepted(true)
  }

  // Uploaded files (photos + verification/ID docs) live only in memory — the draft
  // autosave strips them out because File objects can't be serialised to localStorage.
  // So warn before an unload would discard them, instead of a persistent inline banner.
  const hasUnsavedUploads =
    form.photos.length > 0 || form.verification_doc !== null || form.id_doc !== null

  useEffect(() => {
    if (!hasUnsavedUploads || success) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Browsers show their own generic "Leave site?" text; the return value is
      // required for the prompt to appear at all.
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedUploads, success])

  const stepIssues = useMemo(() => {
    return steps.map((_, index) => getStepIssues(index))
  }, [form, requiresHostTermsAcceptance, restoredDraft])

  const currentStepIssues = stepIssues[step] || []
  const incompleteStepNames = stepIssues
    .map((issues, index) => (issues.length > 0 ? steps[index] : null))
    .filter((item): item is string => Boolean(item))

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(listingDraftStorageKey)
      if (!savedDraft) {
        setDraftReady(true)
        return
      }

      const parsedDraft = JSON.parse(savedDraft) as Partial<SavedListingDraft>
      const { step: savedStep, saved_at: _savedAt, ...draftFields } = parsedDraft
      setRestoredDraft(true)
      setShowMissingStepWarnings(true)
      setForm((current) => ({
        ...current,
        ...draftFields,
        photos: [],
        verification_doc: null,
        id_doc: null,
      }))

      if (typeof savedStep === 'number') {
        setStep(Math.min(Math.max(savedStep, 0), steps.length - 1))
      }
    } catch (draftError) {
      console.error('Could not load listing draft:', draftError)
    } finally {
      setDraftReady(true)
    }
  }, [])

  useEffect(() => {
    if (!draftReady || success) return

    const timer = window.setTimeout(() => {
      const { photos: _photos, verification_doc: _verificationDoc, id_doc: _idDoc, ...draftFields } = form
      const draft: SavedListingDraft = {
        ...draftFields,
        step,
        saved_at: new Date().toISOString(),
      }

      window.localStorage.setItem(listingDraftStorageKey, JSON.stringify(draft))
    }, 400)

    return () => window.clearTimeout(timer)
  }, [draftReady, form, step, success])

  useEffect(() => {
    async function loadHost() {
      if (!isSupabaseEnvReady) {
        setCheckingHost(false)
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = `/login?redirect=${encodeURIComponent('/become-a-host')}`
        return
      }

      try {
        const hostProfile = await ensureHostProfile(supabase, user)
        const blockStatus = getHostListingBlockStatus(hostProfile)
        if (blockStatus.blocked) {
          setError(
            blockStatus.reason ||
              'This host account cannot submit new listings right now. Please contact JLM Collective if you think this is a mistake.',
          )
          setHostId(null)
          return
        }
        setHostId(hostProfile.id)
        setAccountUser(user)
        setRequiresHostTermsAcceptance(!hostProfile.host_terms_accepted_at)
        setHostTermsAcceptedAt(hostProfile.host_terms_accepted_at || null)
        setForm((current) => ({
          ...current,
          host_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            current.host_name,
          email: user.email || current.email,
          display_name:
            current.display_name ||
            hostProfile.display_name ||
            user.user_metadata?.full_name?.split(' ')[0] ||
            user.user_metadata?.name?.split(' ')[0] ||
            user.email?.split('@')[0] ||
            '',
          host_terms_accepted: Boolean(hostProfile.host_terms_accepted_at),
        }))
      } catch (profileError) {
        console.error('Could not load host profile:', profileError)
        setError('We could not load your host profile. Please sign in again and retry.')
      } finally {
        setCheckingHost(false)
      }
    }

    loadHost()
  }, [])

  function updateField<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current }
      next[name] = value
      return next
    })
  }

  function toggleAmenity(item: string) {
    setForm((current) => {
      const exists = current.amenities.includes(item)

      return {
        ...current,
        amenities: exists
          ? current.amenities.filter((amenity) => amenity !== item)
          : [...current.amenities, item],
      }
    })
  }

  function reorderPhotos(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return

    const nextPhotos = [...form.photos]
    const [photo] = nextPhotos.splice(fromIndex, 1)
    nextPhotos.splice(toIndex, 0, photo)
    updateField('photos', nextPhotos)
  }

  function addPhotoFiles(files: File[]) {
    setPhotoUploadError('')

    if (files.length === 0) return

    const availableSlots = maxListingPhotoCount - form.photos.length

    if (availableSlots <= 0) {
      setPhotoUploadError(`You can upload up to ${maxListingPhotoCount} photos. Remove one before adding another.`)
      return
    }

    const nextPhotos: PhotoUpload[] = []
    const messages: string[] = []
    let skippedForLimit = 0

    for (const file of files) {
      if (nextPhotos.length >= availableSlots) {
        skippedForLimit += 1
        continue
      }

      if (!listingPhotoTypes.includes(file.type)) {
        messages.push(`${file.name} is not a valid image type. Use JPG, PNG, or WebP.`)
        continue
      }

      if (file.size > maxListingPhotoSizeMb * 1024 * 1024) {
        messages.push(`${file.name} is too large. Use an image under ${maxListingPhotoSizeMb}MB.`)
        continue
      }

      nextPhotos.push({
        file,
        preview: URL.createObjectURL(file),
        label: '',
      })
    }

    if (skippedForLimit > 0) {
      messages.push(`Only ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} can be added. The rest were not added.`)
    }

    if (nextPhotos.length > 0) {
      updateField('photos', [...form.photos, ...nextPhotos])
    }

    if (messages.length > 0) {
      setPhotoUploadError(messages.join(' '))
    }
  }

  function handlePhotoInputChange(event: ChangeEvent<HTMLInputElement>) {
    addPhotoFiles(Array.from(event.target.files || []))
    event.target.value = ''
  }

  function handlePhotoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsPhotoDropActive(false)
    addPhotoFiles(Array.from(event.dataTransfer.files || []))
  }

  function handleVerificationDocChange(event: ChangeEvent<HTMLInputElement>) {
    setVerificationDocError('')
    const file = event.target.files?.[0]

    if (!file) return

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    const maxSize = 10 * 1024 * 1024

    if (!validTypes.includes(file.type)) {
      setVerificationDocError('Please upload a PDF, JPG, PNG, or WebP file.')
      event.target.value = ''
      return
    }

    if (file.size > maxSize) {
      setVerificationDocError('File is too large. Maximum size is 10MB.')
      event.target.value = ''
      return
    }

    updateField('verification_doc', {
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.name,
      type: file.type,
    })
    event.target.value = ''
  }

  function handleIdDocChange(event: ChangeEvent<HTMLInputElement>) {
    setIdDocError('')
    const file = event.target.files?.[0]

    if (!file) return

    const maxSize = 10 * 1024 * 1024

    if (!listingPhotoTypes.includes(file.type)) {
      setIdDocError('Please upload a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > maxSize) {
      setIdDocError('File is too large. Maximum size is 10MB.')
      event.target.value = ''
      return
    }

    updateField('id_doc', {
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      type: file.type,
    })
    event.target.value = ''
  }

  function dropPhoto(targetIndex: number) {
    if (draggingPhotoIndex === null) return
    reorderPhotos(draggingPhotoIndex, targetIndex)
    setDraggingPhotoIndex(null)
  }

  function dragPhotoOver(targetIndex: number) {
    if (draggingPhotoIndex === null || draggingPhotoIndex === targetIndex) return
    reorderPhotos(draggingPhotoIndex, targetIndex)
    setDraggingPhotoIndex(targetIndex)
  }

  function startPhotoSwipe(index: number, event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest('input,button,textarea,select,a')) {
      return
    }

    photoSwipeStartRef.current = {
      index,
      x: event.clientX,
      pointerId: event.pointerId,
    }
    setDraggingPhotoIndex(index)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePhotoWithPointer(event: PointerEvent<HTMLDivElement>) {
    const start = photoSwipeStartRef.current

    if (!start || start.pointerId !== event.pointerId) return

    const targetElement = document.elementFromPoint(event.clientX, event.clientY)
    const photoElement = targetElement instanceof HTMLElement
      ? targetElement.closest('[data-photo-index]')
      : null
    const photoIndexValue = photoElement?.getAttribute('data-photo-index')
    const targetIndex = photoIndexValue ? Number(photoIndexValue) : Number.NaN

    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= form.photos.length) {
      return
    }

    if (targetIndex === start.index) return

    reorderPhotos(start.index, targetIndex)
    photoSwipeStartRef.current = {
      ...start,
      index: targetIndex,
      x: event.clientX,
    }
    setDraggingPhotoIndex(targetIndex)
  }

  function finishPhotoSwipe(index: number, event: PointerEvent<HTMLDivElement>) {
    const start = photoSwipeStartRef.current
    photoSwipeStartRef.current = null
    setDraggingPhotoIndex(null)

    if (!start || start.index !== index || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x

    if (Math.abs(deltaX) < 45) return

    const direction = deltaX < 0 ? 1 : -1
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= form.photos.length) return

    reorderPhotos(index, targetIndex)
  }

  function updatePhotoLabel(index: number, label: string) {
    updateField(
      'photos',
      form.photos.map((photo, photoIndex) =>
        photoIndex === index ? { ...photo, label } : photo,
      ),
    )
  }

  async function generateListingCopy() {
    setAiLoading(true)
    setAiError('')
    setAiSuggestion(null)

    try {
      const response = await fetch('/api/listing-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apartment_title: form.apartment_title,
          area: form.area,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          sleeps: form.sleeps,
          sleeping_setup: form.sleeping_setup,
          amenities: form.amenities,
          description: form.description,
        }),
      })

      const data = (await response.json()) as AiSuggestion

      if (!response.ok) {
        throw new Error(data.error || 'Unable to improve the listing right now.')
      }

      setAiSuggestion(data)
    } catch (generationError) {
      setAiError(
        generationError instanceof Error
          ? generationError.message
          : 'Unable to improve the listing right now.',
      )
    } finally {
      setAiLoading(false)
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return

    setForm((current) => ({
      ...current,
      apartment_title: aiSuggestion.title || current.apartment_title,
      description: aiSuggestion.description || current.description,
    }))
  }

  async function translateField(text: string, kind: 'title' | 'description') {
    const trimmed = text.trim()
    if (!trimmed) return ''

    const response = await fetch('/api/translate-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: trimmed, kind }),
    })

    const data = (await response.json()) as { translated?: string; error?: string }

    if (!response.ok) {
      throw new Error(data.error || 'Unable to translate right now.')
    }

    return data.translated || ''
  }

  async function translateToEnglish() {
    const title = form.apartment_title.trim()
    const description = form.description.trim()

    if (!title && !description) {
      setTranslateError('Write the stay name or description first, then translate it to English.')
      return
    }

    setTranslateLoading(true)
    setTranslateError('')
    setTranslateResult(null)

    try {
      const [translatedTitle, translatedDescription] = await Promise.all([
        translateField(title, 'title'),
        translateField(description, 'description'),
      ])

      setTranslateResult({
        title: translatedTitle || title,
        description: translatedDescription || description,
      })
    } catch (translateErr) {
      setTranslateError(
        translateErr instanceof Error
          ? translateErr.message
          : 'Unable to translate right now.',
      )
    } finally {
      setTranslateLoading(false)
    }
  }

  function applyTranslation() {
    if (!translateResult) return

    setForm((current) => ({
      ...current,
      apartment_title: translateResult.title || current.apartment_title,
      description: translateResult.description || current.description,
    }))
    setTranslateResult(null)
  }

  function getStepIssues(stepIndex: number) {
    const issues: string[] = []

    if (stepIndex === 0) {
      if (!form.display_name.trim()) {
        issues.push('Add the public display name guests should see.')
      }
      if (!form.phone.trim() && !form.whatsapp_number.trim()) {
        issues.push('Add either a phone number or WhatsApp number.')
      }
      if (form.host_type === 'representative' && !form.has_permission) {
        issues.push('Confirm that you have permission to submit this stay.')
      }
    }

    if (stepIndex === 1) {
      if (!form.apartment_title.trim()) {
        issues.push('Add a name for the stay.')
      }
      if (!form.description.trim()) {
        issues.push('Add a description for guests.')
      }
    }

    if (stepIndex === 2) {
      if (!form.area.trim()) {
        issues.push('Add the neighbourhood.')
      }
      if (!form.exact_address.trim()) {
        issues.push('Add the exact address manually or choose it from Google suggestions.')
      }
    }

    if (stepIndex === 3) {
      if (!form.bedrooms || Number(form.bedrooms) < 0) {
        issues.push('Add the number of bedrooms.')
      }
      if (!form.bathrooms || Number(form.bathrooms) < 0) {
        issues.push('Add the number of bathrooms.')
      }
      if (!form.sleeps || Number(form.sleeps) < 1) {
        issues.push('Add how many guests the stay sleeps.')
      }
      if (!form.sleeping_setup.trim()) {
        issues.push('Add the sleeping setup so guests know exactly where everyone sleeps.')
      }
    }

    if (stepIndex === 4) {
      if (
        (!form.price_ils || Number(form.price_ils) <= 0) &&
        (!form.price_usd || Number(form.price_usd) <= 0)
      ) {
        issues.push('Add at least one nightly price.')
      }
    }

    if (stepIndex === 5 && form.amenities.length === 0) {
      issues.push('Select at least one amenity.')
    }

    if (stepIndex === 6 && form.photos.length < minimumPhotoCount) {
      issues.push(
        restoredDraft && form.photos.length === 0
          ? `Upload at least ${minimumPhotoCount} photos again. Uploaded files cannot be restored after signing out.`
          : `Upload at least ${minimumPhotoCount} photos.`,
      )
    }

    if (stepIndex === 7) {
      if (!form.verification_doc_type) {
        issues.push('Select a property verification document type.')
      }
      if (!form.verification_doc) {
        issues.push(
          restoredDraft
            ? 'Upload the property verification document again. Uploaded files cannot be restored after signing out.'
            : 'Upload the property verification document.',
        )
      }
      if (!form.id_doc_type) {
        issues.push('Select your ID document type.')
      }
      if (!form.id_doc) {
        issues.push(
          restoredDraft
            ? 'Upload your ID document again. Uploaded files cannot be restored after signing out.'
            : 'Upload your ID document.',
        )
      }
    }

    if (stepIndex === 8) {
      if (!form.confirmation) {
        issues.push('Confirm that the listing details are accurate.')
      }
      if (requiresHostTermsAcceptance && !form.host_terms_accepted) {
        issues.push('Agree to the host terms and conditions.')
      }
    }

    return issues
  }

  function goToFirstIssue() {
    const firstIssueStep = stepIssues.findIndex((issues) => issues.length > 0)
    if (firstIssueStep === -1) return false

    setShowMissingStepWarnings(true)
    setStep(firstIssueStep)
    setError(`${steps[firstIssueStep]} needs attention: ${stepIssues[firstIssueStep][0]}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  function nextStep() {
    setError('')

    const issues = getStepIssues(step)
    if (issues.length > 0) {
      setShowMissingStepWarnings(true)
      setError(issues[0])
      return
    }

    if (step < steps.length - 1) {
      setStep((current) => current + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function previousStep() {
    setError('')

    if (step > 0) {
      setStep((current) => current - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

async function handleSubmit() {
    setLoading(true)
    setError('')
    setSuccess(false)
    setUploadProgress(null)

    if (!isSupabaseEnvReady) {
      setError('The live listing database is not connected yet. Add the Supabase environment variables before accepting submissions.')
      setLoading(false)
      return
    }

    if (goToFirstIssue()) {
      setLoading(false)
      return
    }

    if (!hostId) {
      setError('Your host profile is still loading. Please wait a moment and try again.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: hostBlockStatus, error: hostBlockError } = await supabase
      .from('hosts')
      .select('listing_blocked, listing_blocked_reason')
      .eq('id', hostId)
      .maybeSingle()

    if (hostBlockError) {
      setError('We could not confirm your host listing access. Please try again.')
      setLoading(false)
      return
    }

    const blockStatus = getHostListingBlockStatus(hostBlockStatus)
    if (blockStatus.blocked) {
      setError(
        blockStatus.reason ||
          'This host account cannot submit new listings right now. Please contact JLM Collective if you think this is a mistake.',
      )
      setLoading(false)
      return
    }

    let acceptedTermsAt = hostTermsAcceptedAt

    if (requiresHostTermsAcceptance) {
      const { data: acceptedHost, error: termsError } = await supabase.rpc('accept_current_host_terms_for_host', {
        accepted_version: HOST_TERMS_VERSION,
        target_host_id: hostId,
      })

      if (termsError) {
        console.error(termsError)
        setError('We could not record your host terms acceptance. Please try again.')
        setLoading(false)
        return
      }

      acceptedTermsAt =
        acceptedHost?.host_terms_accepted_at ||
        new Date().toISOString()
      setHostTermsAcceptedAt(acceptedTermsAt)
      setRequiresHostTermsAcceptance(false)
    }

    // First, create the host application to get an ID
    const payload = {
      host_id: hostId,
      host_name: form.host_name,
      display_name: form.display_name || form.host_name.split(' ')[0],
      show_full_name: form.show_full_name,
      email: form.email,
      phone: form.phone || null,
      whatsapp_number: form.whatsapp_number || null,
      host_type: form.host_type,

      apartment_title: form.apartment_title,
      area: form.area,
      exact_address: form.exact_address || null,
      latitude: form.address_latitude || null,
      longitude: form.address_longitude || null,

      bedrooms: Number(form.bedrooms) || null,
      bathrooms: Number(form.bathrooms) || null,
      sleeps: Number(form.sleeps) || null,
      sleeping_setup: form.sleeping_setup.trim() || null,

      currency_preference: form.currency_preference,
      price_ils: Number(form.price_ils) || null,
      price_usd: Number(form.price_usd) || null,

      amenities: form.amenities,
      kosher_kitchen_level: form.kosher_kitchen_level || null,
      shabbat_elevator: form.shabbat_elevator,
      physical_key_entry: form.physical_key_entry,
      shabbat_clock: form.shabbat_clock,
      sukkah_balcony: form.sukkah_balcony,
      near_synagogue: form.near_synagogue,
      walking_minutes_to_kotel: Number(form.walking_minutes_to_kotel) || null,
      central_ac: form.central_ac,
      american_washer_dryer: form.american_washer_dryer,
      american_mattress: form.american_mattress,
      powerful_water_heater: form.powerful_water_heater,
      american_comfort:
        form.central_ac &&
        form.american_washer_dryer &&
        form.american_mattress &&
        form.powerful_water_heater,

      description: form.description || null,
      photo_link: form.photo_link || null,
      
      verification_doc_type: form.verification_doc_type,
      verification_status: 'pending',
      
      id_doc_type: form.id_doc_type,
      id_verified: false,

      host_terms_accepted_at: acceptedTermsAt,
      host_terms_version: HOST_TERMS_VERSION,
      status: 'new',
    }

    let applicationId = submittedApplicationIdRef.current
    if (!applicationId) {
      const { data: applicationData, error: applicationError } = await supabase
        .from('host_applications')
        .insert([payload])
        .select('id')
        .single()

      if (applicationError) {
        console.error(applicationError)
        setError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      applicationId = applicationData.id
      submittedApplicationIdRef.current = applicationId
    }

    // Upload verification document to Supabase Storage
    if (form.verification_doc) {
      const fileExt = form.verification_doc.name.split('.').pop()?.toLowerCase() || 'file'
      const fileName = `verification-${Date.now()}.${fileExt}`
      const storagePath = `applications/${applicationId}/${fileName}`

      const { error: verifyUploadError } = await supabase.storage
        .from('verification-docs')
        .upload(storagePath, form.verification_doc.file)

      if (verifyUploadError) {
        console.error('Verification upload error:', verifyUploadError)
        toast.warning('Your verification document didn’t upload. You can add it later from your host dashboard.')
      } else {
        // Hosts have no UPDATE policy on host_applications, so a direct update
        // matched zero rows without erroring — the file reached storage but the
        // application row kept showing no document. This RPC writes just the
        // one column after checking ownership.
        const { error: pathError } = await supabase.rpc('set_host_application_document_path', {
          application_uuid: applicationId,
          document_kind: 'verification_doc',
          document_path: storagePath,
        })

        if (pathError) {
          console.error('Verification doc path error:', pathError)
          toast.warning('Your verification document uploaded but we could not attach it. Please contact us.')
        }
      }
    }

    // Upload ID document to Supabase Storage
    if (form.id_doc) {
      const fileExt = form.id_doc.name.split('.').pop()?.toLowerCase() || 'file'
      const fileName = `id-${Date.now()}.${fileExt}`
      const storagePath = `applications/${applicationId}/${fileName}`

      const { error: idUploadError } = await supabase.storage
        .from('verification-docs')
        .upload(storagePath, form.id_doc.file)

      if (idUploadError) {
        console.error('ID upload error:', idUploadError)
        toast.warning('Your ID document didn’t upload. You can add it later from your host dashboard.')
      } else {
        const { error: pathError } = await supabase.rpc('set_host_application_document_path', {
          application_uuid: applicationId,
          document_kind: 'id_doc',
          document_path: storagePath,
        })

        if (pathError) {
          console.error('ID doc path error:', pathError)
          toast.warning('Your ID uploaded but we could not attach it. Please contact us.')
        }
      }
    }

    // Upload photos to Supabase Storage with proper folder structure
    if (form.photos.length > 0) {
      setUploadProgress({
        completed: 0,
        total: form.photos.length,
        current: `Uploading photo 1 of ${form.photos.length}`,
      })

      for (let i = uploadedPhotoCountRef.current; i < form.photos.length; i++) {
        const photo = form.photos[i]
        const fileExt = getImageExtension(photo.file)
        const fileName = `photo-${i + 1}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
        const storagePath = `listings/${applicationId}/${fileName}`

        setUploadProgress({
          completed: i,
          total: form.photos.length,
          current: `Uploading ${photo.label.trim() || photo.file.name} (${i + 1} of ${form.photos.length})`,
        })

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(storagePath, photo.file, {
            cacheControl: '3600',
            contentType: photo.file.type || 'image/jpeg',
            upsert: false,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          setError(getUploadFailureMessage(photo.file.name, uploadError.message))
          setUploadProgress(null)
          setLoading(false)
          return
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(storagePath)

        // Insert photo record into listing_photos table
        const { error: photoRecordError } = await supabase
          .from('listing_photos')
          .insert({
            application_id: applicationId,
            photo_url: urlData.publicUrl,
            storage_path: storagePath,
            sort_order: i,
            is_cover: i === 0, // First photo is cover
            label: photo.label.trim() || null,
          })

        if (photoRecordError) {
          console.error('Photo record error:', photoRecordError)
        }

        uploadedPhotoCountRef.current = i + 1

        setUploadProgress({
          completed: i + 1,
          total: form.photos.length,
          current:
            i + 1 === form.photos.length
              ? 'Finishing photo uploads'
              : `Uploading photo ${i + 2} of ${form.photos.length}`,
        })
      }
    }

    // Clean up preview URLs
    form.photos.forEach(photo => URL.revokeObjectURL(photo.preview))

    submittedApplicationIdRef.current = null
    uploadedPhotoCountRef.current = 0
    setSuccess(true)
    setLoading(false)
    setUploadProgress(null)
    window.localStorage.removeItem(listingDraftStorageKey)
    setForm(initialForm)
    setStep(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#252525]">
      {agencyGateReady && !agencyAccepted && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 px-4 py-6">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-stone-100 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                Before you start
              </p>
              <h2 className="mt-1 text-2xl font-bold text-stone-950">Agency agreement</h2>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <p className="text-sm leading-6 text-stone-700">
                By listing with JLM Collective you appoint us as your agent to market, advertise, and
                let your Jerusalem property on your behalf. Our agency fee is deducted from booking
                proceeds. You remain the property owner and are party to any booking agreement with
                guests.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-stone-100 px-6 py-5 sm:flex-row sm:justify-end">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-400"
              >
                Not now
              </Link>
              <button
                type="button"
                onClick={acceptAgencyAgreement}
                className="inline-flex items-center justify-center rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Agree &amp; continue
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        <div className="mb-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <img
              src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
              alt="JLM Collective"
              className="h-14 w-auto"
            />

            <h1 className="font-display mt-8 max-w-2xl text-4xl font-bold tracking-tight text-stone-950 md:text-6xl">
              Create your listing
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
              Add your stay in a few simple steps.
            </p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-stone-200">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{steps[step]}</span>
              <span className="text-stone-500">
                Step {step + 1} of {steps.length}
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[#c76f55] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {success && (
          <div className="mx-auto max-w-2xl rounded-[2rem] bg-white p-8 text-center shadow-xl ring-1 ring-stone-200 md:p-12">
            <img
              src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
              alt="JLM Collective"
              className="mx-auto h-14 w-auto"
            />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#c76f55]">
              Listing submitted
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
              Thank you for your listing
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-stone-600">
              We have received your stay and JLM Collective will review it carefully. You can follow the status from your host dashboard.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/host/dashboard"
                className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
              >
                Open host dashboard
              </Link>
              <Link
                href="/"
                className="rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-400"
              >
                Go to homepage
              </Link>
            </div>
          </div>
        )}

        {!success && restoredDraft && (
          <div
            role="status"
            className="mb-6 rounded-3xl border border-amber-300 bg-amber-100 p-5 text-sm text-amber-900"
          >
            <p className="font-bold">We restored your saved draft</p>
            <p className="mt-1">
              Your typed details are back — but for your security, uploaded{' '}
              <strong>photos and documents are never saved in a draft</strong>. Please re-add your
              photos and your ID/verification documents before submitting.
            </p>
          </div>
        )}

        {!success && showMissingStepWarnings && incompleteStepNames.length > 0 && (
          <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-bold">Some sections still need information</p>
            <p className="mt-1 text-amber-700">
              Complete the highlighted sections before submitting your stay.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {incompleteStepNames.map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {!success && (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-stone-200">
              {steps.map((item, index) => {
                const hasIssue = showMissingStepWarnings && stepIssues[index]?.length > 0

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      index === step
                        ? 'bg-[#c76f55] text-white'
                        : index < step
                          ? 'text-stone-900 hover:bg-stone-50'
                          : 'text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                        index === step
                          ? 'bg-white text-[#c76f55]'
                          : hasIssue
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-[#F8F5F2] text-stone-500'
                      }`}
                    >
                      {hasIssue ? '!' : index + 1}
                    </span>
                    <span className="flex-1">
                      {item}
                      {hasIssue && (
                        <span className={`mt-0.5 block text-[11px] ${index === step ? 'text-white/80' : 'text-amber-700'}`}>
                          Needs info
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-stone-200 md:p-10">
            {error && (
              <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {uploadProgress && (
              <div className="mb-6 rounded-2xl border border-stone-200 bg-[#F8F5F2] p-4 text-sm text-stone-700">
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <span>{uploadProgress.current}</span>
                  <span>
                    {uploadProgress.completed}/{uploadProgress.total}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#c76f55] transition-all duration-300"
                    style={{
                      width: `${uploadProgress.total > 0 ? Math.round((uploadProgress.completed / uploadProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {showMissingStepWarnings && currentStepIssues.length > 0 && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-bold">{steps[step]} still needs attention</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {currentStepIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {step === 0 && (
              <StepShell
                eyebrow="Contact details"
                title="Set your public host details"
                description="Your account already provides your private name and email. Add the public name guests should see and the best number for listing communication."
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Public display name" required>
                    <input
                      value={form.display_name}
                      onChange={(e) => updateField('display_name', e.target.value)}
                      type="text"
                      placeholder="First name or company name"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-stone-500">This is what guests will see (e.g. "David" or "Jerusalem Stays Ltd")</p>
                  </Field>

                  <Field label="Phone">
                    <input
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      type="tel"
                      placeholder="+972..."
                      className={inputClass}
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <input
                      value={form.whatsapp_number}
                      onChange={(e) =>
                        updateField('whatsapp_number', e.target.value)
                      }
                      type="tel"
                      placeholder="+972..."
                      className={inputClass}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <p className="text-xs text-stone-500">* At least one contact number (Phone or WhatsApp) is required</p>
                  </div>

                  <div className="md:col-span-2 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
                    <p>
                      Signed in as <span className="font-semibold text-stone-900">{accountUser?.email || form.email}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold text-stone-800">
                    Your connection to this stay
                  </p>
                  <p className="mb-4 text-sm text-stone-600">
                    How are you connected to this stay?
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <ChoiceCard
                      active={form.host_type === 'owner'}
                      title="I own this stay"
                      onClick={() => {
                        updateField('host_type', 'owner')
                        updateField('host_role', '')
                        updateField('has_permission', false)
                      }}
                    />

                    <ChoiceCard
                      active={form.host_type === 'representative'}
                      title="I manage or represent this stay"
                      onClick={() => updateField('host_type', 'representative')}
                    />
                  </div>

                  {form.host_type === 'representative' && (
                    <div className="mt-5">
                      <Field label="Your role">
                        <input
                          value={form.host_role}
                          onChange={(e) => updateField('host_role', e.target.value)}
                          type="text"
                          placeholder="Managing agent, representative, assistant, family member, etc."
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  )}

                  {form.host_type === 'representative' && (
                    <label className="mt-6 flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.has_permission}
                        onChange={(e) => updateField('has_permission', e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-stone-300 text-[#c76f55] focus:ring-[#c76f55]"
                      />
                      <span className="text-sm text-stone-700">
                        I confirm I have permission to submit this stay.
                      </span>
                    </label>
                  )}
                </div>
              </StepShell>
            )}

              {step === 1 && (
                <StepShell
                  eyebrow="Stay details"
                  title="Start with the basics"
                  description="Add a clear name and description for the stay."
                >
                  <div className="mb-6 rounded-3xl border border-stone-200 bg-[#fcfaf8] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-stone-950">AI listing assistant</p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">
                          Add the facts first, then generate polished wording you can review and edit before submitting.
                        </p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">
                          Writing in Hebrew? Fill in the name and description below in Hebrew, then translate them to polished English for guests.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={generateListingCopy}
                          disabled={aiLoading}
                          className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiLoading ? 'Improving...' : 'Improve with AI'}
                        </button>
                        <button
                          type="button"
                          onClick={translateToEnglish}
                          disabled={translateLoading}
                          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {translateLoading ? 'Translating...' : 'Translate Hebrew → English'}
                        </button>
                      </div>
                    </div>

                    {aiError && (
                      <p className="mt-4 text-sm text-red-600">{aiError}</p>
                    )}

                    {aiSuggestion && (
                      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                          Suggested copy
                        </p>
                        <h3 className="mt-3 text-lg font-bold text-stone-950">
                          {aiSuggestion.title}
                        </h3>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700">
                          {aiSuggestion.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {aiSuggestion.highlights?.map((highlight) => (
                            <span
                              key={highlight}
                              className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={applyAiSuggestion}
                          className="mt-5 rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
                        >
                          Use this wording
                        </button>
                      </div>
                    )}

                    {translateError && (
                      <p className="mt-4 text-sm text-red-600">{translateError}</p>
                    )}

                    {translateResult && (
                      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                          English translation
                        </p>
                        <h3 className="mt-3 text-lg font-bold text-stone-950" dir="auto">
                          {translateResult.title}
                        </h3>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700" dir="auto">
                          {translateResult.description}
                        </p>
                        <button
                          type="button"
                          onClick={applyTranslation}
                          className="mt-5 rounded-full border border-stone-300 px-4 py-2 text-sm font-bold text-stone-800 transition hover:border-stone-500"
                        >
                          Use this English
                        </button>
                      </div>
                    )}
                  </div>

                  <Field label="Give your stay a name" required>
                  <input
                    value={form.apartment_title}
                    onChange={(e) =>
                      updateField('apartment_title', e.target.value)
                    }
                    type="text"
                    dir="auto"
                    placeholder="Example: Rechavia family apartment"
                    className={inputClass}
                  />
                </Field>

                <Field label="Tell guests what makes this stay useful">
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={6}
                    dir="auto"
                    placeholder="Example: Bright 3-bedroom apartment, close to shuls, suitable for families, elevator building..."
                    className={inputClass}
                  />
                </Field>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                eyebrow="Location"
                title="Where is it located?"
                description="The exact address is saved privately and is not shown publicly before booking."
              >
<div className="grid gap-5 md:grid-cols-2">
                  <Field label="Neighbourhood" required>
                    <NeighbourhoodAutocomplete
                      value={form.area}
                      onChange={(val) => updateField('area', val)}
                      placeholder="Start typing a neighbourhood..."
                      className={inputClass}
                    />
                  </Field>

<Field label="Exact address" required>
                    <GoogleAddressField
                      value={form.exact_address}
                      onAddressChange={(val) => {
                        updateField('exact_address', val)
                        updateField('address_latitude', null)
                        updateField('address_longitude', null)
                      }}
                      onCoordinatesChange={(latitude, longitude) => {
                        updateField('address_latitude', latitude)
                        updateField('address_longitude', longitude)
                      }}
                      placeholder="Start typing an address in Jerusalem..."
                      className={inputClass}
                      required
                    />
                  </Field>
                </div>

                <div className="mt-6 rounded-3xl bg-[#F8F5F2] p-5 text-sm leading-6 text-stone-600">
                  <p className="mb-2">Location details help place the stay correctly on the map.</p>
                  <p>You can choose an address from Google Maps or type it manually. Public listings show an approximate area rather than the full address.</p>
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                eyebrow="Guests & rooms"
                title="How many people can it comfortably host?"
                description="Accurate capacity helps guests find suitable stays and avoids unnecessary enquiries."
              >
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Bedrooms">
                    <input
                      value={form.bedrooms}
                      onChange={(e) => updateField('bedrooms', e.target.value)}
                      type="number"
                      min="0"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Bathrooms">
                    <input
                      value={form.bathrooms}
                      onChange={(e) => updateField('bathrooms', e.target.value)}
                      type="number"
                      min="0"
                      step="0.5"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sleeps">
                    <input
                      value={form.sleeps}
                      onChange={(e) => updateField('sleeps', e.target.value)}
                      type="number"
                      min="1"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="mt-5">
                  <Field label="Sleeping setup">
                    <textarea
                      value={form.sleeping_setup}
                      onChange={(e) => updateField('sleeping_setup', e.target.value)}
                      rows={5}
                      placeholder={`Example:\nBedroom 1: king bed\nBedroom 2: two single beds\nLiving room: sofa bed`}
                      className={`${inputClass} resize-y`}
                    />
                  </Field>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    Help guests understand exactly where everyone will sleep.
                  </p>
                </div>
              </StepShell>
            )}

            {step === 4 && (
<StepShell
                eyebrow="Pricing"
                title="Set your nightly rate"
                description="Enter your price per night in ILS, USD, or both."
              >
                <Field label="Preferred currency">
                  <select
                    value={form.currency_preference}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'ILS' || value === 'USD' || value === 'Both') {
                        updateField('currency_preference', value)
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                    <option value="Both">Both</option>
                  </select>
                </Field>

<div className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field label="Price per night (ILS)">
                    <input
                      value={form.price_ils}
                      onChange={(e) => updateField('price_ils', e.target.value)}
                      type="number"
                      placeholder="Example: 650"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Price per night (USD)">
                    <input
                      value={form.price_usd}
                      onChange={(e) => updateField('price_usd', e.target.value)}
                      type="number"
                      placeholder="Example: 180"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </StepShell>
            )}

            {step === 5 && (
              <StepShell
                eyebrow="Amenities"
                title="What does the stay include?"
                description="Select the features guests commonly look for when choosing a short-term stay."
              >
                <AmenitySelector selectedAmenities={form.amenities} onToggle={toggleAmenity} />
                <div className="mt-8 border-t border-stone-100 pt-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-stone-500">
                    Jewish lifestyle features
                  </h3>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <Field label="Kosher kitchen level">
                      <select
                        value={form.kosher_kitchen_level}
                        onChange={(e) => updateField('kosher_kitchen_level', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select level</option>
                        <option value="not_kosher">Not kosher</option>
                        <option value="kosher_friendly">Kosher-friendly</option>
                        <option value="kosher">Kosher</option>
                        <option value="glatt_kosher">Glatt kosher</option>
                        <option value="chalav_yisrael">Chalav Yisrael / Mehadrin</option>
                      </select>
                    </Field>
                    <Field label="Approximate walking time to the Kotel (minutes)">
                      <input
                        type="number"
                        min="0"
                        value={form.walking_minutes_to_kotel}
                        onChange={(e) => updateField('walking_minutes_to_kotel', e.target.value)}
                        className={inputClass}
                        placeholder="Optional"
                      />
                    </Field>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <LifestyleCheckbox
                      checked={form.shabbat_elevator}
                      label="Building has a Shabbat elevator"
                      onChange={(checked) => updateField('shabbat_elevator', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.physical_key_entry}
                      label="Property uses a physical key (no digital keypad or smartlock)"
                      onChange={(checked) => updateField('physical_key_entry', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.shabbat_clock}
                      label="Apartment has a Shabbat clock or timer for lights"
                      onChange={(checked) => updateField('shabbat_clock', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.sukkah_balcony}
                      label="Has a balcony suitable for a sukkah"
                      onChange={(checked) => updateField('sukkah_balcony', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.near_synagogue}
                      label="Within 5 minutes walk of a synagogue"
                      onChange={(checked) => updateField('near_synagogue', checked)}
                    />
                  </div>
                </div>
                <div className="mt-8 border-t border-stone-100 pt-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-stone-500">
                    American comfort
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    North American guests often specifically look for these features. Check all that apply.
                  </p>
                  <div className="mt-3 space-y-2">
                    <LifestyleCheckbox
                      checked={form.central_ac}
                      label="Central air conditioning (not wall units)"
                      onChange={(checked) => updateField('central_ac', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.american_washer_dryer}
                      label="Full-size American washer and dryer (not a combo unit)"
                      onChange={(checked) => updateField('american_washer_dryer', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.american_mattress}
                      label="American-style mattresses (thick, quality spring or memory foam)"
                      onChange={(checked) => updateField('american_mattress', checked)}
                    />
                    <LifestyleCheckbox
                      checked={form.powerful_water_heater}
                      label="Large boiler / powerful water heater (not a small dud shemesh only)"
                      onChange={(checked) => updateField('powerful_water_heater', checked)}
                    />
                  </div>
                </div>
              </StepShell>
            )}

{step === 6 && (
              <StepShell
                eyebrow="Photos"
                title="Add photos of your stay"
                description={`Upload at least ${minimumPhotoCount} clear photos to showcase your property. You'll be able to manage availability and block out dates from your Host Portal after approval.`}
              >
                <Field label={`Upload photos (minimum ${minimumPhotoCount}, maximum ${maxListingPhotoCount}, JPG, PNG, WebP - max ${maxListingPhotoSizeMb}MB each)`}>
                  <div className="space-y-4">
                    <div
                      onDragEnter={(event) => {
                        event.preventDefault()
                        setIsPhotoDropActive(true)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setIsPhotoDropActive(true)
                      }}
                      onDragLeave={(event) => {
                        if (event.currentTarget === event.target) {
                          setIsPhotoDropActive(false)
                        }
                      }}
                      onDrop={handlePhotoDrop}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                        isPhotoDropActive
                          ? 'border-[#c76f55] bg-[#fff4ef]'
                          : 'border-stone-300 bg-[#F8F5F2] hover:border-[#c76f55] hover:bg-[#F5F0EB]'
                      } ${form.photos.length >= maxListingPhotoCount ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <svg className="mb-3 h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-stone-700">
                        {isPhotoDropActive ? 'Drop photos here' : 'Drag photos here or click to upload'}
                      </span>
                      <span className="mt-1 text-xs text-stone-500">
                        {maxListingPhotoCount - form.photos.length} slot{maxListingPhotoCount - form.photos.length !== 1 ? 's' : ''} remaining. The first photo is the cover.
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={form.photos.length >= maxListingPhotoCount}
                        onChange={handlePhotoInputChange}
                        className="hidden"
                      />
                    </div>

                    {photoUploadError && (
                      <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                        {photoUploadError}
                      </div>
                    )}

                    {form.photos.length > 0 && (
                      <div>
                        <p className="mb-3 text-xs font-semibold text-stone-500">
                          Drag photos to reorder them. On touch screens, press and drag. Move a photo into the first position to make it the cover.
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                          {form.photos.map((photo, index) => (
                            <div
                              key={`${photo.preview}-${index}`}
                              data-photo-index={index}
                              draggable
                              onDragStart={() => setDraggingPhotoIndex(index)}
                              onDragOver={(event) => event.preventDefault()}
                              onDragEnter={() => dragPhotoOver(index)}
                              onDrop={() => dropPhoto(index)}
                              onDragEnd={() => setDraggingPhotoIndex(null)}
                              onPointerDown={(event) => startPhotoSwipe(index, event)}
                              onPointerMove={movePhotoWithPointer}
                              onPointerUp={(event) => finishPhotoSwipe(index, event)}
                              onPointerCancel={() => {
                                photoSwipeStartRef.current = null
                                setDraggingPhotoIndex(null)
                              }}
                              className={`touch-pan-y cursor-grab overflow-hidden rounded-xl bg-stone-100 active:cursor-grabbing ${draggingPhotoIndex === index ? 'opacity-60' : ''}`}
                            >
                            <div className="group relative aspect-square">
                              <img
                                src={photo.preview}
                                alt={photo.label || `Upload ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                              {index === 0 && (
                                <span className="absolute left-2 top-2 rounded-full bg-[#c76f55] px-2 py-0.5 text-xs font-bold text-white">
                                  Cover
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(photo.preview)
                                  setPhotoUploadError('')
                                  updateField('photos', form.photos.filter((_, i) => i !== index))
                                }}
                                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-stone-600 opacity-0 shadow-sm transition hover:bg-white hover:text-red-600 group-hover:opacity-100"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="space-y-2 bg-white p-3">
                              <input
                                value={photo.label}
                                onChange={(event) => updatePhotoLabel(index, event.target.value)}
                                placeholder="Photo label, e.g. Bedroom 1"
                                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
                              />
                            </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-stone-500">
                    {form.photos.length} photo{form.photos.length !== 1 ? 's' : ''} selected
                    {form.photos.length < minimumPhotoCount && (
                      <span className="ml-2 text-amber-700">
                        {minimumPhotoCount - form.photos.length} more required
                      </span>
                    )}
                    </p>
                  </div>
                </Field>

                <Field label="Or add a link to your photos (optional)">
                  <input
                    value={form.photo_link}
                    onChange={(e) => updateField('photo_link', e.target.value)}
                    type="url"
                    placeholder="Google Drive, Dropbox, website link, etc."
                    className={inputClass}
                  />
                </Field>
              </StepShell>
            )}

{step === 7 && (
              <StepShell
                eyebrow="Verification"
                title="Verify your right to host"
                description="Upload a document proving you have the right to rent out this property. This is required before your listing can go live."
              >
                <div className="mb-6 rounded-2xl bg-[#F8F5F2] p-5">
                  <p className="mb-3 text-sm font-medium text-stone-700">Accepted documents include:</p>
                  <ul className="space-y-1.5 text-sm text-stone-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Utility bill (gas, electric, water, council tax, broadband)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Mortgage statement showing property ownership</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Property tax or council tax bill</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Lease agreement with subletting permission</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Letter of authorisation from property owner</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 text-[#c76f55]">•</span>
                      <span>Business registration or insurance documents</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-stone-500">
                    Documents must show your name, the property address, and be dated within the last 12 months.
                  </p>
                </div>

                <Field label="Document type" required>
                  <select
                    value={form.verification_doc_type}
                    onChange={(e) => updateField('verification_doc_type', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select document type...</option>
                    {verificationDocTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Upload document (PDF, JPG, PNG - max 10MB)" required>
                  <div className="space-y-4">
                    {!form.verification_doc ? (
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-[#F8F5F2] p-8 transition hover:border-[#c76f55] hover:bg-[#F5F0EB]">
                        <svg className="mb-3 h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-stone-600">Click to upload document</span>
                        <span className="mt-1 text-xs text-stone-500">PDF, JPG, or PNG up to 10MB</span>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={handleVerificationDocChange}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                        {form.verification_doc.preview ? (
                          <img 
                            src={form.verification_doc.preview} 
                            alt="Document preview" 
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-100">
                            <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-stone-900">{form.verification_doc.name}</p>
                          <p className="text-xs text-stone-500">
                            {form.verification_doc.type === 'application/pdf' ? 'PDF Document' : 'Image'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const verificationDoc = form.verification_doc
                            if (verificationDoc?.preview) {
                              URL.revokeObjectURL(verificationDoc.preview)
                            }
                            setVerificationDocError('')
                            updateField('verification_doc', null)
                          }}
                          className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-red-600"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {verificationDocError && (
                      <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                        {verificationDocError}
                      </div>
                    )}
                  </div>
                </Field>

                {/* ID Document Section */}
                <div className="mt-8 border-t border-stone-200 pt-8">
                  <h3 className="mb-2 text-lg font-bold text-stone-900">Identity Verification</h3>
                  <p className="mb-4 text-sm text-stone-600">
                    Please upload a valid government-issued ID to verify your identity.
                  </p>

                  <Field label="ID type" required>
                    <select
                      value={form.id_doc_type}
                      onChange={(e) => updateField('id_doc_type', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select ID type...</option>
                      {idDocTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Upload ID (JPG, PNG - max 10MB)" required>
                    <div className="space-y-4">
                      {!form.id_doc ? (
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-[#F8F5F2] p-8 transition hover:border-[#c76f55] hover:bg-[#F5F0EB]">
                          <svg className="mb-3 h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                          </svg>
                          <span className="text-sm font-medium text-stone-600">Click to upload ID</span>
                          <span className="mt-1 text-xs text-stone-500">JPG or PNG up to 10MB</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleIdDocChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                          {form.id_doc.preview ? (
                            <img
                              src={form.id_doc.preview}
                              alt="ID preview"
                              className="h-16 w-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-100">
                              <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-stone-900">{form.id_doc.name}</p>
                            <p className="text-xs text-stone-500">ID Document</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const idDoc = form.id_doc
                              if (idDoc?.preview) {
                                URL.revokeObjectURL(idDoc.preview)
                              }
                              setIdDocError('')
                              updateField('id_doc', null)
                            }}
                            className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-red-600"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {idDocError && (
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                          {idDocError}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-medium">Your documents will be reviewed privately</p>
                  <p className="mt-1 text-amber-700">These documents are only visible to our verification team and will not be shared publicly or with guests.</p>
                </div>
              </StepShell>
            )}

            {step === 8 && (
              <StepShell
                eyebrow="Confirm"
                title="Confirm your listing details"
                description="Check the details below before submitting your listing."
              >
                <div className="grid gap-4">
                  <ReviewItem
                    label="Contact"
                    value={`${form.host_name || '—'} · ${form.email || '—'}`}
                  />

                  <ReviewItem
                    label="Listing"
                    value={form.apartment_title || '—'}
                  />

                  <ReviewItem label="Area" value={form.area || '—'} />

                  <ReviewItem
                    label="Address"
                    value={form.exact_address || 'Not provided'}
                  />

                  <ReviewItem
                    label="Rooms"
                    value={`${form.bedrooms || '—'} bedrooms · ${
                      form.bathrooms || '—'
                    } bathrooms · sleeps ${form.sleeps || '—'}`}
                  />

                  <ReviewItem
                    label="Sleeping setup"
                    value={form.sleeping_setup || 'Not provided'}
                  />

                  <ReviewItem
                    label="Pricing"
                    value={`₪${form.price_ils || '—'} / $${
                      form.price_usd || '—'
                    } · ${form.currency_preference}`}
                  />

                  <ReviewItem
                    label="Amenities"
                    value={
                      form.amenities.length
                        ? form.amenities.join(', ')
                        : 'None selected'
                    }
                  />

<ReviewItem
                    label="Photos"
                    value={
                      form.photos.length > 0
                        ? `${form.photos.length} photo${form.photos.length !== 1 ? 's' : ''} uploaded`
                        : form.photo_link || 'Not provided'
                    }
                  />

                  <ReviewItem
                    label="Property Verification"
                    value={
                      form.verification_doc
                        ? `${verificationDocTypes.find(t => t.value === form.verification_doc_type)?.label || form.verification_doc_type} - ${form.verification_doc.name}`
                        : 'Not provided'
                    }
                  />

                  <ReviewItem
                    label="ID Verification"
                    value={
                      form.id_doc
                        ? `${idDocTypes.find(t => t.value === form.id_doc_type)?.label || form.id_doc_type} - ${form.id_doc.name}`
                        : 'Not provided'
                    }
                  />
                </div>

                <label className="mt-6 flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-600">
                  <input
                    checked={form.confirmation}
                    onChange={(e) =>
                      updateField('confirmation', e.target.checked)
                    }
                    type="checkbox"
                    className="mt-1"
                  />

                  <span>
                    I confirm that the listing details are accurate.
                  </span>
                </label>

                {requiresHostTermsAcceptance && (
                  <label className="mt-4 flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                    <input
                      checked={form.host_terms_accepted}
                      onChange={(e) =>
                        updateField('host_terms_accepted', e.target.checked)
                      }
                      type="checkbox"
                      className="mt-1"
                    />

                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowHostTermsModal(true)}
                        className="font-semibold text-[#c76f55] hover:underline"
                      >
                        Host Terms and Conditions
                      </button>{' '}
                      and confirm that I am authorised to list this stay.
                    </span>
                  </label>
                )}
              </StepShell>
            )}

            <div className="mt-10 flex flex-col gap-3 border-t border-stone-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={previousStep}
                disabled={step === 0 || loading}
                className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-full bg-[#252525] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || checkingHost}
                  className="rounded-full bg-[#252525] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingHost
                    ? 'Loading...'
                    : uploadProgress
                      ? `Uploading photos ${uploadProgress.completed}/${uploadProgress.total}`
                      : loading
                        ? 'Submitting...'
                        : 'Submit listing'}
                </button>
              )}
            </div>
          </section>
          {showHostTermsModal && (
            <HostTermsModal onClose={() => setShowHostTermsModal(false)} />
          )}
        </div>
        )}
      </section>
    </div>
  )
}

function HostTermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
              Host agreement
            </p>
            <h2 className="mt-1 text-2xl font-bold text-stone-950">
              Host Terms and Conditions
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Version {HOST_TERMS_VERSION}. Last updated {HOST_TERMS_LAST_UPDATED}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:border-stone-400"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <p className="text-sm leading-6 text-stone-700">
            These host terms explain the standards expected when submitting and managing a stay on
            JLM Collective. They are intended to protect guests, hosts, and the quality of the
            letting agency service.
          </p>

          <div className="mt-6 space-y-6">
            {HOST_TERMS.map((term) => (
              <section key={term.title}>
                <h3 className="text-base font-bold text-stone-950">{term.title}</h3>
                <div className="mt-2 space-y-3">
                  {term.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-6 text-stone-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-stone-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
          >
            I have read these terms
          </button>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  'mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55] focus:ring-2 focus:ring-[#c76f55]/30'

function StepShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#c76f55]">
        {eyebrow}
      </p>

      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
        {title}
      </h2>

      <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
        {description}
      </p>

      <div className="mt-8">{children}</div>
    </div>
  )
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-800">
        {label} {required && <span className="text-[#c76f55]">*</span>}
      </span>
      {children}
    </label>
  )
}

function LifestyleCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 rounded border-stone-300"
      />
      <span className="text-sm text-stone-700">{label}</span>
    </label>
  )
}

function ChoiceCard({
  active,
  title,
  onClick,
}: {
  active: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-5 py-5 text-left text-sm font-bold transition ${
        active
          ? 'border-[#c76f55] bg-[#fff4ef] text-[#9e4f39]'
          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
      }`}
    >
      {title}
    </button>
  )
}

function ReviewItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#F8F5F2] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  )
}
