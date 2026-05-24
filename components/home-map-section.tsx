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

  return (
    <aside id="map" className="sticky top-24 hidden h-[380px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block">
      <div className="relative h-full overflow-hidden bg-[#eef0ea]">
        <div className="absolute inset-0">
          <svg
            viewBox="0 0 420 380"
            className="h-full w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect width="420" height="380" fill="#eef0ea" />
            <path d="M-10 84 C86 62 130 88 211 71 C292 55 345 34 430 52" stroke="#ffffff" strokeWidth="22" fill="none" opacity="0.95" />
            <path d="M30 -10 C74 67 70 137 112 210 C151 278 208 320 218 398" stroke="#ffffff" strokeWidth="18" fill="none" opacity="0.88" />
            <path d="M-12 254 C64 235 112 250 181 232 C256 213 311 185 432 194" stroke="#ffffff" strokeWidth="20" fill="none" opacity="0.9" />
            <path d="M278 -10 C253 71 282 132 258 203 C236 268 240 325 270 392" stroke="#ffffff" strokeWidth="14" fill="none" opacity="0.9" />
            <path d="M-4 130 C54 128 105 143 166 132 C236 119 284 105 424 118" stroke="#d8d7ce" strokeWidth="4" fill="none" opacity="0.85" />
            <path d="M76 0 C106 75 104 130 143 204 C177 269 225 309 239 380" stroke="#d8d7ce" strokeWidth="4" fill="none" opacity="0.8" />
            <path d="M0 282 C78 265 132 278 205 255 C273 234 332 218 420 224" stroke="#d8d7ce" strokeWidth="4" fill="none" opacity="0.82" />
            <path d="M318 0 C293 63 316 125 293 189 C270 252 278 313 315 380" stroke="#d8d7ce" strokeWidth="3.5" fill="none" opacity="0.8" />
            <path d="M20 168 L94 145 L139 181 L102 238 L34 226 Z" fill="#dde7d6" opacity="0.9" />
            <path d="M292 246 L389 234 L420 282 L390 354 L308 332 Z" fill="#dde7d6" opacity="0.82" />
            <path d="M245 92 L337 82 L368 130 L319 169 L251 151 Z" fill="#e7e3d9" opacity="0.88" />
            <circle cx="206" cy="190" r="66" fill="none" stroke="#d0cfc6" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />
            <circle cx="206" cy="190" r="120" fill="none" stroke="#d0cfc6" strokeWidth="2" strokeDasharray="5 10" opacity="0.45" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-[#fff4ef]/35" />
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
