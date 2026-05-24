'use client'

import React, { useState, useCallback, Component, ReactNode } from 'react'
import { GoogleMap, useJsApiLoader, OverlayView, type Libraries } from '@react-google-maps/api'
import Link from 'next/link'
import { formatDualCurrencyPrice } from '@/lib/utils/currency'

interface Listing {
  id: string
  title: string
  area: string
  price: string
  price_ils?: number | null
  price_usd?: number | null
  bedrooms: number
  sleeps: number
  lat: number
  lng: number
  amenities?: string[]
  cover_photo_url: string | null
  is_featured?: boolean
}

interface JerusalemMapProps {
  listings: Listing[]
  onListingSelect?: (listing: Listing) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const center = { lat: 31.7683, lng: 35.2137 }
const googleMapsLibraries: Libraries = ['places']

function formatListingPrice(listing: Pick<Listing, 'price' | 'price_ils' | 'price_usd'>) {
  return formatDualCurrencyPrice(listing, listing.price || 'Price on request')
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  clickableIcons: false,
  styles: [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

function MapFallback() {
  return (
    <div className="flex h-[calc(100vh-90px)] w-full items-center justify-center bg-[#F8F5F2]">
      <div className="max-w-md rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-xl">
        <h2 className="text-xl font-bold text-stone-950">Map temporarily unavailable</h2>
        <p className="mt-2 text-sm text-stone-500">The map could not be loaded. You can still browse listings in list view.</p>
        <Link href="/stays" className="mt-5 inline-flex rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]">
          Browse stays
        </Link>
      </div>
    </div>
  )
}

// Error boundary wrapper
class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <MapFallback />
    }
    return this.props.children
  }
}

function JerusalemMapInner({ listings, onListingSelect }: JerusalemMapProps) {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const hasGoogleMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
    language: 'en',
    region: 'IL',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const handleMarkerClick = (listing: Listing) => {
    setSelectedListing(listing)
    onListingSelect?.(listing)
    map?.panTo({ lat: listing.lat, lng: listing.lng })
    map?.setZoom(14)
  }

  if (!hasGoogleMapsKey || loadError) {
    return (
      <div className="flex h-[calc(100vh-90px)] w-full items-center justify-center bg-[#F8F5F2]">
        <div className="max-w-md rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-xl">
          <h2 className="text-xl font-bold text-stone-950">Map preview needs a Google Maps key</h2>
          <p className="mt-2 text-sm text-stone-500">Listings still work, and the live map will appear once the key is configured.</p>
          <Link href="/stays" className="mt-5 inline-flex rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]">
            Browse stays
          </Link>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[calc(100vh-90px)] w-full items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-90px)] w-full overflow-hidden bg-[#F8F5F2]">
      {/* Sidebar */}
      <div className="absolute left-0 top-0 z-10 hidden h-full w-[360px] overflow-y-auto border-r border-stone-200 bg-white p-4 shadow-xl lg:block">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Search by map</p>
          <h1 className="mt-2 text-2xl font-bold text-stone-950">Jerusalem stays</h1>
          <p className="mt-2 text-sm text-stone-500">Browse verified apartments by location, area, and price.</p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Dates</Link>
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Guests</Link>
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Price</Link>
        </div>

        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-[#F8F5F2] p-5 text-sm text-stone-500">
              No listings available yet.
            </div>
          ) : listings.map((listing) => (
            <button
              key={listing.id}
              onClick={() => handleMarkerClick(listing)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedListing?.id === listing.id
                  ? 'border-[#c76f55] bg-[#fff8f5]'
                  : 'border-stone-200 bg-white hover:border-[#c76f55]'
              }`}
            >
              <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-stone-200">
                {listing.cover_photo_url ? (
                  <img
                    src={listing.cover_photo_url}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
                )}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{listing.area}</p>
              <h3 className="mt-1 font-bold text-stone-950">{listing.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{listing.bedrooms} bedrooms · sleeps {listing.sleeps}</p>
              <p className="mt-2 font-bold text-stone-950">{formatListingPrice(listing)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="h-full w-full lg:pl-[360px]">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12.2}
          options={mapOptions}
          onLoad={onLoad}
        >
          {listings.map((listing) => (
            <OverlayView
              key={listing.id}
              position={{ lat: listing.lat, lng: listing.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <button
                onClick={() => handleMarkerClick(listing)}
                title={listing.title}
                className={`group relative rounded-full px-3 py-1 text-sm font-bold shadow-lg ring-1 transition hover:bg-[#c76f55] hover:text-white ${
                  selectedListing?.id === listing.id || listing.is_featured
                    ? 'bg-[#c76f55] text-white ring-[#c76f55]'
                    : 'bg-white text-[#252525] ring-stone-200'
                }`}
              >
                {formatListingPrice(listing)}
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-950 px-2 py-1 text-xs font-semibold text-white shadow-lg group-hover:block">
                  {listing.title}
                </span>
              </button>
            </OverlayView>
          ))}
        </GoogleMap>
      </div>

      {/* Selected listing popup */}
      {selectedListing && (
        <div className="absolute bottom-5 left-5 right-5 z-20 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 lg:left-[385px] lg:right-auto lg:w-[340px]">
          <button
            onClick={() => setSelectedListing(null)}
            className="absolute right-3 top-3 rounded-full p-1 hover:bg-stone-100"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
          <div className="mb-3 aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200">
            {selectedListing.cover_photo_url ? (
              <img
                src={selectedListing.cover_photo_url}
                alt={selectedListing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{selectedListing.area}</p>
          <h3 className="mt-1 text-lg font-bold text-stone-950">{selectedListing.title}</h3>
          <p className="mt-1 text-sm text-stone-500">{selectedListing.bedrooms} bedrooms · sleeps {selectedListing.sleeps}</p>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-bold text-stone-950">{formatListingPrice(selectedListing)}</p>
            <a href={`/listings/${selectedListing.id}?from=stays`} className="rounded-full bg-[#c76f55] px-4 py-2 text-sm font-bold text-white hover:bg-[#b85f47]">
              View stay
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function JerusalemMap({ listings, onListingSelect }: JerusalemMapProps) {
  return (
    <MapErrorBoundary>
      <JerusalemMapInner listings={listings} onListingSelect={onListingSelect} />
    </MapErrorBoundary>
  )
}
