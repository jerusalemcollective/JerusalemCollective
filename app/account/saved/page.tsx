import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SavedListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
}

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
    .select('listing_id, listings(id, title, area, bedrooms, max_guests, price_ils, price_usd)')
    .eq('user_id', user.id)

  const savedListings = (data || [])
    .map((row: any) => row.listings)
    .filter(Boolean) as SavedListing[]

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb current="Saved" />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Saved stays</h1>
          <p className="mt-2 text-stone-600">Shortlist places you want to come back to.</p>
        </header>

        {savedListings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {savedListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="rounded-lg bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                  {listing.area}
                </p>
                <h2 className="mt-2 text-xl font-bold text-stone-950">{listing.title}</h2>
                <p className="mt-2 text-sm text-stone-600">
                  {listing.bedrooms ?? '-'} bedrooms | sleeps {listing.max_guests ?? '-'}
                </p>
                <p className="mt-3 text-sm font-semibold text-stone-900">
                  {formatPrice(listing)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
      <Link href="/account" className="hover:text-[#c76f55]">Account</Link>
      <span>/</span>
      <span className="text-stone-900">{current}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
        <img
          src="/icons/yemin-moshe-save-ui-large.webp"
          alt=""
          className="h-20 w-20 object-contain opacity-40"
        />
      </div>
      <h2 className="mb-2 text-xl font-bold text-stone-900">No saved stays</h2>
      <p className="mb-6 text-stone-600">Save stays you like and they will appear here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b5624a]"
      >
        Explore stays
      </Link>
    </div>
  )
}

function formatPrice(listing: SavedListing) {
  if (listing.price_usd) return `$${Number(listing.price_usd).toLocaleString()}`
  if (listing.price_ils) return `₪${Number(listing.price_ils).toLocaleString()}`
  return 'Price on request'
}
