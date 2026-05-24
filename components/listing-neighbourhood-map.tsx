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
      <div className="flex h-[320px] items-center justify-center bg-[#F8F5F2] px-6 text-center">
        <div>
          <p className="text-sm font-bold text-stone-950">{area}</p>
          <p className="mt-1 text-sm text-stone-500">
            Map will appear once Google Maps is configured.
          </p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[320px] items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-[#F8F5F2] md:h-[380px]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={16}
        options={mapOptions}
      >
        <OverlayView
          position={center}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div className="-translate-x-1/2 -translate-y-full pb-3">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-stone-200">
              <p className="max-w-[180px] truncate text-sm font-bold text-stone-950">
                {title}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#c76f55]">
                {area}
              </p>
            </div>
            <div className="mx-auto h-4 w-4 rotate-45 bg-white shadow-lg ring-1 ring-stone-200" />
          </div>
        </OverlayView>
      </GoogleMap>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm ring-1 ring-stone-200">
        Zoomed to {area}
      </div>
    </div>
  )
}
