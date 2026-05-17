'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import { sampleListings } from '@/lib/sample-listings'

const neighborhoods = ['All', 'Ramat Eshkol', 'Gush 80', 'Jerusalem Estates', 'Romema', 'Rechavia', 'Shaarei Chesed', 'Baka', 'German Colony', 'Mamilla', 'Katamon', 'Nachlaot']

interface Listing {
  id: string
  title: string
  area: string
  bedrooms: number
  max_guests: number
  price_ils: number
  price_usd: number
  booking_type: string
  latitude: number
  longitude: number
  cover_photo_url?: string | null
}

// Dynamically import Google Maps component
const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#EDE7DF]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  )
})

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700 shadow-sm">
      {children}
    </span>
  )
}

function formatBookingType(type: string): string {
  switch (type) {
    case 'request': return 'Request to Book'
    case 'enquiry': return 'Enquiry Only'
    case 'instant': return 'Instant Book'
    default: return 'Request to Book'
  }
}

function StaysPageContent() {
  const searchParams = useSearchParams()
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'list'
  const initialArea = searchParams.get('neighborhood') || 'All'
  const activeFeature = searchParams.get('feature') || searchParams.get('type') || searchParams.get('season')
  const [view, setView] = useState<'list' | 'map'>(initialView)
  const [selectedArea, setSelectedArea] = useState(initialArea)
  const [listings, setListings] = useState<Listing[]>(sampleListings)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchListings() {
      if (!isSupabaseConfigured || !supabase) {
        setListings(sampleListings)
        setLoading(false)
        return
      }

      // Fetch listings with their cover photos
      const { data: listingsData, error } = await supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, latitude, longitude')
        .order('is_featured', { ascending: false })

      if (!error && listingsData && listingsData.length > 0) {
        // Fetch cover photos for each listing
        const { data: photosData } = await supabase
          .from('listing_photos')
          .select('listing_id, photo_url')
          .eq('is_cover', true)

        const photoMap = new Map(photosData?.map(p => [p.listing_id, p.photo_url]) || [])
        
        const listingsWithPhotos = listingsData.map(listing => ({
          ...listing,
          cover_photo_url: photoMap.get(listing.id) || null
        }))
        
        setListings(listingsWithPhotos)
      } else {
        setListings(sampleListings)
      }
      setLoading(false)
    }
    fetchListings()
  }, [])

  const filteredListings = selectedArea === 'All' 
    ? listings 
    : listings.filter(l => l.area === selectedArea)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Filters Bar */}
      <div className="sticky top-[73px] z-30 border-b border-stone-200 bg-[#F8F5F2]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {neighborhoods.map((area) => (
              <button
                key={area}
                onClick={() => setSelectedArea(area)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedArea === area
                    ? 'bg-[#1A4B5A] text-white'
                    : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          <div className="flex w-fit items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'list' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === 'map' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Map
            </button>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">
              {selectedArea === 'All' ? 'All stays in Jerusalem' : `Stays in ${selectedArea}`}
            </h1>
            <p className="mt-2 text-stone-500">{filteredListings.length} verified apartments available</p>
            {activeFeature && (
              <p className="mt-1 text-sm text-stone-500">
                Showing results related to {activeFeature}
              </p>
            )}
          </div>

          {filteredListings.length === 0 ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-stone-950">No stays found here yet</h2>
              <p className="mt-2 text-sm text-stone-500">Try another neighbourhood or view all Jerusalem stays.</p>
              <button
                onClick={() => setSelectedArea('All')}
                className="mt-5 rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]"
              >
                View all stays
              </button>
            </div>
          ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((stay) => (
              <Link key={stay.id} href={`/listings/${stay.id}`}>
                <article className="group cursor-pointer">
                  <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-3xl bg-stone-200 shadow-sm">
                    {stay.cover_photo_url ? (
                      <img 
                        src={stay.cover_photo_url} 
                        alt={stay.title}
                        className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 transition group-hover:scale-105" />
                    )}
                    <div className="absolute left-3 top-3"><Badge>{formatBookingType(stay.booking_type)}</Badge></div>
                    <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">Verified stay</div>
                  </div>
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{stay.area}</p>
                      <h3 className="text-lg font-bold leading-tight text-stone-900 group-hover:underline">{stay.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">{stay.bedrooms} bedrooms · sleeps {stay.max_guests}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-stone-900">
                        ₪{stay.price_ils?.toLocaleString()}
                        <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>
                      </p>
                      <p className="text-xs font-medium text-stone-400">${stay.price_usd?.toLocaleString()} / night</p>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          )}
        </div>
      ) : (
        <JerusalemMap 
          listings={filteredListings.map(l => ({
            id: l.id,
            title: l.title,
            area: l.area,
            price: `₪${l.price_ils?.toLocaleString()}`,
            bedrooms: l.bedrooms,
            sleeps: l.max_guests,
            lat: l.latitude,
            lng: l.longitude,
          }))}
        />
      )}
    </div>
  )
}

export default function StaysPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    }>
      <StaysPageContent />
    </Suspense>
  )
}
