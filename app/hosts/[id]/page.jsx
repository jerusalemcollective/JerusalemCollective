'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Helper to get the public display name for a host
function getPublicName(host) {
  if (host.show_full_name) {
    return host.name
  }
  return host.display_name || host.name.split(' ')[0]
}

export default function HostProfilePage() {
  const params = useParams()
  const hostId = params.id

  const [host, setHost] = useState(null)
  const [listings, setListings] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHostData() {
      let supabase
      try {
        supabase = createClient()
      } catch {
        setLoading(false)
        return
      }

      // Fetch host profile
      const { data: hostData, error: hostError } = await supabase
        .from('hosts')
        .select('*')
        .eq('id', hostId)
        .single()

      if (hostError || !hostData) {
        setLoading(false)
        return
      }

      setHost(hostData)

      // Fetch host's listings with cover photos
      const { data: listingsData } = await supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type')
        .eq('host_id', hostId)

      if (listingsData) {
        // Fetch cover photos
        const { data: photosData } = await supabase
          .from('listing_photos')
          .select('listing_id, photo_url')
          .eq('is_cover', true)
          .in('listing_id', listingsData.map(l => l.id))

        const photoMap = new Map(photosData?.map(p => [p.listing_id, p.photo_url]) || [])
        
        const listingsWithPhotos = listingsData.map(listing => ({
          ...listing,
          cover_photo_url: photoMap.get(listing.id) || null
        }))
        
        setListings(listingsWithPhotos)
      }

      // Fetch reviews for this host
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('host_id', hostId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

      if (reviewsData) {
        setReviews(reviewsData)
      }

      setLoading(false)
    }

    if (hostId) fetchHostData()
  }, [hostId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  if (!host) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5F2] px-4">
        <h1 className="mb-4 text-2xl font-bold text-stone-800">Host not found</h1>
        <Link href="/stays" className="text-[#c76f55] hover:underline">
          Browse all stays
        </Link>
      </div>
    )
  }

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-[#c76f55]">
            JLM Collective
          </Link>
          <Link href="/stays" className="text-sm font-medium text-stone-600 hover:text-stone-900">
            Browse stays
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Host Profile Header */}
        <div className="mb-12 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <div className="mb-6 h-32 w-32 shrink-0 overflow-hidden rounded-full bg-stone-200 sm:mb-0 sm:mr-8">
            {host.profile_photo_url ? (
              <img src={host.profile_photo_url} alt={getPublicName(host)} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#c76f55] to-[#a85a45] text-4xl font-bold text-white">
                {getPublicName(host).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="mb-2 flex flex-col items-center gap-2 sm:flex-row sm:items-center">
              <h1 className="text-3xl font-bold text-stone-900">{getPublicName(host)}</h1>
              {host.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Verified Host
                </span>
              )}
            </div>

            <p className="mb-4 text-stone-500">
              {host.host_type === 'property_manager' ? 'Property Manager' : 
               host.host_type === 'agency' ? 'Rental Agency' : 'Individual Host'}
            </p>

            <div className="mb-4 flex flex-wrap justify-center gap-6 text-sm sm:justify-start">
              <div>
                <span className="font-bold text-stone-900">{listings.length}</span>
                <span className="ml-1 text-stone-500">{listings.length === 1 ? 'listing' : 'listings'}</span>
              </div>
              <div>
                <span className="font-bold text-stone-900">{reviews.length}</span>
                <span className="ml-1 text-stone-500">{reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>
              {averageRating && (
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-bold text-stone-900">{averageRating}</span>
                </div>
              )}
            </div>

            {host.bio && (
              <p className="max-w-2xl text-stone-600">{host.bio}</p>
            )}
          </div>
        </div>

        {/* Host's Listings */}
        <section className="mb-12">
          <h2 className="mb-6 text-xl font-bold text-stone-900">
            {host.name}&apos;s Listings
          </h2>

          {listings.length === 0 ? (
            <p className="text-stone-500">No listings yet.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <Link 
                  key={listing.id} 
                  href={`/listings/${listing.id}`}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-stone-200">
                    {listing.cover_photo_url ? (
                      <img 
                        src={listing.cover_photo_url} 
                        alt={listing.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-bold text-stone-900 group-hover:text-[#c76f55]">
                      {listing.title}
                    </h3>
                    <p className="mb-2 text-sm text-stone-500">{listing.area}</p>
                    <p className="text-sm text-stone-600">
                      {listing.bedrooms} bed · {listing.max_guests} guests
                    </p>
                    <p className="mt-2 font-bold text-stone-900">
                      ₪{listing.price_ils?.toLocaleString()}
                      <span className="ml-1 font-normal text-stone-500">/ night</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-stone-900">
            Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <p className="text-stone-500">No reviews yet.</p>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-stone-900">{review.reviewer_name}</p>
                      {review.stay_date && (
                        <p className="text-sm text-stone-500">
                          Stayed {new Date(review.stay_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg 
                          key={i} 
                          className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500' : 'text-stone-200'}`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.title && (
                    <p className="mb-2 font-semibold text-stone-800">{review.title}</p>
                  )}
                  {review.content && (
                    <p className="text-stone-600">{review.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
