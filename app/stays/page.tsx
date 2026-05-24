import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { getAmenityLabel } from '@/lib/stay-amenities'
import { formatDualCurrencyPrice } from '@/lib/utils/currency'
import { StaysFilterBar } from '@/components/stays-filter-bar'
import { StaysMapView } from '@/components/stays-map-view'
import { StaysNeighborhoodNav } from '@/components/stays-neighborhood-nav'
import { RecentlyViewed } from '@/components/recently-viewed'

export const metadata = {
  title: 'Jerusalem Stays | JLM Collective',
  description: 'Find curated short-term stays in Jerusalem.',
}

export const revalidate = 1800

const neighborhoods = ['All', ...allNeighborhoods]
const defaultFeaturedNeighborhoods = ['Romema', 'Ramat Eshkol', 'Rechavia']

type SearchParams = Record<string, string>

const listingSchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  bedrooms: z.number().nullable().transform((value) => value ?? 0),
  max_guests: z.number().nullable().transform((value) => value ?? 0),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
  booking_type: z.string(),
  is_featured: z.boolean().nullable(),
  latitude: z.number().nullable().transform((value) => value ?? 31.7683),
  longitude: z.number().nullable().transform((value) => value ?? 35.2137),
  amenities: z.array(z.string()).nullable().transform((value) => value ?? []),
  cover_photo_url: z.string().nullable().optional(),
})

const blockedListingRowSchema = z.object({
  listing_id: z.string().nullable(),
})

const listingPhotoRowSchema = z.object({
  listing_id: z.string().nullable(),
  photo_url: z.string(),
  is_cover: z.boolean().nullable().optional(),
})

const popularNeighborhoodRowSchema = z.object({
  neighborhood: z.string().nullable(),
})

type Listing = z.infer<typeof listingSchema>

type StaysPageProps = {
  searchParams: Promise<SearchParams>
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
  const [listings, featuredNeighborhoods] = await Promise.all([
    loadListings({
      selectedArea,
      checkIn,
      checkOut,
      guests,
      minPrice,
      maxPrice,
      amenityLabels,
      kosherKitchen: Boolean(params.kosherKitchen),
      shabbatElevator: Boolean(params.shabbatElevator),
      physicalKey: Boolean(params.physicalKey),
      sukkahBalcony: Boolean(params.sukkahBalcony),
      nearSynagogue: Boolean(params.nearSynagogue),
      maxWalkToKotel: params.maxWalkToKotel,
    }),
    loadFeaturedNeighborhoods(),
  ])

  return (
    <div className="min-h-screen">
      <div className="sticky top-[73px] z-20 border-b border-stone-200 bg-[#F8F5F2]/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-start">
          <Suspense fallback={<div className="h-14 rounded-3xl bg-white shadow-sm" />}>
            <StaysFilterBar />
          </Suspense>

          <div className="flex w-fit items-center gap-1 rounded-full border border-stone-200 bg-white p-1 shadow-sm">
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

          <div className="lg:col-span-2">
            <StaysNeighborhoodNav
              neighborhoods={neighborhoods}
              featuredNeighborhoods={featuredNeighborhoods}
              selectedArea={selectedArea}
              baseQuery={params}
            />
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">
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
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-stone-950">
                No stays match your search
              </p>
              <p className="mt-2 text-stone-500">
                Try adjusting your filters or browse all available properties.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/stays"
                  className="rounded-full bg-[#c76f55] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#b85f47]"
                >
                  Clear all filters
                </Link>
                <Link
                  href="/stays?neighborhood=Rechavia"
                  className="rounded-full border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                >
                  Browse Rechavia
                </Link>
                <Link
                  href="/stays?neighborhood=German+Colony"
                  className="rounded-full border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                >
                  Browse German Colony
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              <Suspense fallback={null}>
                <RecentlyViewed />
              </Suspense>
            </>
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
            price: formatDualCurrencyPrice(listing),
            bedrooms: listing.bedrooms,
            sleeps: listing.max_guests,
            lat: listing.latitude,
            lng: listing.longitude,
            amenities: listing.amenities,
            cover_photo_url: listing.cover_photo_url || null,
            is_featured: Boolean(listing.is_featured),
          }))}
        />
      )}
    </div>
  )
}

