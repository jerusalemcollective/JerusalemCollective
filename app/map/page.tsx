import { createClient } from '@/lib/supabase/server'
import { sampleListings } from '@/lib/sample-listings'
import { MapPageClient, type MapListing } from '@/components/map-page-client'

type ListingRow = {
  id: string
  title: string
  area: string
  price_ils: number | null
  price_usd: number | null
  bedrooms: number
  max_guests: number
  latitude: number | null
  longitude: number | null
  amenities: string[] | null
}

type ListingPhotoRow = {
  listing_id: string
  photo_url: string
  is_cover: boolean | null
}

export const metadata = {
  title: 'Jerusalem Map | JLM Collective',
  description: 'Browse curated Jerusalem stays on the map.',
}

function formatPrice(listing: Pick<ListingRow, 'price_ils' | 'price_usd'>) {
  const prices = []
  if (listing.price_ils) prices.push(`₪${listing.price_ils.toLocaleString()}`)
  if (listing.price_usd) prices.push(`$${listing.price_usd.toLocaleString()}`)
  return prices.length ? prices.join(' / ') : 'Price on request'
}

function toMapListing(listing: ListingRow, coverPhotoUrl: string | null): MapListing {
  return {
    id: listing.id,
    title: listing.title,
    area: listing.area,
    price: formatPrice(listing),
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

  const listingRows = data?.length ? (data as ListingRow[]) : (sampleListings as ListingRow[])
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

  for (const photo of (photoData || []) as ListingPhotoRow[]) {
    if (!coverPhotoByListing.has(photo.listing_id)) {
      coverPhotoByListing.set(photo.listing_id, photo.photo_url)
    }
  }
  const listings = listingRows.map((listing) =>
    toMapListing(listing, coverPhotoByListing.get(listing.id) || null),
  )

  return <MapPageClient listings={listings} />
}

