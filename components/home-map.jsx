'use client'

import { useCallback, useState } from 'react'
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api'

const listings = [
  { id: '1', price: '₪14.9k', lat: 31.7925, lng: 35.2237, title: 'Ramat Eshkol Family Apartment' },
  { id: '2', price: '₪14.1k', lat: 31.7785, lng: 35.2165, title: 'Jerusalem Estates Bright Stay' },
  { id: '3', price: '₪18.5k', lat: 31.7915, lng: 35.2085, title: 'Romema Spacious Apartment' },
  { id: '4', price: '₪12.9k', lat: 31.7725, lng: 35.2137, title: 'Rechavia Classic' },
  { id: '5', price: '₪15.9k', lat: 31.7815, lng: 35.2285, title: 'Gush 80 Modern' },
]

const mapContainerStyle = { width: '100%', height: '100%' }
const center = { lat: 31.7833, lng: 35.2167 }

const mapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: 'cooperative',
  styles: [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

export default function HomeMap() {
  const [hoveredId, setHoveredId] = useState(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    language: 'en',
    region: 'IL',
  })

  if (loadError) {
    return (
      <div className="relative h-full bg-[#E9DFD2]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(#cdbfad 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-stone-500">Map could not load</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="relative h-full bg-[#E9DFD2]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(#cdbfad 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-[#c76f55]" />
        </div>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={12.5}
      options={mapOptions}
    >
      {listings.map((listing) => (
        <OverlayView
          key={listing.id}
          position={{ lat: listing.lat, lng: listing.lng }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <button
            onMouseEnter={() => setHoveredId(listing.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`rounded-xl px-3 py-2 text-sm font-bold shadow-lg transition hover:-translate-y-0.5 ${
              hoveredId === listing.id
                ? 'bg-white text-stone-800'
                : 'bg-[#c76f55] text-white'
            }`}
          >
            {listing.price}
          </button>
        </OverlayView>
      ))}
    </GoogleMap>
  )
}
