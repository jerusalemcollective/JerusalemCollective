'use client'

import { GoogleMap, OverlayView, useJsApiLoader, type Libraries } from '@react-google-maps/api'

type ListingNeighbourhoodMapProps = {
  title: string
  area: string
  latitude: number
  longitude: number
}

const googleMapsLibraries: Libraries = ['places']

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const mapOptions: google.maps.MapOptions = {
  clickableIcons: false,
  disableDefaultUI: true,
  gestureHandling: 'cooperative',
  zoomControl: true,
  styles: [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

function StaticNeighbourhoodMap({
  title,
  area,
  status,
}: {
  title: string
  area: string
  status?: string
}) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-[#eef0ea] md:h-[380px]">
      <div className="absolute inset-0">
        <svg
          viewBox="0 0 760 380"
          className="h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect width="760" height="380" fill="#eef0ea" />
          <path d="M-20 76 C134 42 224 86 342 62 C480 34 602 42 792 22" stroke="#ffffff" strokeWidth="28" fill="none" opacity="0.95" />
          <path d="M72 -20 C130 88 126 156 192 252 C240 322 306 340 340 410" stroke="#ffffff" strokeWidth="22" fill="none" opacity="0.92" />
          <path d="M-28 256 C96 226 188 258 316 222 C430 190 544 204 792 174" stroke="#ffffff" strokeWidth="24" fill="none" opacity="0.9" />
          <path d="M526 -24 C486 72 536 142 498 234 C462 320 480 360 536 414" stroke="#ffffff" strokeWidth="18" fill="none" opacity="0.9" />
          <path d="M0 126 C102 124 178 144 278 128 C390 110 478 108 760 104" stroke="#d8d7ce" strokeWidth="5" fill="none" opacity="0.85" />
          <path d="M118 0 C164 94 158 154 220 246 C274 326 342 338 384 380" stroke="#d8d7ce" strokeWidth="5" fill="none" opacity="0.82" />
          <path d="M0 290 C132 264 226 288 350 248 C472 210 596 226 760 202" stroke="#d8d7ce" strokeWidth="5" fill="none" opacity="0.82" />
          <path d="M582 0 C544 74 590 142 552 226 C516 306 544 348 610 380" stroke="#d8d7ce" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M42 166 L158 138 L224 184 L170 252 L54 236 Z" fill="#dde7d6" opacity="0.95" />
          <path d="M486 260 L662 236 L760 286 L688 374 L512 340 Z" fill="#dde7d6" opacity="0.85" />
          <path d="M432 82 L608 70 L674 138 L578 184 L450 154 Z" fill="#e7e3d9" opacity="0.9" />
          <circle cx="380" cy="190" r="72" fill="none" stroke="#d0cfc6" strokeWidth="2" strokeDasharray="6 8" opacity="0.75" />
          <circle cx="380" cy="190" r="132" fill="none" stroke="#d0cfc6" strokeWidth="2" strokeDasharray="5 10" opacity="0.5" />
        </svg>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-[#fff4ef]/32" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c76f55]/15 ring-2 ring-[#c76f55]/40" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c76f55] shadow-lg ring-4 ring-white" />
      <div className="absolute left-1/2 top-[calc(50%+4.5rem)] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-center shadow-xl ring-1 ring-stone-200">
        <p className="max-w-[220px] truncate text-sm font-bold text-stone-950">
          Approximate location
        </p>
        <p className="mt-0.5 text-xs font-semibold text-[#c76f55]">
          {area}
        </p>
      </div>
      <div className="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 shadow-md ring-1 ring-stone-100">
        <span className="sr-only">{title}</span>
        <p className="text-xs font-bold text-stone-950">{area}</p>
        <p className="text-[10px] text-stone-500">Neighbourhood map</p>
      </div>
      {status && (
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 px-3 py-2 text-xs text-stone-600 shadow-md ring-1 ring-stone-100">
          {status}
        </div>
      )}
    </div>
  )
}

export function ListingNeighbourhoodMap({
  title,
  area,
  latitude,
  longitude,
}: ListingNeighbourhoodMapProps) {
  const hasGoogleMapsKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  const center = { lat: latitude, lng: longitude }
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: googleMapsLibraries,
    language: 'en',
    region: 'IL',
  })

  if (!hasGoogleMapsKey || loadError) {
    return (
      <StaticNeighbourhoodMap
        title={title}
        area={area}
        status="Live Google map will appear once the Maps key is configured for this domain."
      />
    )
  }

  if (!isLoaded) {
    return (
      <StaticNeighbourhoodMap
        title={title}
        area={area}
        status="Loading live map..."
      />
    )
  }

  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-[#F8F5F2] md:h-[380px]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
      >
        <OverlayView
          position={center}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <div className="h-28 w-28 rounded-full bg-[#c76f55]/15 ring-2 ring-[#c76f55]/40" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c76f55] shadow-lg ring-4 ring-white" />
          </div>
        </OverlayView>
      </GoogleMap>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-stone-200">
        Approximate location in {area}
      </div>
    </div>
  )
}
