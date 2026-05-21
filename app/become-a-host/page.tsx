'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { ensureHostProfile } from '@/lib/host-profile'
import { STAY_AMENITIES } from '@/lib/stay-amenities'

type PhotoUpload = {
  file: File
  preview: string
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
  currency_preference: CurrencyPreference
  price_ils: string
  price_usd: string
  amenities: string[]
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

type AiSuggestion = {
  title?: string
  description?: string
  highlights?: string[]
  error?: string
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
}

type PlaceAutocompleteSelectEvent = Event & {
  placePrediction?: PlacePrediction
  detail?: {
    placePrediction?: PlacePrediction
  }
}

type PlaceAutocompleteWidget = HTMLElement & {
  placeholder: string
  value: string
  className: string
}

type PlacesLibrary = {
  PlaceAutocompleteElement: new (options: {
    includedPrimaryTypes: string[]
    includedRegionCodes: string[]
    locationRestriction: {
      west: number
      south: number
      east: number
      north: number
    }
    requestedLanguage: string
    requestedRegion: string
  }) => PlaceAutocompleteWidget
}

type MapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (library: 'places') => Promise<PlacesLibrary>
    }
  }
}

function getMapsWindow(): MapsWindow {
  return window as MapsWindow
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

const amenitiesList = STAY_AMENITIES

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
  const widgetContainerRef = useRef<HTMLDivElement | null>(null)
  const widgetRef = useRef<PlaceAutocompleteWidget | null>(null)
  const [inputValue, setInputValue] = useState(value || '')
  const [isValidated, setIsValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '')
    }
  }, [value])

  useEffect(() => {
    let isMounted = true

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.log('[v0] No Google Maps API key found')
      setLoadError('Address lookup is not configured yet. You can still type the address manually.')
      setIsLoading(false)
      return
    }

    async function initAutocomplete() {
      try {
        const places = await loadGooglePlacesLibrary(apiKey)

        if (!isMounted || widgetRef.current || !widgetContainerRef.current) return

        const placeAutocomplete = new places.PlaceAutocompleteElement({
          includedPrimaryTypes: ['street_address', 'route', 'premise'],
          includedRegionCodes: ['il'],
          locationRestriction: {
            west: 35.10,
            south: 31.68,
            east: 35.32,
            north: 31.86,
          },
          requestedLanguage: 'en',
          requestedRegion: 'il',
        })

        placeAutocomplete.placeholder = placeholder
        placeAutocomplete.value = inputValue
        placeAutocomplete.className = 'jlm-place-autocomplete'
        placeAutocomplete.addEventListener('gmp-select', async (event) => {
          const selectEvent = event as PlaceAutocompleteSelectEvent
          const placePrediction = selectEvent.placePrediction || selectEvent.detail?.placePrediction

          if (!placePrediction) return

          const place = placePrediction.toPlace()
          await place.fetchFields({
            fields: ['formattedAddress', 'location'],
          })

          const address = place.formattedAddress || placePrediction.text?.toString() || ''
          if (!address) return

          setInputValue(address)
          setIsValidated(true)
          onChange(address)

          if (place.location) {
            onSelect({
              address,
              latitude: place.location.lat(),
              longitude: place.location.lng(),
            })
          }
        })
        placeAutocomplete.addEventListener('gmp-error', () => {
          setLoadError('Address lookup is unavailable right now. You can still type the address manually.')
        })

        widgetContainerRef.current.innerHTML = ''
        widgetContainerRef.current.appendChild(placeAutocomplete)
        widgetRef.current = placeAutocomplete
        setLoadError('')
        setIsLoading(false)
      } catch (err) {
        console.log('[v0] Error initializing autocomplete:', err)

        if (isMounted) {
          setLoadError('Address lookup is unavailable right now. You can still type the address manually.')
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
    if (widgetRef.current && value !== inputValue) {
      widgetRef.current.value = value || ''
    }
  }, [value, inputValue])

  return (
    <div className="relative">
      <div ref={widgetContainerRef} className={isLoading ? 'hidden' : ''} />
      {isLoading && (
        <input
          type="text"
          value=""
          readOnly
          placeholder="Loading address lookup..."
          className={className}
        />
      )}
      {inputValue && isValidated && (
        <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Address validated</span>
        </div>
      )}
      {inputValue && !isValidated && !isLoading && !loadError && (
        <div className="mt-1 text-xs text-stone-500">
          Choose the full address from the Google suggestions.
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

  currency_preference: 'ILS',
  price_ils: '',
  price_usd: '',

amenities: [],

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
const hostTermsVersion = '2026-05-18'
const isSupabaseEnvReady = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

export default function BecomeAHostPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [hostId, setHostId] = useState<string | null>(null)
  const [checkingHost, setCheckingHost] = useState(true)
  const [accountUser, setAccountUser] = useState<User | null>(null)
  const [requiresHostTermsAcceptance, setRequiresHostTermsAcceptance] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)

  const progress = useMemo(() => {
    return Math.round(((step + 1) / steps.length) * 100)
  }, [step])

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
        setHostId(hostProfile.id)
        setAccountUser(user)
        setRequiresHostTermsAcceptance(!hostProfile.host_terms_accepted_at)
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

  function nextStep() {
    setError('')

    if (step === 0 && !form.display_name) {
      setError('Please add the public display name guests should see.')
      return
    }

if (step === 0 && !form.phone && !form.whatsapp_number) {
      setError('Please provide either a phone number or WhatsApp number.')
      return
    }

    if (
      step === 0 &&
      form.host_type === 'representative' &&
      !form.has_permission
    ) {
      setError('Please confirm you have permission to submit this stay.')
      return
    }

    if (step === 1 && !form.apartment_title) {
      setError('Please give your stay a name before continuing.')
      return
    }

    if (step === 1 && !form.description.trim()) {
      setError('Please add a description before continuing.')
      return
    }

if (step === 2 && (!form.area || !form.area.trim())) {
      setError('Please enter a neighbourhood before continuing.')
      return
    }

    if (step === 2 && (!form.exact_address || !form.exact_address.trim())) {
      setError('Please enter your address before continuing.')
      return
    }

    if (step === 3 && (!form.bedrooms || Number(form.bedrooms) < 0)) {
      setError('Please enter the number of bedrooms.')
      return
    }

    if (step === 3 && (!form.bathrooms || Number(form.bathrooms) < 0)) {
      setError('Please enter the number of bathrooms.')
      return
    }

    if (step === 3 && (!form.sleeps || Number(form.sleeps) < 1)) {
      setError('Please enter how many guests the stay sleeps.')
      return
    }

    if (
      step === 4 &&
      (!form.price_ils || Number(form.price_ils) <= 0) &&
      (!form.price_usd || Number(form.price_usd) <= 0)
    ) {
      setError('Please enter at least one nightly price.')
      return
    }

    if (step === 5 && form.amenities.length === 0) {
      setError('Please select at least one amenity before continuing.')
      return
    }

    if (step === 6 && form.photos.length < minimumPhotoCount) {
      setError(`Please upload at least ${minimumPhotoCount} photos before continuing.`)
      return
    }

if (step === 7 && !form.verification_doc_type) {
      setError('Please select a document type.')
      return
    }

    if (step === 7 && !form.verification_doc) {
      setError('Please upload a verification document.')
      return
    }

    if (step === 7 && !form.id_doc_type) {
      setError('Please select your ID document type.')
      return
    }

    if (step === 7 && !form.id_doc) {
      setError('Please upload a valid ID document.')
      return
    }

    if (step === 8 && !form.confirmation) {
      setError('Please confirm the listing details before submitting.')
      return
    }

    if (step === 8 && requiresHostTermsAcceptance && !form.host_terms_accepted) {
      setError('Please agree to the host terms and conditions before submitting.')
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

    if (!isSupabaseEnvReady) {
      setError('The live listing database is not connected yet. Add the Supabase environment variables before accepting submissions.')
      setLoading(false)
      return
    }

    if (!form.confirmation) {
      setError('Please confirm the listing details before submitting.')
      setLoading(false)
      return
    }

    if (requiresHostTermsAcceptance && !form.host_terms_accepted) {
      setError('Please agree to the host terms and conditions before submitting.')
      setLoading(false)
      return
    }

    if (
      !form.apartment_title.trim() ||
      !form.description.trim() ||
      !form.area.trim() ||
      !form.exact_address.trim() ||
      Number(form.bedrooms) < 0 ||
      Number(form.bathrooms) < 0 ||
      Number(form.sleeps) < 1 ||
      ((!form.price_ils || Number(form.price_ils) <= 0) &&
        (!form.price_usd || Number(form.price_usd) <= 0)) ||
      form.amenities.length === 0 ||
      form.photos.length < minimumPhotoCount
    ) {
      setError('Please complete all required listing details before submitting.')
      setLoading(false)
      return
    }

    if (!hostId) {
      setError('Your host profile is still loading. Please wait a moment and try again.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    if (requiresHostTermsAcceptance) {
      const { error: termsError } = await supabase.rpc('accept_current_host_terms', {
        accepted_version: hostTermsVersion,
      })

      if (termsError) {
        console.error(termsError)
        setError('We could not record your host terms acceptance. Please try again.')
        setLoading(false)
        return
      }

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

      currency_preference: form.currency_preference,
      price_ils: Number(form.price_ils) || null,
      price_usd: Number(form.price_usd) || null,

      amenities: form.amenities,

      description: form.description || null,
      photo_link: form.photo_link || null,
      
      verification_doc_type: form.verification_doc_type,
      verification_status: 'pending',
      
      id_doc_type: form.id_doc_type,
      id_verified: false,

      status: 'new',
    }

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

    const applicationId = applicationData.id

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
        // Don't fail the whole submission, just log it
      } else {
        // Update the application with the verification doc path
        await supabase
          .from('host_applications')
          .update({ verification_doc_path: storagePath })
          .eq('id', applicationId)
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
        // Don't fail the whole submission, just log it
      } else {
        // Update the application with the ID doc path
        await supabase
          .from('host_applications')
          .update({ id_doc_path: storagePath })
          .eq('id', applicationId)
      }
    }

    // Upload photos to Supabase Storage with proper folder structure
    if (form.photos.length > 0) {
      for (let i = 0; i < form.photos.length; i++) {
        const photo = form.photos[i]
        const fileExt = photo.file.name.split('.').pop()?.toLowerCase() || 'file'
        const fileName = `photo-${i + 1}-${Date.now()}.${fileExt}`
        const storagePath = `listings/${applicationId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(storagePath, photo.file)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          setError(`Failed to upload ${photo.file.name}. Please try again.`)
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
          })

        if (photoRecordError) {
          console.error('Photo record error:', photoRecordError)
        }
      }
    }

    // Clean up preview URLs
    form.photos.forEach(photo => URL.revokeObjectURL(photo.preview))

    setSuccess(true)
    setLoading(false)
    setForm(initialForm)
    setStep(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="min-h-screen bg-[#F8F5F2] text-[#252525]">
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        <div className="mb-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <img
              src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
              alt="JLM Collective"
              className="h-14 w-auto"
            />

            <h1 className="mt-8 max-w-2xl text-4xl font-bold tracking-tight text-stone-950 md:text-6xl">
              Create your listing
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
              Add your stay in a few simple steps.
            </p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-stone-200">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>{steps[step]}</span>
              <span className="text-stone-400">
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
          <div className="mb-8 rounded-3xl bg-emerald-50 p-6 text-emerald-800 ring-1 ring-emerald-100">
            <h2 className="text-xl font-bold">
              Your listing has been submitted.
            </h2>
            <p className="mt-2 text-sm">
              Thank you. We are checking your submission and will notify you
              once it is ready to go live.
            </p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-stone-200">
              {steps.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    index === step
                      ? 'bg-[#c76f55] text-white'
                      : index < step
                        ? 'text-stone-900 hover:bg-stone-50'
                        : 'text-stone-400 hover:bg-stone-50'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                      index === step
                        ? 'bg-white text-[#c76f55]'
                        : 'bg-[#F8F5F2] text-stone-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-stone-200 md:p-10">
            {error && (
              <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
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
                      </div>
                      <button
                        type="button"
                        onClick={generateListingCopy}
                        disabled={aiLoading}
                        className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {aiLoading ? 'Improving...' : 'Improve with AI'}
                      </button>
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
                  </div>

                  <Field label="Give your stay a name" required>
                  <input
                    value={form.apartment_title}
                    onChange={(e) =>
                      updateField('apartment_title', e.target.value)
                    }
                    type="text"
                    placeholder="Example: Rechavia family apartment"
                    className={inputClass}
                  />
                </Field>

                <Field label="Tell guests what makes this stay useful">
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows="6"
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
                    <AddressAutocomplete
                      value={form.exact_address}
                      onChange={(val) => updateField('exact_address', val)}
                      onSelect={({ address, latitude, longitude }) => {
                        updateField('exact_address', address)
                        updateField('address_latitude', latitude)
                        updateField('address_longitude', longitude)
                      }}
                      placeholder="Start typing an address in Jerusalem..."
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-6 rounded-3xl bg-[#F8F5F2] p-5 text-sm leading-6 text-stone-600">
                  <p className="mb-2">Location details help place the stay correctly on the map.</p>
                  <p>Address is validated with Google Maps. Public listings show an approximate area rather than the full address.</p>
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {amenitiesList.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${
                        form.amenities.includes(item)
                          ? 'border-[#c76f55] bg-[#fff4ef] text-[#9e4f39]'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </StepShell>
            )}

{step === 6 && (
              <StepShell
                eyebrow="Photos"
                title="Add photos of your stay"
                description={`Upload at least ${minimumPhotoCount} clear photos to showcase your property. You'll be able to manage availability and block out dates from your Host Portal after approval.`}
              >
                <Field label={`Upload photos (minimum ${minimumPhotoCount}, JPG, PNG, WebP - max 5MB each)`}>
                  <div className="space-y-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-[#F8F5F2] p-8 transition hover:border-[#c76f55] hover:bg-[#F5F0EB]">
                      <svg className="mb-3 h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-stone-600">Click to upload photos</span>
                      <span className="mt-1 text-xs text-stone-400">The first photo will be your cover image</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          const validFiles = files.filter(file => {
                            const validTypes = ['image/jpeg', 'image/png', 'image/webp']
                            const maxSize = 5 * 1024 * 1024 // 5MB
                            if (!validTypes.includes(file.type)) {
                              alert(`${file.name} is not a valid image type. Please use JPG, PNG, or WebP.`)
                              return false
                            }
                            if (file.size > maxSize) {
                              alert(`${file.name} is too large. Maximum size is 5MB.`)
                              return false
                            }
                            return true
                          })
                          const newPhotos = validFiles.map(file => ({
                            file,
                            preview: URL.createObjectURL(file)
                          }))
                          updateField('photos', [...form.photos, ...newPhotos])
                          e.target.value = '' // Reset input
                        }}
                        className="hidden"
                      />
                    </label>

                    {form.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {form.photos.map((photo, index) => (
                          <div key={index} className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                            <img
                              src={photo.preview}
                              alt={`Upload ${index + 1}`}
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
                                updateField('photos', form.photos.filter((_, i) => i !== index))
                              }}
                              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-stone-600 opacity-0 shadow-sm transition hover:bg-white hover:text-red-600 group-hover:opacity-100"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
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
                        <span className="mt-1 text-xs text-stone-400">PDF, JPG, or PNG up to 10MB</span>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            
                            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
                            const maxSize = 10 * 1024 * 1024 // 10MB
                            
                            if (!validTypes.includes(file.type)) {
                              alert('Please upload a PDF, JPG, or PNG file.')
                              return
                            }
                            if (file.size > maxSize) {
                              alert('File is too large. Maximum size is 10MB.')
                              return
                            }
                            
                            updateField('verification_doc', {
                              file,
                              preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                              name: file.name,
                              type: file.type,
                            })
                            e.target.value = ''
                          }}
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
                            if (form.verification_doc.preview) {
                              URL.revokeObjectURL(form.verification_doc.preview)
                            }
                            updateField('verification_doc', null)
                          }}
                          className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-red-600"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
                          <span className="mt-1 text-xs text-stone-400">JPG or PNG up to 10MB</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              
                              const validTypes = ['image/jpeg', 'image/png', 'image/webp']
                              const maxSize = 10 * 1024 * 1024 // 10MB
                              
                              if (!validTypes.includes(file.type)) {
                                alert('Please upload a JPG or PNG image.')
                                return
                              }
                              if (file.size > maxSize) {
                                alert('File is too large. Maximum size is 10MB.')
                                return
                              }
                              
                              updateField('id_doc', {
                                file,
                                preview: URL.createObjectURL(file),
                                name: file.name,
                                type: file.type,
                              })
                              e.target.value = ''
                            }}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                          <img 
                            src={form.id_doc.preview} 
                            alt="ID preview" 
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-stone-900">{form.id_doc.name}</p>
                            <p className="text-xs text-stone-500">ID Document</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (form.id_doc.preview) {
                                URL.revokeObjectURL(form.id_doc.preview)
                              }
                              updateField('id_doc', null)
                            }}
                            className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-red-600"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
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
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c76f55] hover:underline">
                        Host Terms and Conditions
                      </Link>{' '}
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
                  className="rounded-full bg-[#c76f55] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || checkingHost}
                  className="rounded-full bg-[#c76f55] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingHost ? 'Loading...' : loading ? 'Submitting...' : 'Submit listing'}
                </button>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c76f55]'

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
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  )
}
