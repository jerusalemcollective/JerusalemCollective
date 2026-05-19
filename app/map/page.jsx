'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { sampleListings } from '@/lib/sample-listings'
import { filterListings } from '@/lib/marketplace-rules'

// Dynamically import to avoid SSR issues
const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  ),
})

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export default function MapPage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [minimumBedrooms, setMinimumBedrooms] = useState(0)
  const [selectedAmenities, setSelectedAmenities] = useState([])

  const amenityFilters = [
    'Sukkah balcony',
    'Kosher kitchen',
    'Shabbat-friendly',
    'Near synagogues',
    'Elevator',
    'Parking',
  ]

  useEffect(() => {
    const toMapListings = (items) => items.map(listing => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      price: `₪${listing.price_ils?.toLocaleString()}`,
      bedrooms: listing.bedrooms,
      sleeps: listing.max_guests,
      lat: listing.latitude,
      lng: listing.longitude,
      amenities: listing.amenities || [],
    }))

    async function fetchListings() {
      let supabase
      try {
        supabase = createClient()
      } catch {
        setListings(toMapListings(sampleListings))
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('is_featured', { ascending: false })

      if (error) {
        console.error('Error fetching listings:', error)
        setListings(toMapListings(sampleListings))
      } else {
        setListings(toMapListings(data?.length ? data : sampleListings))
      }
      setLoading(false)
    }

    fetchListings()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  const filteredListings = filterListings(listings, {
    minimumBedrooms,
    selectedAmenities,
  })

  const toggleAmenity = (amenity) => {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    )
  }

  const clearFilters = () => {
    setMinimumBedrooms(0)
    setSelectedAmenities([])
  }

  return (
    <div className="relative">
      {/* Back button overlay */}
      <div className="absolute left-4 top-4 z-20">
        <Link 
          href="/stays" 
          className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-lg ring-1 ring-stone-200 hover:text-stone-900"
        >
          <ChevronLeftIcon />
          Back to list
        </Link>
      </div>

      <div className="absolute left-4 right-4 top-16 z-20 flex flex-col gap-2 rounded-3xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur md:left-auto md:right-4 md:w-[420px]">
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

          {amenityFilters.map((amenity) => {
            const active = selectedAmenities.includes(amenity)

            return (
              <button
                key={amenity}
                type="button"
                onClick={() => toggleAmenity(amenity)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
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

        {(minimumBedrooms > 0 || selectedAmenities.length > 0) && (
          <button
            type="button"
            onClick={clearFilters}
            className="w-fit text-sm font-semibold text-[#c76f55] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <JerusalemMap listings={filteredListings} />
    </div>
  )
}
