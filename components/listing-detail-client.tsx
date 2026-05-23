'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AvailabilityCalendar } from '@/components/availability-calendar'
import { BookingDateRangePicker } from '@/components/booking-date-range-picker'
import { MessageHostDialog } from '@/components/message-host-dialog'
import { SaveListingButton } from '@/components/save-listing-button'
import { AmenityDisplay } from '@/components/amenity-display'
import { recordListingView } from '@/components/recently-viewed'
import { recordListingEngagement } from '@/lib/listing-engagement'

type DateRange = {
  from?: Date
  to?: Date
}

export type ListingDetailListing = {
  id: string
  host_id: string | null
  title: string
  area: string
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  booking_type: string
  amenities: string[] | null
  description: string | null
  house_rules: string | null
}

export type ListingDetailPhoto = {
  id: string
  photo_url: string
  is_cover: boolean | null
}

type PointerLikeEvent = {
  clientX: number
}

export type ListingDetailHost = {
  id: string
  is_verified: boolean | null
  profile_photo_url: string | null
}

export type ListingDetailReview = {
  id: string
  reviewer_name: string
  rating: number
  content: string | null
}

export type ListingBlockedRange = {
  start_date: string
  end_date: string
}

type SimilarListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
}

type ListingDetailClientProps = {
  listing: ListingDetailListing
  host: ListingDetailHost | null
  publicHostName: string | null
  photos: ListingDetailPhoto[]
  reviews: ListingDetailReview[]
  blockedRanges: ListingBlockedRange[]
  similarListings: SimilarListing[]
  fromStays: boolean
  neighbourhoodDescription: string | null
}

function formatPrice(value?: number | null) {
  return value ? value.toLocaleString() : null
}

function formatListingPrice(listing: Pick<SimilarListing, 'price_ils' | 'price_usd'>) {
  const ils = formatPrice(listing.price_ils)
  const usd = formatPrice(listing.price_usd)

  if (ils && usd) return `\u20aa${ils} / $${usd}`
  if (ils) return `\u20aa${ils}`
  if (usd) return `$${usd}`
  return 'Price on request'
}

