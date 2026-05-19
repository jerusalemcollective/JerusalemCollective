'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import { sampleListings } from '@/lib/sample-listings'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { filterListings } from '@/lib/marketplace-rules'
import { StaysFilterBar, getAmenityLabel } from '@/components/stays-filter-bar'

const neighborhoods = ['All', ...allNeighborhoods]

interface Listing {
  id: string
  title: string
  area: string
  bedrooms: number
  max_guests: number
  price_ils: number | null
  price_usd: number | null
  booking_type: string
  latitude: number
  longitude: number
  amenities: string[]
  cover_photo_url?: string | null
}

// Dynamically import Google Maps component
const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#EDE7DF]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  )
})

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 shadow-sm">
      {children}
    </span>
  )
}

function formatBookingType(type: string): string {
  switch (type) {
    case 'request': return 'Request to Book'
    case 'enquiry': return 'Enquiry Only'
    case 'instant': return 'Instant Book'
    default: return 'Request to Book'
  }
}

function formatPrice(listing: Pick<Listing, 'price_ils' | 'price_usd'>) {
  const prices = []

  if (listing.price_ils) {
    prices.push(`\u20aa${Number(listing.price_ils).toLocaleString()}`)
  }

  if (listing.price_usd) {
    prices.push(`$${Number(listing.price_usd).toLocaleString()}`)
  }

  if (prices.length > 0) return prices.join(' / ')

  return 'Price on request'
}

async function trackNeighborhoodSearch(neighborhood: string, source: string) {
  if (
    neighborhood === 'All' ||
    !isSupabaseConfigured ||
    !supabase
  ) {
    return
  }

  await supabase.rpc('record_neighborhood_search', {
    searched_neighborhood: neighborhood,
    search_source: source,
  })
}

type BlockedListingRow = {
  listing_id: string | null
}

function parsePositiveNumber(value: string | null) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function parseAmenityLabels(value: string | null) {
  if (!value) return []

  return value
    .split(',')
    .map((item) => getAmenityLabel(item.trim()))
    .filter((item): item is string => Boolean(item))
}

function applyClientUrlFilters(
  listingRows: Listing[],
  filters: {
    guests: number | null
    minPrice: number | null
    maxPrice: number | null
    amenityLabels: string[]
    blockedListingIds: string[]
  },
) {
  return listingRows.filter((listing) => {
    if (filters.guests && listing.max_guests < filters.guests) return false
    if (filters.minPrice && Number(listing.price_usd || 0) < filters.minPrice) return false
    if (filters.maxPrice && Number(listing.price_usd || 0) > filters.maxPrice) return false
    if (filters.blockedListingIds.includes(listing.id)) return false

    return filters.amenityLabels.every((amenity) => listing.amenities?.includes(amenity))
  })
}

