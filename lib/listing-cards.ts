import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getListingRatings, type ListingRating } from '@/lib/reviews'
import { formatPreferredNightlyPrice } from '@/lib/utils/currency'

// How many photos a card lets guests swipe through.
export const CARD_PHOTO_LIMIT = 5

// The listing columns every card caller selects. Kept explicit (no select('*'))
// so a grid never pulls private columns such as the exact address.
export const LISTING_CARD_COLUMNS =
  'id, title, area, bedrooms, max_guests, price_ils, price_usd, cover_photo_url'

export type ListingCardRow = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  cover_photo_url?: string | null
}

export type ListingCardExtras = {
  photos: Map<string, string[]>
  ratings: Map<string, ListingRating>
}

const cardPhotoRowSchema = z.object({
  listing_id: z.string().nullable(),
  photo_url: z.string().nullable(),
})

// Groups ordered photo rows into up to CARD_PHOTO_LIMIT URLs per listing,
// keeping the query order (cover first, then sort_order).
export function groupCardPhotos(rows: { listing_id: string | null; photo_url: string | null }[]) {
  const photos = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.listing_id || !row.photo_url) continue
    const urls = photos.get(row.listing_id) ?? []
    if (urls.length < CARD_PHOTO_LIMIT && !urls.includes(row.photo_url)) urls.push(row.photo_url)
    photos.set(row.listing_id, urls)
  }
  return photos
}

// One batched photos query + one batched ratings query for a whole grid, run in
// parallel. Either read failing just leaves its map empty: cards then fall back
// to the denormalised cover photo and the "New" label.
export async function getListingCardExtras(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<ListingCardExtras> {
  if (listingIds.length === 0) return { photos: new Map(), ratings: new Map() }

  const loadPhotos = async () => {
    try {
      // Same order as the cover_photo_url trigger (migration 104), so the first
      // photo on the card is the cover the host picked.
      const { data } = await supabase
        .from('listing_photos')
        .select('listing_id, photo_url')
        .in('listing_id', listingIds)
        .order('is_cover', { ascending: false, nullsFirst: false })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
      return groupCardPhotos(z.array(cardPhotoRowSchema).parse(data ?? []))
    } catch {
      return new Map<string, string[]>()
    }
  }

  const [photos, ratings] = await Promise.all([loadPhotos(), getListingRatings(supabase, listingIds)])
  return { photos, ratings }
}

// Builds the ListingCard props from a listing row plus the batched extras.
export function toListingCardData(listing: ListingCardRow, extras: ListingCardExtras) {
  const cover = listing.cover_photo_url ?? null
  const photoUrls = extras.photos.get(listing.id) ?? (cover ? [cover] : [])

  return {
    id: listing.id,
    title: listing.title,
    area: listing.area,
    bedrooms: listing.bedrooms,
    max_guests: listing.max_guests,
    coverPhotoUrl: cover,
    photoUrls,
    rating: extras.ratings.get(listing.id) ?? null,
    priceLabel: formatPreferredNightlyPrice(listing),
    priceUsd: listing.price_usd,
    priceIls: listing.price_ils,
    hasPrice: Boolean(listing.price_ils || listing.price_usd),
  }
}
