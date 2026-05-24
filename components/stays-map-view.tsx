'use client'

import dynamic from 'next/dynamic'

type StaysMapListing = {
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

const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#EDE7DF]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  ),
})

export function StaysMapView({ listings }: { listings: StaysMapListing[] }) {
  return <JerusalemMap listings={listings} />
}
