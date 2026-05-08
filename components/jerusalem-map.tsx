'use client'

import { useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'
import Link from 'next/link'

interface Listing {
  id: string
  title: string
  area: string
  price: string
  bedrooms: number
  sleeps: number
  lat: number
  lng: number
}

interface JerusalemMapProps {
  listings: Listing[]
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const center = { lat: 31.7683, lng: 35.2137 }

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  clickableIcons: false,
  styles: [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

export default function JerusalemMap({ listings }: JerusalemMapProps) {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const hasGoogleMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    language: 'en',
    region: 'IL',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const handleMarkerClick = (listing: Listing) => {
    setSelectedListing(listing)
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
      <div className="absolute left-0 top-0 z-10 hidden h-full w-[420px] overflow-y-auto border-r border-stone-200 bg-white p-5 shadow-xl lg:block">
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
              <div className="mb-3 aspect-[4/3] rounded-xl bg-stone-200" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{listing.area}</p>
              <h3 className="mt-1 font-bold text-stone-950">{listing.title}</h3>
              <p className="mt-1 text-sm text-stone-500">{listing.bedrooms} bedrooms · sleeps {listing.sleeps}</p>
              <p className="mt-2 font-bold text-stone-950">{listing.price}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="h-full w-full lg:pl-[420px]">
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
                className={`rounded-full px-3 py-1 text-sm font-bold shadow-lg ring-1 transition hover:bg-[#c76f55] hover:text-white ${
                  selectedListing?.id === listing.id
                    ? 'bg-[#c76f55] text-white ring-[#c76f55]'
                    : 'bg-white text-[#252525] ring-stone-200'
                }`}
              >
                {listing.price}
              </button>
            </OverlayView>
          ))}
        </GoogleMap>
      </div>

      {/* Selected listing popup */}
      {selectedListing && (
        <div className="absolute bottom-5 left-5 right-5 z-20 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 lg:left-[445px] lg:right-auto lg:w-[360px]">
          <button
            onClick={() => setSelectedListing(null)}
            className="absolute right-3 top-3 rounded-full p-1 hover:bg-stone-100"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
          <div className="mb-3 aspect-[4/3] rounded-2xl bg-stone-200" />
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{selectedListing.area}</p>
          <h3 className="mt-1 text-lg font-bold text-stone-950">{selectedListing.title}</h3>
          <p className="mt-1 text-sm text-stone-500">{selectedListing.bedrooms} bedrooms · sleeps {selectedListing.sleeps}</p>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-bold text-stone-950">{selectedListing.price}</p>
            <a href={`/listings/${selectedListing.id}`} className="rounded-full bg-[#c76f55] px-4 py-2 text-sm font-bold text-white hover:bg-[#b85f47]">
              View stay
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
