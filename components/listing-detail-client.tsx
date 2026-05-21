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
}

function formatPrice(value?: number | null) {
  return value ? value.toLocaleString() : null
}

function formatListingPrice(listing: Pick<SimilarListing, 'price_ils' | 'price_usd'>) {
  const ils = formatPrice(listing.price_ils)
  const usd = formatPrice(listing.price_usd)

  if (ils && usd) return `₪${ils} / $${usd}`
  if (ils) return `₪${ils}`
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
}: ListingDetailClientProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [showMobileBooking, setShowMobileBooking] = useState(false)
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>({})
  const [guestCount, setGuestCount] = useState(1)
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null)
  const [showQuickQuestion, setShowQuickQuestion] = useState(false)
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
    <div className="min-h-screen bg-[#F8F5F2]">
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

      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 lg:pb-8">
        {fromStays && (
          <Link href="/stays" className="mb-4 inline-flex text-sm font-medium text-stone-500 transition hover:text-stone-900">
            &larr; Back to search
          </Link>
        )}

        <div className="mb-5 flex items-center justify-between gap-3">
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

        <section className="mb-8">
          {photos.length > 0 ? (
            <div className="relative mb-6 overflow-hidden rounded-3xl">
              <div
                className="relative aspect-[4/3] overflow-hidden md:hidden"
                onTouchStart={(event) => handleMobilePhotoDragStart(event.touches[0])}
                onTouchEnd={(event) => handleMobilePhotoDragEnd(event.changedTouches[0])}
                onMouseDown={(event) => handleMobilePhotoDragStart(event)}
                onMouseUp={(event) => handleMobilePhotoDragEnd(event)}
              >
                {currentMobilePhoto && (
                  <button
                    type="button"
                    className="block h-full w-full cursor-grab active:cursor-grabbing"
                    onClick={handleMobilePhotoClick}
                  >
                    <Image
                      src={currentMobilePhoto.photo_url}
                      alt={`${listing.title} photo ${mobilePhotoIndex + 1}`}
                      fill
                      className="object-cover"
                      priority={mobilePhotoIndex === 0}
                      loading={mobilePhotoIndex === 0 ? undefined : 'lazy'}
                      sizes="100vw"
                    />
                  </button>
                )}

                {photos.length > 1 && (
                  <>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-3 py-2">
                      {photos.slice(0, 8).map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => goToMobilePhoto(index)}
                          aria-label={`Show photo ${index + 1}`}
                          className={`h-1.5 rounded-full transition ${
                            index === mobilePhotoIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGalleryIndex(mobilePhotoIndex)
                        setShowGallery(true)
                      }}
                      className="absolute bottom-4 right-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      {mobilePhotoIndex + 1} / {photos.length}
                    </button>
                  </>
                )}
              </div>

              <div className="hidden grid-cols-1 gap-2 md:grid md:grid-cols-[2fr_1fr]">
                <div
                  className="relative aspect-[4/3] cursor-pointer overflow-hidden"
                  onClick={() => {
                    setGalleryIndex(0)
                    setShowGallery(true)
                  }}
                >
                  <Image
                    src={photos[0]?.photo_url || ''}
                    alt={listing.title}
                    fill
                    className="object-cover transition hover:scale-105"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 800px"
                  />
                </div>

                <div className="hidden gap-2 md:grid md:grid-rows-2">
                  {photos.slice(1, 3).map((photo, index) => (
                    <div
                      key={photo.id}
                      className="relative cursor-pointer overflow-hidden"
                      onClick={() => {
                        setGalleryIndex(index + 1)
                        setShowGallery(true)
                      }}
                    >
                      <Image
                        src={photo.photo_url}
                        alt={`${listing.title} photo ${index + 2}`}
                        fill
                        className="object-cover transition hover:scale-105"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {photos.length > 3 && (
                <div className="mt-2 hidden grid-cols-2 gap-2 md:grid">
                  {photos.slice(3, 5).map((photo, index) => (
                    <div
                      key={photo.id}
                      className="relative aspect-[4/3] cursor-pointer overflow-hidden"
                      onClick={() => {
                        setGalleryIndex(index + 3)
                        setShowGallery(true)
                      }}
                    >
                      <Image
                        src={photo.photo_url}
                        alt={`${listing.title} photo ${index + 4}`}
                        fill
                        className="object-cover transition hover:scale-105"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                    </div>
                  ))}
                </div>
              )}

              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setGalleryIndex(0)
                    setShowGallery(true)
                  }}
                  className="absolute bottom-4 right-4 hidden rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 md:block"
                >
                  View all {photos.length} photos
                </button>
              )}
            </div>
          ) : (
            <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300" />
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-6 border-b border-stone-200 pb-6">
              <h1 className="mb-2 text-2xl font-bold text-stone-900">{listing.title}</h1>
              <p className="text-stone-500">{listing.area}, Jerusalem</p>
            </div>

            <div className="mb-6 flex flex-wrap gap-3 border-b border-stone-200 pb-6">
              <Stat label="Bedrooms" value={listing.bedrooms || '-'} />
              <Stat label="Bathrooms" value={listing.bathrooms || '-'} />
              <Stat label="Max Guests" value={listing.max_guests || '-'} />
              {averageRating && (
                <div className="flex items-center gap-2 rounded-xl bg-[#F8F5F2] px-4 py-2.5">
                  <StarIcon className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-lg font-bold text-stone-900">{averageRating}</p>
                    <p className="text-[10px] text-stone-500">{reviews.length} reviews</p>
                  </div>
                </div>
              )}
            </div>

            {listing.description && (
              <div className="mb-6 border-b border-stone-200 pb-6">
                <h2 className="mb-3 text-lg font-bold text-stone-900">About this stay</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{listing.description}</p>
              </div>
            )}

            {listing.house_rules?.trim() && (
              <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-stone-950">House rules</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                  {listing.house_rules}
                </p>
              </section>
            )}

            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-6 border-b border-stone-200 pb-6">
                <h2 className="mb-3 text-lg font-bold text-stone-900">Amenities</h2>
                <AmenityDisplay amenities={listing.amenities} />
              </div>
            )}

            {listing.host_id && (
              <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
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
              </section>
            )}

            <AvailabilityCalendar blockedRanges={blockedRanges} />

            <div>
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
          </div>

          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
              <Pricing priceIls={priceIls} priceUsd={priceUsd} />
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
                showQuickQuestion={showQuickQuestion}
                setShowQuickQuestion={setShowQuickQuestion}
                onConversationCreated={setExistingConversationId}
              />
              <HostCard host={host} publicHostName={publicHostName} />
            </div>
          </div>
        </div>

        {similarListings.length > 0 && (
          <section className="mt-10">
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
                    {similarListing.bedrooms || 0} bedrooms · sleeps {similarListing.max_guests || 0}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-stone-900">
                    {formatListingPrice(similarListing)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white p-4 shadow-lg lg:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-stone-900">
              {priceIls ? `₪${priceIls}` : 'Price on request'}
              {priceIls && <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>}
            </p>
            {priceUsd && <p className="text-xs text-stone-500">~${priceUsd} USD</p>}
          </div>
          <button
            type="button"
            onClick={() => setShowMobileBooking(true)}
            className="rounded-xl bg-[#c76f55] px-6 py-3 font-semibold text-white transition hover:bg-[#b55f47]"
          >
            Request to book
          </button>
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
                showQuickQuestion={showQuickQuestion}
                setShowQuickQuestion={setShowQuickQuestion}
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
        {priceIls ? `₪${priceIls}` : 'Price on request'}
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
  showQuickQuestion,
  setShowQuickQuestion,
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
  showQuickQuestion: boolean
  setShowQuickQuestion: (value: boolean) => void
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
                    ? `₪${totalILS.toLocaleString()}`
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
            buttonLabel="Request to book"
            buttonClassName={`${mobile ? 'flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-4' : 'mb-3 flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-3.5'} font-semibold text-white transition hover:bg-[#b55f47]`}
            onConversationCreated={onConversationCreated}
          />
        )}
        {!existingConversationId && (
          <>
            <button
              type="button"
              onClick={() => setShowQuickQuestion(true)}
              className="mt-2 w-full rounded-full border border-stone-200 px-6 py-3 text-sm font-semibold text-stone-700 transition hover:border-[#c76f55] hover:text-[#c76f55]"
            >
              Ask a quick question
            </button>
            <MessageHostDialog
              listingId={listing.id}
              listingTitle={listing.title}
              hostId={listing.host_id}
              quickQuestion
              open={showQuickQuestion}
              onOpenChange={setShowQuickQuestion}
              onConversationCreated={onConversationCreated}
            />
          </>
        )}
        {!mobile && <p className="mb-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>}
        <div className={`${mobile ? 'space-y-3' : 'space-y-2 border-t border-stone-100 pt-4'}`}>
          <MessageHostDialog
            listingId={listing.id}
            listingTitle={listing.title}
            hostId={listing.host_id}
            dateRange={dateRange}
            guests={guestCount}
            onConversationCreated={onConversationCreated}
          />
          <button className={`${mobile ? 'py-4 font-semibold' : 'py-3 text-sm font-semibold'} flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300 hover:bg-stone-50`}>
            <MoneyIcon className={mobile ? 'h-5 w-5' : 'h-4 w-4'} />
            Reserve with deposit
          </button>
        </div>
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-5 py-4">
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
        className="relative flex flex-1 items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
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
          className="max-h-full max-w-full object-contain"
        />

        <button
          type="button"
          onClick={next}
          className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          aria-label="Next photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 py-4">
        {photos.map((photo, thumbIndex) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => onIndexChange(thumbIndex)}
            className={`shrink-0 overflow-hidden rounded-lg transition ${
              thumbIndex === index
                ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                : 'opacity-50 hover:opacity-80'
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
