'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { filterListings } from '@/lib/marketplace-rules'
import { STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'
import { formatPreferredNightlyPrice } from '@/lib/utils/currency'

export type MapListing = {
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
  amenities: string[]
  cover_photo_url: string | null
}

type SelectedMapListing = Omit<MapListing, 'amenities'> & {
  amenities?: string[]
}

const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  ),
})

export function MapPageClient({ listings }: { listings: MapListing[] }) {
  const [minimumBedrooms, setMinimumBedrooms] = useState(0)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [selectedListing, setSelectedListing] = useState<SelectedMapListing | null>(null)
  const filteredListings = filterListings(listings, {
    minimumBedrooms,
    selectedAmenities,
  })

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    )
  }

  const clearFilters = () => {
    setMinimumBedrooms(0)
    setSelectedAmenities([])
    setSelectedListing(null)
  }

  const handleMapListingSelect = (listing: SelectedMapListing) => {
    setSelectedListing(listing)
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-4 z-20">
        <Link
          href="/stays"
          className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-lg ring-1 ring-stone-200 hover:text-stone-900"
        >
          <ChevronLeftIcon />
          Back to list
        </Link>
      </div>

      <div className="absolute left-4 right-4 top-16 z-20 flex max-h-[calc(100vh-8rem)] flex-col gap-3 overflow-y-auto rounded-3xl border border-stone-200 bg-white p-3 shadow-lg md:left-auto md:right-4 md:w-[300px]">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
            <span className="font-semibold">Bedrooms</span>
            <select
              value={minimumBedrooms}
              onChange={(event) => setMinimumBedrooms(Number(event.target.value))}
              className="bg-transparent text-sm font-semibold text-stone-900 outline-none"
            >
              <option value={0}>Any</option>
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
            </select>
          </label>

          <details className="group w-full rounded-2xl border border-stone-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-stone-800">
              <span>
                Amenities
                {selectedAmenities.length > 0 && (
                  <span className="ml-2 rounded-full bg-[#fff4ef] px-2 py-0.5 text-xs font-bold text-[#c76f55]">
                    {selectedAmenities.length}
                  </span>
                )}
              </span>
              <span className="text-xs text-stone-400 transition group-open:rotate-180">v</span>
            </summary>
            <div className="max-h-[28vh] overflow-y-auto border-t border-stone-100 p-3">
              <div className="grid gap-3">
                {STAY_AMENITY_GROUPS.map((group) => (
                  <section key={group.title}>
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                      {group.title}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.amenities.map((amenity) => {
                        const active = selectedAmenities.includes(amenity)

                        return (
                          <button
                            key={amenity}
                            type="button"
                            onClick={() => toggleAmenity(amenity)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              active
                                ? 'bg-[#c76f55] text-white'
                                : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
                            }`}
                          >
                            {amenity}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </details>
        </div>

        {(minimumBedrooms > 0 || selectedAmenities.length > 0) && (
          <button
            type="button"
            onClick={clearFilters}
            className="w-fit text-sm font-semibold text-[#c76f55] hover:underline"
          >
            Clear filters
          </button>
        )}

        {selectedListing && (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#F8F5F2]">
            <div className="relative aspect-[4/3] bg-[#F8F5F2]">
              {selectedListing.cover_photo_url ? (
                <Image
                  src={selectedListing.cover_photo_url}
                  alt={selectedListing.title}
                  fill
                  className="object-cover"
                  sizes="320px"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
                    <p className="mt-1 text-xs text-stone-600">Photo coming soon</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{selectedListing.area}</p>
              <h3 className="mt-1 font-bold text-stone-950">{selectedListing.title}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {selectedListing.bedrooms} bedrooms · sleeps {selectedListing.sleeps}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-bold text-stone-950">{formatMapListingPrice(selectedListing)}</p>
                <Link
                  href={`/listings/${selectedListing.id}`}
                  className="rounded-full bg-[#252525] px-4 py-2 text-sm font-bold text-white hover:bg-[#111111]"
                >
                  View listing
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <JerusalemMap listings={filteredListings} onListingSelect={handleMapListingSelect} />
    </div>
  )
}

function formatMapListingPrice(listing: Pick<SelectedMapListing, 'price' | 'price_ils' | 'price_usd'>) {
  return formatPreferredNightlyPrice(listing, listing.price || 'Price on request')
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
