import { createPublicClient } from '@/lib/supabase/public'
import {
  getListingCardExtras,
  LISTING_CARD_COLUMNS,
  toListingCardData,
  type ListingCardRow,
} from '@/lib/listing-cards'
import { ListingCard, LISTING_GRID_CLASS } from '@/components/listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'

const FEATURED_LIMIT = 8

// Featured listings, or the newest published ones when none are featured yet.
async function loadFeaturedStays() {
  try {
    const supabase = createPublicClient()
    const { data: featuredData } = await supabase
      .from('listings')
      .select(LISTING_CARD_COLUMNS)
      .eq('is_published', true)
      .eq('is_featured', true)
      .limit(FEATURED_LIMIT)

    let rows = (featuredData || []) as ListingCardRow[]
    if (rows.length === 0) {
      const { data: newestData } = await supabase
        .from('listings')
        .select(LISTING_CARD_COLUMNS)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(FEATURED_LIMIT)
      rows = (newestData || []) as ListingCardRow[]
    }

    const extras = await getListingCardExtras(supabase, rows.map((listing) => listing.id))
    return rows.map((listing) => toListingCardData(listing, extras))
  } catch (error) {
    console.error('Failed to load featured stays', error)
    return []
  }
}

// Streamed in behind a Suspense boundary on the homepage so the hero and search
// render before the listings query finishes.
export async function HomeFeaturedStays() {
  const featuredStays = await loadFeaturedStays()

  if (featuredStays.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white/60 px-6 py-16 text-center">
        <p className="font-heading text-xl font-semibold text-stone-950">New stays coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
          We&apos;re adding beautiful Jerusalem stays. Check back shortly, or send an enquiry
          and our local team will help you find the right place.
        </p>
      </div>
    )
  }

  return (
    <div className={LISTING_GRID_CLASS}>
      {featuredStays.map((stay) => (
        <ListingCard key={stay.id} listing={stay} />
      ))}
    </div>
  )
}

export function HomeFeaturedStaysSkeleton() {
  return <ListingGridSkeleton count={FEATURED_LIMIT} />
}
