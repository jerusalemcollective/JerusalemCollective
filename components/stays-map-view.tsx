'use client'

import { MapPageClient, type MapListing } from '@/components/map-page-client'

type StaysMapListing = MapListing & {
  is_featured?: boolean
}

export function StaysMapView({ listings }: { listings: StaysMapListing[] }) {
  return <MapPageClient listings={listings} />
}