export function ListingDetailClient({
  listing,
  host,
  publicHostName,
  photos,
  reviews,
  blockedRanges,
  similarListings,
  fromStays,
  neighbourhoodDescription,
}: ListingDetailClientProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [showMobileBooking, setShowMobileBooking] = useState(false)
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>({})
  const [guestCount, setGuestCount] = useState(1)
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobilePhotoDragStartRef = useRef<number | null>(null)
  const mobilePhotoDidSwipeRef = useRef(false)
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const nights =
    bookingDateRange.from && bookingDateRange.to
      ? Math.round(
          (bookingDateRange.to.getTime() - bookingDateRange.from.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0
  const totalILS =
    nights > 0 && listing.price_ils
      ? nights * listing.price_ils
      : null
  const totalUSD =
    nights > 0 && listing.price_usd
      ? nights * listing.price_usd
      : null

  useEffect(() => {
    const supabase = createClient()
    let isActive = true
    void recordListingEngagement(supabase, listing.id, 'view')
    recordListingView({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      coverPhotoUrl: photos[0]?.photo_url || null,
    })

    const loadExistingConversation = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isActive || !user) return

      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (isActive) {
        setExistingConversationId(existingConv?.id || null)
      }
    }

    void loadExistingConversation()

    return () => {
      isActive = false
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [listing.id])

  const handleCopyListingLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)

    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }

    copyTimeoutRef.current = setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.title,
          text: 'Check out this Jerusalem stay on JLM Collective',
          url: shareUrl,
        })
      } catch {
        // User cancelled share - do nothing
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : null
  const avgRating =
    reviews.length >= 2
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null
  const maxGuests = listing.max_guests || 6
  const priceIls = formatPrice(listing.price_ils)
  const priceUsd = formatPrice(listing.price_usd)
  const currentMobilePhoto = photos[mobilePhotoIndex] ?? photos[0]

  const goToMobilePhoto = (index: number) => {
    if (photos.length === 0) return
    setMobilePhotoIndex((index + photos.length) % photos.length)
  }

  const handleMobilePhotoDragStart = (event: PointerLikeEvent) => {
    mobilePhotoDragStartRef.current = event.clientX
    mobilePhotoDidSwipeRef.current = false
  }

  const handleMobilePhotoDragEnd = (event: PointerLikeEvent) => {
    if (mobilePhotoDragStartRef.current === null || photos.length < 2) return
    const delta = event.clientX - mobilePhotoDragStartRef.current
    if (delta > 40) {
      mobilePhotoDidSwipeRef.current = true
      goToMobilePhoto(mobilePhotoIndex - 1)
    }
    if (delta < -40) {
      mobilePhotoDidSwipeRef.current = true
      goToMobilePhoto(mobilePhotoIndex + 1)
    }
    mobilePhotoDragStartRef.current = null
  }

  const handleMobilePhotoClick = () => {
    if (mobilePhotoDidSwipeRef.current) {
      mobilePhotoDidSwipeRef.current = false
      return
    }
    setGalleryIndex(mobilePhotoIndex)
    setShowGallery(true)
  }

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
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

      <main className="pb-28 lg:pb-8">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        {fromStays && (
          <Link href="/stays" className="mb-4 inline-flex text-sm font-medium text-stone-500 transition hover:text-stone-900">
            &larr; Back to search
          </Link>
        )}

        <div className="mb-5 flex items-center justify-end">
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyListingLink}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                <Link2 className="h-4 w-4" />
                {copiedLink ? 'Copied!' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300"
                aria-label="Share listing"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Share
              </button>
            </div>
            <SaveListingButton listingId={listing.id} />
          </div>
        </div>

        <div className="relative mb-0 overflow-hidden rounded-3xl md:rounded-none lg:rounded-xl">
          {photos.length > 0 ? (
            <>
              <div className="relative md:hidden">
                <div
                  className="relative aspect-[4/3] overflow-hidden bg-stone-100"
                  onTouchStart={(event) => handleMobilePhotoDragStart(event.touches[0])}
                  onTouchEnd={(event) => handleMobilePhotoDragEnd(event.changedTouches[0])}
                  onMouseDown={(event) => handleMobilePhotoDragStart(event)}
                  onMouseUp={(event) => handleMobilePhotoDragEnd(event)}
                  onClick={handleMobilePhotoClick}
                >
                  {photos[mobilePhotoIndex] && (
                    <Image
                      src={photos[mobilePhotoIndex].photo_url}
                      alt={listing.title}
                      fill
                      className="object-cover"
                      priority
                      sizes="100vw"
                    />
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {photos.slice(0, 5).map((photo, i) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setMobilePhotoIndex(i)
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                          i === mobilePhotoIndex
                            ? 'w-4 bg-white'
                            : 'w-1.5 bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden md:grid md:grid-cols-2 md:gap-2">
                <div
                  className="relative aspect-[4/3] cursor-pointer overflow-hidden bg-stone-100"
                  onClick={() => {
                    setGalleryIndex(0)
                    setShowGallery(true)
                  }}
                >
                  {photos[0] && (
                    <Image
                      src={photos[0].photo_url}
                      alt={listing.title}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-[1.02]"
                      priority
                      sizes="50vw"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className="relative aspect-square cursor-pointer overflow-hidden bg-stone-100"
                      onClick={() => {
                        setGalleryIndex(index)
                        setShowGallery(true)
                      }}
                    >
                      {photos[index] ? (
                        <Image
                          src={photos[index].photo_url}
                          alt={`${listing.title} photo ${index + 1}`}
                          fill
                          className="object-cover transition-transform duration-300 hover:scale-[1.02]"
                          loading="lazy"
                          sizes="25vw"
                        />
                      ) : (
                        <div className="h-full w-full bg-stone-100" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setGalleryIndex(0)
                    setShowGallery(true)
                  }}
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-stone-50 hover:shadow-md"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                  Show all {photos.length} photos
                </button>
              )}
            </>
          ) : (
            <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300" />
          )}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[#c76f55]">
                {listing.area}, Jerusalem
              </p>
              <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
                {listing.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                {listing.bedrooms !== null && (
                  <span>
                    {listing.bedrooms} bedroom{listing.bedrooms !== 1 ? 's' : ''}
                  </span>
                )}
                {listing.bathrooms !== null && (
                  <span>
                    {listing.bathrooms} bathroom{listing.bathrooms !== 1 ? 's' : ''}
                  </span>
                )}
                {listing.max_guests !== null && (
                  <span>Sleeps {listing.max_guests}</span>
                )}
              </div>
            </div>

            {listing.description && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <h2 className="mb-3 text-lg font-bold text-stone-900">About this stay</h2>
                  <p className="whitespace-pre-line text-base leading-8 text-stone-700">{listing.description}</p>
                </div>
              </>
            )}

            {listing.house_rules?.trim() && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <h2 className="text-lg font-bold text-stone-950">House rules</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                    {listing.house_rules}
                  </p>
                </div>
              </>
            )}

            {listing.amenities && listing.amenities.length > 0 && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <h2 className="mb-3 text-lg font-bold text-stone-900">Amenities</h2>
                  <AmenityDisplay amenities={listing.amenities} />
                </div>
              </>
            )}

            {listing.area && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-display text-xl font-bold text-stone-950">
                      About {listing.area}
                    </h2>
                    <Link
                      href={`/neighbourhoods/${listing.area
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '')}`}
                      className="shrink-0 text-sm font-semibold text-[#c76f55] hover:underline"
                    >
                      Explore {listing.area} →
                    </Link>
                  </div>
                  {neighbourhoodDescription ? (
                    <p className="mt-3 text-base leading-8 text-stone-600">
                      {neighbourhoodDescription}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-stone-500">
                      {listing.area} is one of Jerusalem&apos;s most sought-after neighbourhoods for short-term stays.
                    </p>
                  )}
                </div>
              </>
            )}

            {listing.host_id && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <h2 className="text-lg font-bold text-stone-950">Enhance your stay</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Arranged by JLM Collective and delivered to this property.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/services/catering"
                      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-4 transition hover:border-[#c76f55] hover:bg-white"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c76f55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                        <path d="M7 2v20" />
                        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-stone-950">Catering & meals</p>
                        <p className="text-xs text-stone-500">Shabbat packages, custom menus</p>
                      </div>
                    </Link>

                    <Link
                      href="/services/cleaning"
                      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-4 transition hover:border-[#c76f55] hover:bg-white"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c76f55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-stone-950">Housekeeping</p>
                        <p className="text-xs text-stone-500">Mid-stay cleaning arranged</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </>
            )}

            <hr className="border-stone-100" />
            <div className="py-8">
              <AvailabilityCalendar blockedRanges={blockedRanges} />
            </div>

            <hr className="border-stone-100" />
            <div className="py-8">
              <h2 className="mb-3 text-lg font-bold text-stone-900">Reviews ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-stone-500">No reviews yet.</p>
              ) : (
                <>
                  {avgRating !== null && (
                    <div className="mb-6 flex items-center gap-3">
                      <StarRating rating={Math.round(avgRating)} />
                      <span className="text-sm font-bold text-stone-950">{avgRating.toFixed(1)}</span>
                      <span className="text-sm text-stone-500">
                        ({reviews.length} review{reviews.length === 1 ? '' : 's'})
                      </span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <div key={review.id} className="rounded-xl bg-[#F8F5F2] p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-stone-900">{review.reviewer_name}</p>
                          <StarRating rating={review.rating} />
                        </div>
                        {review.content && <p className="text-sm text-stone-600">{review.content}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {similarListings.length > 0 && (
              <>
                <hr className="border-stone-100" />
                <div className="py-8">
                  <h2 className="mb-4 text-xl font-bold text-stone-950">You might also like</h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    {similarListings.map((similarListing) => (
                      <Link
                        key={similarListing.id}
                        href={`/listings/${similarListing.id}?from=stays`}
                        className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                          {similarListing.area}
                        </p>
                        <h3 className="mt-2 font-bold text-stone-950">{similarListing.title}</h3>
                        <p className="mt-2 text-sm text-stone-600">
                          {similarListing.bedrooms || 0} bedrooms \u00b7 sleeps {similarListing.max_guests || 0}
                        </p>
                        <p className="mt-4 text-sm font-semibold text-stone-900">
                          {formatListingPrice(similarListing)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="hidden lg:block">
            <div className="lg:sticky lg:top-8">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-lg">
                <div className="mb-5 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-stone-950">
                    {listing.price_usd
                      ? `$${Number(listing.price_usd).toLocaleString()}`
                      : listing.price_ils
                        ? `\u20aa${Number(listing.price_ils).toLocaleString()}`
                        : 'Price on request'}
                  </span>
                  {(listing.price_usd || listing.price_ils) && (
                    <span className="text-sm text-stone-500">/ night</span>
                  )}
                </div>
                <BookingControls
                  listing={listing}
                  dateRange={bookingDateRange}
                  setDateRange={setBookingDateRange}
                  guestCount={guestCount}
                  setGuestCount={setGuestCount}
                  maxGuests={maxGuests}
                  nights={nights}
                  totalILS={totalILS}
                  totalUSD={totalUSD}
                  existingConversationId={existingConversationId}
                  onConversationCreated={setExistingConversationId}
                />
                <div className="mt-4 space-y-2.5 border-t border-stone-100 pt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    How it works
                  </p>
                  {[
                    'Send your message — free, no commitment',
                    'Host replies — usually within a few hours',
                    'Confirm together — agree details before any payment',
                  ].map((step, index) => (
                    <div key={step} className="flex items-start gap-2.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-600">
                        {index + 1}
                      </span>
                      <p className="text-xs leading-5 text-stone-600">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-5">
                  {[
                    'Personally reviewed by JLM Collective',
                    'All hosts are identity verified',
                    'Support available throughout your stay',
                  ].map((point) => (
                    <div key={point} className="flex items-center gap-2.5">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#c76f55"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <p className="text-xs text-stone-600">{point}</p>
                    </div>
                  ))}
                </div>
                <HostCard host={host} publicHostName={publicHostName} />
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white px-5 py-4 shadow-lg md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-stone-950">
              {listing.price_usd
                ? `$${Number(listing.price_usd).toLocaleString()}`
                : listing.price_ils
                  ? `\u20aa${Number(listing.price_ils).toLocaleString()}`
                  : 'Price on request'}
            </p>
            {(listing.price_usd || listing.price_ils) && (
              <p className="text-xs text-stone-500">per night</p>
            )}
          </div>
          {existingConversationId ? (
            <Link
              href={`/account/messages?conversation=${existingConversationId}`}
              className="flex-1 rounded-full bg-[#c76f55] px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-[#b85f47]"
            >
              Continue conversation
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowMobileBooking(true)}
              className="flex-1 rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
            >
              Message host
            </button>
          )}
        </div>
      </div>

      {showMobileBooking && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close booking panel"
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileBooking(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white">
            <div className="sticky top-0 flex justify-center bg-white py-3">
              <div className="h-1 w-12 rounded-full bg-stone-300" />
            </div>
            <div className="px-6 pb-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900">Book this stay</h3>
                <button
                  type="button"
                  onClick={() => setShowMobileBooking(false)}
                  className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="mb-6 rounded-xl bg-[#F8F5F2] p-4">
                <Pricing priceIls={priceIls} priceUsd={priceUsd} />
              </div>
              <BookingControls
                listing={listing}
                dateRange={bookingDateRange}
                setDateRange={setBookingDateRange}
                guestCount={guestCount}
                setGuestCount={setGuestCount}
                maxGuests={maxGuests}
                nights={nights}
                totalILS={totalILS}
                totalUSD={totalUSD}
                existingConversationId={existingConversationId}
                onConversationCreated={setExistingConversationId}
                mobile
              />
              <p className="mt-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>
            </div>
          </div>
        </div>
      )}

      {showGallery && photos.length > 0 && (
        <GalleryOverlay
          photos={photos}
          index={galleryIndex}
          title={listing.title}
          onClose={() => setShowGallery(false)}
          onIndexChange={setGalleryIndex}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#F8F5F2] px-4 py-2.5">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-lg font-bold text-stone-900">{value}</p>
    </div>
  )
}

function Pricing({ priceIls, priceUsd }: { priceIls: string | null; priceUsd: string | null }) {
  return (
    <div className="mb-6">
      <p className="text-2xl font-bold text-stone-900">
        {priceIls ? `\u20aa${priceIls}` : 'Price on request'}
        {priceIls && <span className="ml-1 text-base font-normal text-stone-500">/ night</span>}
      </p>
      {priceUsd && <p className="text-sm text-stone-500">~${priceUsd} USD / night</p>}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={index < rating ? '#c76f55' : '#e7e5e4'}
          stroke="none"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function BookingControls({
  listing,
  dateRange,
  setDateRange,
  guestCount,
  setGuestCount,
  maxGuests,
  nights,
  totalILS,
  totalUSD,
  existingConversationId,
  onConversationCreated,
  mobile = false,
}: {
  listing: ListingDetailListing
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  guestCount: number
  setGuestCount: (value: number) => void
  maxGuests: number
  nights: number
  totalILS: number | null
  totalUSD: number | null
  existingConversationId: string | null
  onConversationCreated: (conversationId: string) => void
  mobile?: boolean
}) {
  return (
    <>
      <div className={`${mobile ? 'mb-6' : 'mb-4'} space-y-3`}>
        <BookingDateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
        {nights > 0 && (
          <div className="mt-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-stone-600">
                {nights} night{nights === 1 ? '' : 's'}
              </p>
              <p className="text-sm font-bold text-stone-950">
                {[
                  totalILS
                    ? `\u20aa${totalILS.toLocaleString()}`
                    : null,
                  totalUSD
                    ? `$${totalUSD.toLocaleString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' / ') || 'Price on request'}
              </p>
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-stone-500">Guests</label>
          <select
            value={guestCount}
            onChange={(event) => setGuestCount(Number(event.target.value))}
            className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-stone-900 focus:outline-none focus:ring-0"
          >
            {[...Array(maxGuests)].map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1} guest{index > 0 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={mobile ? 'space-y-3' : ''}>
        {existingConversationId ? (
          <Link
            href={`/account/messages?conversation=${existingConversationId}`}
            className={`${mobile ? 'flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-4' : 'mb-3 flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-3.5'} gap-2 font-semibold text-white transition hover:bg-[#b55f47]`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Continue conversation
          </Link>
        ) : (
          <MessageHostDialog
            listingId={listing.id}
            listingTitle={listing.title}
            hostId={listing.host_id}
            dateRange={dateRange}
            guests={guestCount}
            intent="request"
            buttonLabel="Message host"
            buttonClassName="w-full rounded-full bg-[#c76f55] px-6 py-4 text-base font-bold text-white transition hover:bg-[#b85f47]"
            onConversationCreated={onConversationCreated}
          />
        )}
        {!mobile && <p className="mb-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>}
      </div>
    </>
  )
}

function HostCard({
  host,
  publicHostName,
}: {
  host: ListingDetailHost | null
  publicHostName: string | null
}) {
  if (!host || !publicHostName) return null

  return (
    <div className="mt-6 border-t border-stone-100 pt-6">
      <Link href={`/hosts/${host.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-stone-50">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-200">
          {host.profile_photo_url ? (
            <Image src={host.profile_photo_url} alt={publicHostName} width={48} height={48} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#c76f55] to-[#a85a45] text-lg font-bold text-white">
              {publicHostName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-stone-900">Hosted by {publicHostName}</p>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            {host.is_verified && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircleIcon />
                Verified host
              </span>
            )}
          </div>
        </div>
        <ChevronRightIcon />
      </Link>
    </div>
  )
}

type GalleryOverlayProps = {
  photos: ListingDetailPhoto[]
  index: number
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

function GalleryOverlay({ photos, index, title, onClose, onIndexChange }: GalleryOverlayProps) {
  const total = photos.length
  const currentPhoto = photos[index] ?? photos[0]
  const touchStartX = useRef<number | null>(null)
  const prev = useCallback(() => {
    if (total === 0) return
    onIndexChange((index - 1 + total) % total)
  }, [index, onIndexChange, total])
  const next = useCallback(() => {
    if (total === 0) return
    onIndexChange((index + 1) % total)
  }, [index, onIndexChange, total])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') prev()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, onClose, prev])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    if (delta > 50) prev()
    else if (delta < -50) next()
    touchStartX.current = null
  }

  if (!currentPhoto) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]">
      <div className="flex items-center justify-between bg-[#1a1a1a] px-6 py-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">{index + 1} / {total}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close gallery"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-16 py-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 z-10 rounded-full p-3 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Previous photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <img
          key={currentPhoto.id}
          src={currentPhoto.photo_url}
          alt={`${title} - photo ${index + 1}`}
          loading="lazy"
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />

        <button
          type="button"
          onClick={next}
          className="absolute right-4 z-10 rounded-full p-3 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Next photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto bg-black/40 px-6 py-4">
        {photos.map((photo, thumbIndex) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => onIndexChange(thumbIndex)}
            className={`shrink-0 overflow-hidden rounded-lg transition ${
              thumbIndex === index
                ? 'opacity-100 ring-2 ring-white'
                : 'opacity-40 hover:opacity-70'
            }`}
          >
            <Image
              src={photo.photo_url}
              alt=""
              width={96}
              height={64}
              loading="lazy"
              className="h-16 w-24 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function StarIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function MoneyIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
