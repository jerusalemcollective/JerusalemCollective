import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { ListingCard, LISTING_GRID_CLASS } from '@/components/listing-card'
import { getListingCardExtras, toListingCardData } from '@/lib/listing-cards'

const savedListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  bedrooms: z.number().nullable(),
  max_guests: z.number().nullable(),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
  cover_photo_url: z.string().nullable(),
})

const savedRowSchema = z.object({
  listing_id: z.string(),
  listings: savedListingSchema.nullable(),
})

type SavedListing = z.infer<typeof savedListingSchema>

export default async function SavedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/saved')
  }

  const { data } = await supabase
    .from('saved_listings')
    .select('listing_id, listings(id, title, area, bedrooms, max_guests, price_ils, price_usd, cover_photo_url)')
    .eq('user_id', user.id)

  const savedListings = z.array(savedRowSchema).parse(data ?? [])
    .map((row) => row.listings)
    .filter((listing): listing is SavedListing => Boolean(listing))
  const extras = await getListingCardExtras(supabase, savedListings.map((listing) => listing.id))

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Saved' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Saved stays</h1>
        </header>

        {savedListings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className={LISTING_GRID_CLASS}>
            {savedListings.map((listing) => (
              <ListingCard key={listing.id} listing={toListingCardData(listing, extras)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
        <Heart className="h-8 w-8 text-stone-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-stone-900">No saved stays yet</h2>
      <p className="mb-6 text-stone-600">Tap the heart on any stay you like, and you&apos;ll find it here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#252525] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111111]"
      >
        Find a stay
      </Link>
    </div>
  )
}
