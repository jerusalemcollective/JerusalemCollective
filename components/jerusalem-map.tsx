'use client'

import React, { useState, useCallback, useEffect, useMemo, Component, ReactNode } from 'react'
import { GoogleMap, useJsApiLoader, OverlayView, type Libraries } from '@react-google-maps/api'
import Link from 'next/link'
import Image from 'next/image'
import { formatListingPrice } from '@/lib/utils/currency'

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
const DEFAULT_MAP_ZOOM = 13.8
const SELECTED_LISTING_ZOOM = 16

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  clickableIcons: false,
  minZoom: 12,
  maxZoom: 19,
  gestureHandling: 'greedy',
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
        <Link href="/stays" className="mt-5 inline-flex rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white hover:bg-[#111111]">
          Browse stays
        </Link>
      </div>
    </div>
  )
}

function PhotoPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
        <p className="mt-1 text-xs text-stone-600">Photo coming soon</p>
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
  const [mapAreaListings, setMapAreaListings] = useState<Listing[] | null>(null)
  const [showSearchArea, setShowSearchArea] = useState(false)
  const hasGoogleMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  const showSidebar = !onListingSelect
  const visibleListings = useMemo(
    () => listings.filter(
      (listing) => Number.isFinite(listing.lat) && Number.isFinite(listing.lng),
    ),
    [listings],
  )
  const displayListings = mapAreaListings || visibleListings

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
    language: 'en',
    region: 'IL',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  useEffect(() => {
    setMapAreaListings(null)
    setShowSearchArea(false)
  }, [visibleListings])

  useEffect(() => {
    if (!map || visibleListings.length === 0) return

    if (visibleListings.length === 1) {
      const [listing] = visibleListings
      map.setCenter({ lat: listing.lat, lng: listing.lng })
      map.setZoom(SELECTED_LISTING_ZOOM)
      return
    }

    const bounds = new google.maps.LatLngBounds()
    visibleListings.forEach((listing) => {
      bounds.extend({ lat: listing.lat, lng: listing.lng })
    })
    map.fitBounds(bounds, 72)

    window.setTimeout(() => {
      const currentZoom = map.getZoom()
      if (currentZoom && currentZoom < DEFAULT_MAP_ZOOM) {
        map.setZoom(DEFAULT_MAP_ZOOM)
      }
      if (currentZoom && currentZoom > SELECTED_LISTING_ZOOM) {
        map.setZoom(SELECTED_LISTING_ZOOM)
      }
    }, 120)
  }, [map, visibleListings])

  const handleMarkerClick = (listing: Listing) => {
    setSelectedListing(listing)
    onListingSelect?.(listing)
    map?.panTo({ lat: listing.lat, lng: listing.lng })
    map?.setZoom(SELECTED_LISTING_ZOOM)
  }

  const handleMapMoved = () => {
    if (map) setShowSearchArea(true)
  }

  const handleZoom = (direction: 'in' | 'out') => {
    if (!map) return

    const currentZoom = map.getZoom() || DEFAULT_MAP_ZOOM
    map.setZoom(direction === 'in' ? currentZoom + 1 : currentZoom - 1)
    setShowSearchArea(true)
  }

  const handleSearchThisArea = () => {
    const bounds = map?.getBounds()
    if (!bounds) return

    const nextListings = visibleListings.filter((listing) =>
      bounds.contains({ lat: listing.lat, lng: listing.lng }),
    )

    setMapAreaListings(nextListings)
    setSelectedListing(null)
    setShowSearchArea(false)
  }

  if (!hasGoogleMapsKey || loadError) {
    return (
      <div className="flex h-[calc(100vh-90px)] w-full items-center justify-center bg-[#F8F5F2]">
        <div className="max-w-md rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-xl">
          <h2 className="text-xl font-bold text-stone-950">Map preview needs a Google Maps key</h2>
          <p className="mt-2 text-sm text-stone-500">Listings still work, and the live map will appear once the key is configured.</p>
          <Link href="/stays" className="mt-5 inline-flex rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white hover:bg-[#111111]">
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
    <div className="relative h-[calc(100vh-120px)] min-h-[560px] w-full overflow-hidden bg-[#F8F5F2]">
      {/* Sidebar */}
      {showSidebar && (
      <div className="absolute left-0 top-0 z-10 hidden h-full w-[300px] overflow-y-auto border-r border-stone-200 bg-white p-4 shadow-xl lg:block">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Search by map</p>
          <h1 className="font-display mt-2 text-2xl font-bold text-stone-950">Jerusalem stays</h1>
          <p className="mt-2 text-sm text-stone-500">Browse verified apartments by location, area, and price.</p>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Dates</Link>
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Guests</Link>
          <Link href="/stays" className="rounded-full border border-stone-200 px-3 py-2 text-center text-xs font-semibold hover:border-[#c76f55] hover:text-[#c76f55]">Price</Link>
        </div>

        <div className="space-y-4">
          {displayListings.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-[#F8F5F2] p-5 text-sm text-stone-500">
              No listings in this map area.
            </div>
          ) : displayListings.map((listing) => (
            <button
              key={listing.id}
              onClick={() => handleMarkerClick(listing)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedListing?.id === listing.id
                  ? 'border-[#c76f55] bg-[#fff8f5]'
                  : 'border-stone-200 bg-white hover:border-[#c76f55]'
              }`}
            >
              <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-[#F8F5F2]">
                {listing.cover_photo_url ? (
                  <Image
                    src={listing.cover_photo_url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                    sizes="320px"
                    loading="lazy"
                  />
                ) : (
                  <PhotoPlaceholder />
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
      )}

      {/* Map */}
      <div className={`h-full w-full ${showSidebar ? 'lg:pl-[300px]' : ''}`}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={DEFAULT_MAP_ZOOM}
          options={mapOptions}
          onLoad={onLoad}
          onDragEnd={handleMapMoved}
          onZoomChanged={handleMapMoved}
        >
          {displayListings.map((listing) => (
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

      <div className={`absolute bottom-5 right-5 z-20 flex flex-col overflow-hidden rounded-full bg-white shadow-xl ring-1 ring-stone-200 ${showSidebar ? 'lg:right-5' : ''}`}>
        <button
          type="button"
          onClick={() => handleZoom('in')}
          className="flex h-11 w-11 items-center justify-center border-b border-stone-100 text-xl font-bold text-stone-800 transition hover:bg-stone-50"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom('out')}
          className="flex h-11 w-11 items-center justify-center text-xl font-bold text-stone-800 transition hover:bg-stone-50"
          aria-label="Zoom out"
        >
          -
        </button>
      </div>

      {showSearchArea && (
        <button
          type="button"
          onClick={handleSearchThisArea}
          className={`absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white shadow-xl transition hover:bg-[#111111] ${showSidebar ? 'lg:translate-x-[150px]' : ''}`}
        >
          Search this map area
        </button>
      )}

      {mapAreaListings && (
        <button
          type="button"
          onClick={() => {
            setMapAreaListings(null)
            setShowSearchArea(false)
          }}
          className={`absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-700 shadow-lg ring-1 ring-stone-200 transition hover:bg-stone-50 ${showSidebar ? 'lg:translate-x-[150px]' : ''}`}
        >
          Showing {displayListings.length} in this area · reset
        </button>
      )}

      {/* Selected listing popup */}
      {selectedListing && showSidebar && (
        <div className="absolute bottom-5 left-5 right-5 z-20 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 lg:left-[325px] lg:right-auto lg:w-[330px]">
          <button
            onClick={() => setSelectedListing(null)}
            className="absolute right-3 top-3 rounded-full p-1 hover:bg-stone-100"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
          <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-2xl bg-[#F8F5F2]">
            {selectedListing.cover_photo_url ? (
              <Image
                src={selectedListing.cover_photo_url}
                alt={selectedListing.title}
                fill
                className="object-cover"
                sizes="330px"
                loading="lazy"
              />
            ) : (
              <PhotoPlaceholder />
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{selectedListing.area}</p>
          <h3 className="mt-1 text-lg font-bold text-stone-950">{selectedListing.title}</h3>
          <p className="mt-1 text-sm text-stone-500">{selectedListing.bedrooms} bedrooms · sleeps {selectedListing.sleeps}</p>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-bold text-stone-950">{formatListingPrice(selectedListing)}</p>
            <a href={`/listings/${selectedListing.id}?from=stays`} className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white hover:bg-[#111111]">
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
