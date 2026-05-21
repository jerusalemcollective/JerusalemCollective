import { Suspense, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { getAmenityLabel } from '@/lib/stay-amenities'
import { StaysFilterBar } from '@/components/stays-filter-bar'
import { StaysMapView } from '@/components/stays-map-view'
import { StaysNeighborhoodNav } from '@/components/stays-neighborhood-nav'

export const metadata = {
  title: 'Jerusalem Stays | JLM Collective',
  description: 'Find curated short-term stays in Jerusalem.',
}

export const revalidate = 1800

const neighborhoods = ['All', ...allNeighborhoods]

type SearchParams = Record<string, string>

type Listing = {
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

type BlockedListingRow = {
  listing_id: string | null
}

type ListingPhotoRow = {
  listing_id: string | null
  photo_url: string
}

type StaysPageProps = {
  searchParams: Promise<SearchParams>
}

function Badge({ children }: { children: ReactNode }) {
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

function parsePositiveNumber(value?: string) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function parseAmenityLabels(value?: string) {
  if (!value) return []

  return value
    .split(',')
    .map((item) => getAmenityLabel(item.trim()))
    .filter((item): item is string => Boolean(item))
}

function cleanSearchParams(params: SearchParams) {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}

function buildHref(baseQuery: Record<string, string>, updates: Record<string, string | null>) {
  const params = new URLSearchParams(baseQuery)

  Object.entries(updates).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
  })

  const query = params.toString()
  return query ? `/stays?${query}` : '/stays'
}

export default async function StaysPage({ searchParams }: StaysPageProps) {
  const params = cleanSearchParams(await searchParams)
  const view = params.view === 'map' ? 'map' : 'list'
  const selectedArea = params.neighborhood || params.area || 'All'
  const activeFeature = params.feature || params.type || params.season
  const checkIn = params.checkIn
  const checkOut = params.checkOut
  const guests = parsePositiveNumber(params.guests)
  const minPrice = parsePositiveNumber(params.minPrice)
  const maxPrice = parsePositiveNumber(params.maxPrice)
  const amenityLabels = parseAmenityLabels(params.amenities)
  const hasActiveSearch = Boolean(
    params.neighborhood ||
      params.area ||
      params.checkIn ||
      params.checkOut ||
      params.guests ||
      params.minPrice ||
      params.maxPrice ||
      params.amenities,
  )
  const listings = await loadListings({
    selectedArea,
    checkIn,
    checkOut,
    guests,
    minPrice,
    maxPrice,
    amenityLabels,
  })

  return (
    <div className="min-h-screen">
      <div className="sticky top-[73px] z-30 border-b border-stone-200 bg-[#F8F5F2]/95 backdrop-blur-sm">
        <div className={`mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center ${hasActiveSearch ? 'lg:justify-end' : 'lg:justify-between'}`}>
          {!hasActiveSearch && (
            <StaysNeighborhoodNav
              neighborhoods={neighborhoods}
              selectedArea={selectedArea}
              baseQuery={params}
            />
          )}

          <div className="flex w-fit items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
            <Link
              href={buildHref(params, { view: null })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              List
            </Link>
            <Link
              href={buildHref(params, { view: 'map' })}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'map' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Map
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <Suspense fallback={<div className="h-24 rounded-3xl bg-white shadow-sm" />}>
            <StaysFilterBar />
          </Suspense>
        </div>
      </div>

      {view === 'list' ? (
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">
              {selectedArea === 'All' ? 'All stays in Jerusalem' : `Stays in ${selectedArea}`}
            </h1>
            <p className="mt-2 text-stone-500">{listings.length} verified apartments available</p>
            {activeFeature && (
              <p className="mt-1 text-sm text-stone-500">
                Showing results related to {activeFeature}
              </p>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-stone-950">No stays match your filters</h2>
              <p className="mt-2 text-sm text-stone-500">Try another neighbourhood or clear some filters.</p>
              <Link
                href="/stays"
                className="mt-5 inline-flex rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((stay) => (
                <Link key={stay.id} href={`/listings/${stay.id}?from=stays`}>
                  <article className="group cursor-pointer">
                    <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-3xl bg-stone-200 shadow-sm">
                      {stay.cover_photo_url ? (
                        <Image
                          src={stay.cover_photo_url}
                          alt={stay.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
                          loading="lazy"
                          className="object-cover transition hover:scale-105"
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
                        <p className="mt-1 text-sm text-stone-500">{stay.bedrooms} bedrooms | sleeps {stay.max_guests}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-stone-900">
                          {formatPrice(stay)}
                          {formatPrice(stay) !== 'Price on request' && (
                            <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <StaysMapView
          listings={listings.map((listing) => ({
            id: listing.id,
            title: listing.title,
            area: listing.area,
            price_ils: listing.price_ils,
            price_usd: listing.price_usd,
            price: formatPrice(listing),
            bedrooms: listing.bedrooms,
            sleeps: listing.max_guests,
            lat: listing.latitude,
            lng: listing.longitude,
          }))}
        />
      )}
    </div>
  )
}

async function loadListings({
  selectedArea,
  checkIn,
  checkOut,
  guests,
  minPrice,
  maxPrice,
  amenityLabels,
}: {
  selectedArea: string
  checkIn?: string
  checkOut?: string
  guests: number | null
  minPrice: number | null
  maxPrice: number | null
  amenityLabels: string[]
}) {
  const supabase = await createClient()
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
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (selectedArea && selectedArea !== 'All') {
    listingsQuery = listingsQuery.eq('area', selectedArea)
  }

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

  const { data: listingsData } = await listingsQuery
  const listingRows = (listingsData || []) as Listing[]
  const listingIds = listingRows.map((listing) => listing.id)
  const { data: photosData } = listingIds.length
    ? await supabase
        .from('listing_photos')
        .select('listing_id, photo_url')
        .eq('is_cover', true)
        .in('listing_id', listingIds)
    : { data: [] }
  const photoMap = new Map(
    ((photosData || []) as ListingPhotoRow[])
      .filter((photo) => photo.listing_id)
      .map((photo) => [photo.listing_id as string, photo.photo_url]),
  )

  return listingRows.map((listing) => ({
    ...listing,
    cover_photo_url: photoMap.get(listing.id) || null,
  }))
}
