'use client'

import Link from 'next/link'

type HomeMapListing = {
  id: string
  title: string
  area: string
  price_ils: number | null
  price_usd: number | null
  coverPhotoUrl: string | null
}

const pinPositions = [
  'left-[12%] top-[18%]',
  'right-[12%] top-[30%]',
  'left-[18%] bottom-[22%]',
  'right-[18%] bottom-[14%]',
]

function formatMapPrice(listing: HomeMapListing) {
  if (listing.price_usd) return `$${Number(listing.price_usd).toLocaleString()}`
  if (listing.price_ils) return `\u20aa${Number(listing.price_ils).toLocaleString()}`
  return 'View stay'
}

export function HomeMapSection({ listings }: { listings: HomeMapListing[] }) {
  const previewListings = listings.length > 0 ? listings : []
  const heroListing = previewListings[0] || null

  return (
    <aside id="map" className="sticky top-24 hidden h-[380px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block">
      <div className="relative h-full bg-[#fbf8f5]">
        {heroListing?.coverPhotoUrl && (
          <img
            src={heroListing.coverPhotoUrl}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-white/82 via-[#fbf8f5]/58 to-[#fff4ef]/54" />
        <div className="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 shadow-md ring-1 ring-stone-100">
          <div className="text-xs font-bold text-stone-950">Map preview</div>
          <div className="text-[10px] text-stone-500">Browse stays by area</div>
        </div>
        <Link href="/map" className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-stone-800 shadow-md transition hover:bg-stone-50">
          Full screen
        </Link>

        {previewListings.map((listing, index) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}?from=home-map`}
            className={`absolute ${pinPositions[index] || pinPositions[0]} overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-2xl`}
          >
            <div className="relative h-16 w-28">
              {listing.coverPhotoUrl ? (
                <img
                  src={listing.coverPhotoUrl}
                  alt={listing.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#fff4ef]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#c76f55]">JLM</p>
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className="line-clamp-1 text-[10px] font-bold text-stone-950">
                {listing.area}
              </p>
              <p className="text-[10px] font-semibold text-[#c76f55]">
                {formatMapPrice(listing)}
              </p>
            </div>
          </Link>
        ))}

        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-stone-100">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-[#c76f55]" />
              <div>
                <div className="text-xs font-bold">Open full map</div>
                <div className="text-[10px] text-stone-500">See photos, prices and areas</div>
              </div>
            </div>
            <Link href="/map" className="rounded-full bg-[#252525] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#111111]">
              Open
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
