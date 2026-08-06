'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RecentListing = {
  id: string
  title: string
  area: string
  coverPhotoUrl: string | null
}

const STORAGE_KEY = 'jlm-recently-viewed'
const MAX_ITEMS = 6

export function recordListingView(listing: RecentListing) {
  try {
    const existing = getRecentlyViewed()
    const filtered = existing.filter((item) => item.id !== listing.id)
    const updated = [listing, ...filtered].slice(0, MAX_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // localStorage unavailable
  }
}

export function getRecentlyViewed(): RecentListing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentListing[]
  } catch {
    return []
  }
}

export function RecentlyViewed() {
  const [listings, setListings] = useState<RecentListing[]>([])

  useEffect(() => {
    const stored = getRecentlyViewed()
    // Only keep real listings that are still published — never show hidden,
    // removed, or sample listings just because they're in browser history.
    const realIds = stored.map((item) => item.id).filter((id) => !id.startsWith('sample-'))
    if (realIds.length === 0) {
      setListings([])
      return
    }

    let active = true
    const supabase = createClient()
    void supabase
      .from('listings')
      .select('id')
      .in('id', realIds)
      .eq('is_published', true)
      .then(({ data }) => {
        if (!active) return
        const visible = new Set((data || []).map((row) => row.id as string))
        setListings(stored.filter((item) => visible.has(item.id)))
      })

    return () => {
      active = false
    }
  }, [])

  if (listings.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold text-stone-950">
        Recently viewed
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {listings.map((listing) => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="group block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
              {listing.coverPhotoUrl && (
                <Image
                  src={listing.coverPhotoUrl}
                  alt={listing.title}
                  fill
                  className="object-cover transition group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                  loading="lazy"
                />
              )}
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs font-semibold text-stone-950">
              {listing.title}
            </p>
            <p className="text-[11px] text-stone-500">
              {listing.area}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