function StaysPageContent() {
  const searchParams = useSearchParams()
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'list'
  const initialArea = searchParams.get('neighborhood') || 'All'
  const activeFeature = searchParams.get('feature') || searchParams.get('type') || searchParams.get('season')
  const checkIn = searchParams.get('checkIn')
  const checkOut = searchParams.get('checkOut')
  const guests = parsePositiveNumber(searchParams.get('guests'))
  const minPrice = parsePositiveNumber(searchParams.get('minPrice'))
  const maxPrice = parsePositiveNumber(searchParams.get('maxPrice'))
  const amenityLabels = parseAmenityLabels(searchParams.get('amenities'))
  const amenityKey = amenityLabels.join('|')
  const [view, setView] = useState<'list' | 'map'>(initialView)
  const [selectedArea, setSelectedArea] = useState(initialArea)
  const [listings, setListings] = useState<Listing[]>(sampleListings)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchListings() {
      setLoading(true)
      if (!isSupabaseConfigured || !supabase) {
        setListings(
          applyClientUrlFilters(sampleListings, {
            guests,
            minPrice,
            maxPrice,
            amenityLabels,
            blockedListingIds: [],
          }),
        )
        setLoading(false)
        return
      }

      let blockedListingIds: string[] = []

      if (checkIn && checkOut) {
        const { data: blockedRanges } = await supabase
          .from('listing_unavailable_ranges')
          .select('listing_id')
          .lte('start_date', checkOut)
          .gte('end_date', checkIn)

        blockedListingIds = Array.from(
          new Set(
            ((blockedRanges || []) as BlockedListingRow[])
              .map((range) => range.listing_id)
              .filter((id): id is string => Boolean(id)),
          ),
        )
      }

      let listingsQuery = supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, latitude, longitude, amenities')
        .order('is_featured', { ascending: false })

      if (guests) {
        listingsQuery = listingsQuery.gte('max_guests', guests)
      }

      if (minPrice) {
        listingsQuery = listingsQuery.gte('price_usd', minPrice)
      }

      if (maxPrice) {
        listingsQuery = listingsQuery.lte('price_usd', maxPrice)
      }

      amenityLabels.forEach((amenity) => {
        listingsQuery = listingsQuery.contains('amenities', [amenity])
      })

      if (blockedListingIds.length > 0) {
        listingsQuery = listingsQuery.not('id', 'in', `(${blockedListingIds.join(',')})`)
      }

      const { data: listingsData, error } = await listingsQuery

      if (!error && listingsData) {
        const { data: photosData } = listingsData.length > 0
          ? await supabase
              .from('listing_photos')
              .select('listing_id, photo_url')
              .eq('is_cover', true)
              .in('listing_id', listingsData.map((listing) => listing.id))
          : { data: [] }

        const photoMap = new Map(photosData?.map(p => [p.listing_id, p.photo_url]) || [])
        
        const listingsWithPhotos = listingsData.map(listing => ({
          ...listing,
          cover_photo_url: photoMap.get(listing.id) || null
        }))
        
        setListings(listingsWithPhotos)
      } else {
        setListings(
          applyClientUrlFilters(sampleListings, {
            guests,
            minPrice,
            maxPrice,
            amenityLabels,
            blockedListingIds,
          }),
        )
      }
      setLoading(false)
    }
    fetchListings()
  }, [amenityKey, checkIn, checkOut, guests, maxPrice, minPrice])

  const filteredListings = filterListings(listings, {
    selectedArea,
    minimumBedrooms: 0,
    selectedAmenities: [],
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Filters Bar */}
      <div className="sticky top-[73px] z-30 border-b border-stone-200 bg-[#F8F5F2]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {neighborhoods.map((area) => (
              <button
                key={area}
                onClick={() => {
                  setSelectedArea(area)
                  void trackNeighborhoodSearch(area, 'stays_filter')
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedArea === area
                    ? 'bg-[#1A4B5A] text-white'
                    : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          <div className="flex w-fit items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'map' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Map
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <StaysFilterBar />
        </div>
      </div>

      {view === 'list' ? (
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">
              {selectedArea === 'All' ? 'All stays in Jerusalem' : `Stays in ${selectedArea}`}
            </h1>
            <p className="mt-2 text-stone-500">{filteredListings.length} verified apartments available</p>
            {activeFeature && (
              <p className="mt-1 text-sm text-stone-500">
                Showing results related to {activeFeature}
              </p>
            )}
          </div>

          {filteredListings.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-stone-950">No stays match your filters</h2>
              <p className="mt-2 text-sm text-stone-500">Try another neighbourhood or clear some filters.</p>
              <Link
                href="/stays"
                onClick={() => setSelectedArea('All')}
                className="mt-5 rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]"
              >
                Clear filters
              </Link>
            </div>
          ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((stay) => (
              <Link key={stay.id} href={`/listings/${stay.id}?from=stays`}>
                <article className="group cursor-pointer">
                  <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-3xl bg-stone-200 shadow-sm">
                    {stay.cover_photo_url ? (
                      <img 
                        src={stay.cover_photo_url} 
                        alt={stay.title}
                        className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 transition group-hover:scale-105" />
                    )}
                    <div className="absolute left-3 top-3"><Badge>{formatBookingType(stay.booking_type)}</Badge></div>
                    <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">Verified stay</div>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{stay.area}</p>
                      <h3 className="text-lg font-bold leading-tight text-stone-900 group-hover:underline">{stay.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">{stay.bedrooms} bedrooms · sleeps {stay.max_guests}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-stone-900">
                        {formatPrice(stay)}
                        {formatPrice(stay) !== 'Price on request' && (
                          <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>
                        )}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right">
                      <p className="text-lg font-bold text-stone-900">
                        ₪{stay.price_ils?.toLocaleString()}
                        <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>
                      </p>
                      <p className="text-xs font-medium text-stone-400">${stay.price_usd?.toLocaleString()} / night</p>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          )}
        </div>
      ) : (
        <JerusalemMap 
          listings={filteredListings.map(l => ({
            id: l.id,
            title: l.title,
            area: l.area,
            price_ils: l.price_ils,
            price_usd: l.price_usd,
            price: `₪${l.price_ils?.toLocaleString()}`,
            bedrooms: l.bedrooms,
            sleeps: l.max_guests,
            lat: l.latitude,
            lng: l.longitude,
          }))}
        />
      )}
    </div>
  )
}

export default function StaysPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    }>
      <StaysPageContent />
    </Suspense>
  )
}
