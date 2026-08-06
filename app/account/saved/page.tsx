import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { formatDualCurrencyPrice } from '@/lib/utils/currency'

const savedListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  bedrooms: z.number().nullable(),
  max_guests: z.number().nullable(),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
  listing_photos: z
    .array(z.object({
      photo_url: z.string(),
      is_cover: z.boolean().nullable(),
    }))
    .optional(),
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
    .select('listing_id, listings(id, title, area, bedrooms, max_guests, price_ils, price_usd, listing_photos(photo_url, is_cover))')
    .eq('user_id', user.id)

  const savedListings = z.array(savedRowSchema).parse(data ?? [])
    .map((row) => row.listings)
    .filter((listing): listing is SavedListing => Boolean(listing))

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Saved' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Saved stays</h1>
          <p className="mt-2 text-stone-600">Shortlist places you want to come back to.</p>
        </header>

        {savedListings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {savedListings.map((listing) => {
              const coverPhotoUrl =
                listing.listing_photos?.find((photo) => photo.is_cover)?.photo_url ||
                listing.listing_photos?.[0]?.photo_url ||
                null

              return (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
                    {coverPhotoUrl ? (
                      <Image
                        src={coverPhotoUrl}
                        alt={listing.title}
                        fill
                        className="object-cover transition group-hover:scale-[1.02]"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-50">
                        <p className="text-xs text-stone-500">
                          Photo coming soon
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                      {listing.area}
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-stone-950">{listing.title}</h2>
                    <p className="mt-2 text-sm text-stone-600">
                      {listing.bedrooms ?? '-'} bedrooms | sleeps {listing.max_guests ?? '-'}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-stone-900">
                      {formatDualCurrencyPrice(listing)}
                    </p>
                  </div>
                </Link>
              )
            })}
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
      <h2 className="mb-2 text-xl font-bold text-stone-900">No saved stays</h2>
      <p className="mb-6 text-stone-600">Save stays you like and they will appear here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#252525] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111111]"
      >
        Explore stays
      </Link>
    </div>
  )
}
