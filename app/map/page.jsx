'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { sampleListings } from '@/lib/sample-listings'

// Dynamically import to avoid SSR issues
const JerusalemMap = dynamic(() => import('@/components/jerusalem-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
    </div>
  ),
})

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export default function MapPage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const toMapListings = (items) => items.map(listing => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      price: `₪${listing.price_ils?.toLocaleString()}`,
      bedrooms: listing.bedrooms,
      sleeps: listing.max_guests,
      lat: listing.latitude,
      lng: listing.longitude,
    }))

    async function fetchListings() {
      if (!isSupabaseConfigured || !supabase) {
        setListings(toMapListings(sampleListings))
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('is_featured', { ascending: false })

      if (error) {
        console.error('Error fetching listings:', error)
        setListings(toMapListings(sampleListings))
      } else {
        setListings(toMapListings(data?.length ? data : sampleListings))
      }
      setLoading(false)
    }

    fetchListings()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Back button overlay */}
      <div className="absolute left-4 top-4 z-20">
        <Link 
          href="/stays" 
          className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-lg ring-1 ring-stone-200 hover:text-stone-900"
        >
          <ChevronLeftIcon />
          Back to list
        </Link>
      </div>

      <JerusalemMap listings={listings} />
    </div>
  )
}
