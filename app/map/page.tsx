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
  cover_photo_url: z.string().nullable(),
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
    .select('id, title, area, price_ils, price_usd, bedrooms, max_guests, latitude, longitude, amenities, cover_photo_url')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .limit(MAP_MAX_LISTINGS)

  const listingRows = z.array(listingRowSchema).parse(data ?? [])
  const listings = listingRows.map((listing) =>
    toMapListing(listing, listing.cover_photo_url ?? null),
  )

  return <MapPageClient listings={listings} />
}