async function loadFeaturedNeighborhoods() {
  try {
    const supabase = await createClient()
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)

    if ((count || 0) < 50) {
      return defaultFeaturedNeighborhoods
    }

    const { data } = await supabase.rpc('popular_neighborhoods', {
      result_limit: 3,
      lookback_days: 30,
    })
    const popularNeighborhoods = z.array(popularNeighborhoodRowSchema).parse(data ?? [])
      .map((row) => row.neighborhood)
      .filter((neighborhood): neighborhood is string => Boolean(neighborhood))
      .filter((neighborhood) => allNeighborhoods.includes(neighborhood))
      .slice(0, 3)

    return popularNeighborhoods.length > 0
      ? popularNeighborhoods
      : defaultFeaturedNeighborhoods
  } catch {
    return defaultFeaturedNeighborhoods
  }
}

async function loadListings({
  selectedArea,
  checkIn,
  checkOut,
  guests,
  minPrice,
  maxPrice,
  amenityLabels,
  kosherKitchen,
  shabbatElevator,
  physicalKey,
  sukkahBalcony,
  nearSynagogue,
  maxWalkToKotel,
}: {
  selectedArea: string
  checkIn?: string
  checkOut?: string
  guests: number | null
  minPrice: number | null
  maxPrice: number | null
  amenityLabels: string[]
  kosherKitchen: boolean
  shabbatElevator: boolean
  physicalKey: boolean
  sukkahBalcony: boolean
  nearSynagogue: boolean
  maxWalkToKotel?: string
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
        z.array(blockedListingRowSchema).parse(blockedRanges ?? [])
          .map((range) => range.listing_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
  }

  let listingsQuery = supabase
    .from('listings')
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, is_featured, latitude, longitude, amenities')
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

  if (kosherKitchen) {
    listingsQuery = listingsQuery
      .not('kosher_kitchen_level', 'is', null)
      .neq('kosher_kitchen_level', 'not_kosher')
  }

  if (shabbatElevator) {
    listingsQuery = listingsQuery.eq('shabbat_elevator', true)
  }

  if (physicalKey) {
    listingsQuery = listingsQuery.eq('physical_key_entry', true)
  }

  if (sukkahBalcony) {
    listingsQuery = listingsQuery.eq('sukkah_balcony', true)
  }

  if (nearSynagogue) {
    listingsQuery = listingsQuery.eq('near_synagogue', true)
  }

  if (maxWalkToKotel) {
    const minutes = Number(maxWalkToKotel)
    if (Number.isFinite(minutes)) {
      listingsQuery = listingsQuery.lte('walking_minutes_to_kotel', minutes)
    }
  }

  if (blockedListingIds.length > 0) {
    listingsQuery = listingsQuery.not('id', 'in', `(${blockedListingIds.join(',')})`)
  }

  const { data: listingsData } = await listingsQuery
  const listingRows = z.array(listingSchema).parse(listingsData ?? [])
  const listingIds = listingRows.map((listing) => listing.id)
  const { data: photosData } = listingIds.length
    ? await supabase
        .from('listing_photos')
        .select('listing_id, photo_url, is_cover')
        .in('listing_id', listingIds)
        .order('is_cover', { ascending: false })
        .order('sort_order', { ascending: true })
    : { data: [] }
  const photoMap = new Map<string, string>()

  for (const photo of z.array(listingPhotoRowSchema).parse(photosData ?? [])) {
    if (photo.listing_id && !photoMap.has(photo.listing_id)) {
      photoMap.set(photo.listing_id, photo.photo_url)
    }
  }

  return listingRows.map((listing) => ({
    ...listing,
    cover_photo_url: photoMap.get(listing.id) || null,
  }))
}

function ListingCard({
  listing,
}: {
  listing: Listing & {
    cover_photo_url?: string | null
  }
}) {
  return (
    <Link
      href={`/listings/${listing.id}?from=stays`}
      className="group block"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
        {listing.cover_photo_url ? (
          <Image
            src={listing.cover_photo_url}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
              <p className="mt-1 text-xs text-stone-400">Photo coming soon</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-0.5">
        <Link
          href={`/neighbourhoods/${slugifyNeighborhood(listing.area)}`}
          className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55] hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {listing.area}
        </Link>
        <p className="line-clamp-1 font-semibold leading-snug text-stone-950">
          {listing.title}
        </p>
        <p className="text-sm text-stone-500">
          {[
            listing.bedrooms ? `${listing.bedrooms} bed` : null,
            listing.max_guests ? `sleeps ${listing.max_guests}` : null,
          ]
            .filter(Boolean)
            .join(' \u00b7 ')}
        </p>
        <p className="pt-1 text-sm font-semibold text-stone-950">
          {formatDualCurrencyPrice(listing)}
          {(listing.price_ils || listing.price_usd) && (
            <span className="font-normal text-stone-500"> / night</span>
          )}
        </p>
      </div>
    </Link>
  )
}
