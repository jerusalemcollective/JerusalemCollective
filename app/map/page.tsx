import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sampleListings } from '@/lib/sample-listings'
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
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('id, title, area, price_ils, price_usd, bedrooms, max_guests, latitude, longitude, amenities')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })

  const listingRows = z.array(listingRowSchema).parse(data?.length ? data : sampleListings)
  const listingIds = listingRows.map((listing) => listing.id)
  const { data: photoData } =
    listingIds.length > 0
      ? await supabase
          .from('listing_photos')
          .select('listing_id, photo_url, is_cover')
          .in('listing_id', listingIds)
          .order('is_cover', { ascending: false })
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

