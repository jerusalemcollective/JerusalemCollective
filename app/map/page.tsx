import { createPublicClient } from '@/lib/supabase/public'
import { z } from 'zod'
import { MapPageClient, type MapListing } from '@/components/map-page-client'
import { formatDualCurrencyPrice } from '@/lib/utils/currency'

const listingRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
  bedrooms: z.number().nullable().transform((value) => value ?? 0),
  max_guests: z.number().nullable().transform((value) => value ?? 0),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  amenities: z.array(z.string()).nullable(),
})

const listingPhotoRowSchema = z.object({
  listing_id: z.string(),
  photo_url: z.string(),
  is_cover: z.boolean().nullable(),
})

type ListingRow = z.infer<typeof listingRowSchema>

// Cookieless public reads keep this page cacheable (ISR). A generous upper
// bound protects the map from an unbounded listings fetch as inventory grows;
// the curated catalogue is far below this today, so no pins are hidden.
export const revalidate = 1800
const MAP_MAX_LISTINGS = 500

export const metadata = {
  title: 'Jerusalem Map',
  description: 'Browse curated Jerusalem stays on the map.',
  alternates: {
    canonical: '/map',
  },
}

function toMapListing(listing: ListingRow, coverPhotoUrl: string | null): MapListing {
  return {
    id: listing.id,
    title: listing.title,
    area: listing.area,
    price: formatDualCurrencyPrice(listing),
    price_ils: listing.price_ils,
    price_usd: listing.price_usd,
    bedrooms: listing.bedrooms,
    sleeps: listing.max_guests,
    lat: listing.latitude || 31.7683,
    lng: listing.longitude || 35.2137,
    amenities: listing.amenities || [],
    cover_photo_url: coverPhotoUrl,
  }
}

export default async function MapPage() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('listings')
    .select('id, title, area, price_ils, price_usd, bedrooms, max_guests, latitude, longitude, amenities')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .limit(MAP_MAX_LISTINGS)

  const listingRows = z.array(listingRowSchema).parse(data ?? [])
  const listingIds = listingRows.map((listing) => listing.id)
  const { data: photoData } =
    listingIds.length > 0
      ? await supabase
          .from('listing_photos')
          .select('listing_id, photo_url, is_cover')
          .eq('is_cover', true)
          .in('listing_id', listingIds)
      : { data: [] }
  const coverPhotoByListing = new Map<string, string>()

  for (const photo of z.array(listingPhotoRowSchema).parse(photoData ?? [])) {
    if (!coverPhotoByListing.has(photo.listing_id)) {
      coverPhotoByListing.set(photo.listing_id, photo.photo_url)
    }
  }
  const listings = listingRows.map((listing) =>
    toMapListing(listing, coverPhotoByListing.get(listing.id) || null),
  )

  return <MapPageClient listings={listings} />
}

