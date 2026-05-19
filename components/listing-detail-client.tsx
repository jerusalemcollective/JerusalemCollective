'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AvailabilityCalendar } from '@/components/availability-calendar'
import { BookingDateRangePicker } from '@/components/booking-date-range-picker'
import { MessageHostDialog } from '@/components/message-host-dialog'
import { SaveListingButton } from '@/components/save-listing-button'
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
}

export type ListingDetailPhoto = {
  id: string
  photo_url: string
  is_cover: boolean | null
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

type ListingDetailClientProps = {
  listing: ListingDetailListing
  host: ListingDetailHost | null
  publicHostName: string | null
  photos: ListingDetailPhoto[]
  reviews: ListingDetailReview[]
  blockedRanges: ListingBlockedRange[]
  fromStays: boolean
}

function formatPrice(value?: number | null) {
  return value ? value.toLocaleString() : null
}

export function ListingDetailClient({
  listing,
  host,
  publicHostName,
  photos,
  reviews,
  blockedRanges,
  fromStays,
}: ListingDetailClientProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [showGallery, setShowGallery] = useState(false)
  const [showMobileBooking, setShowMobileBooking] = useState(false)
  const [bookingDateRange, setBookingDateRange] = useState<DateRange>({})
  const [guestCount, setGuestCount] = useState(1)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void recordListingEngagement(supabase, listing.id, 'view')

    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [listing.id])

  useEffect(() => {
    if (!showGallery || photos.length === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowGallery(false)
      }

      if (event.key === 'ArrowLeft') {
        setSelectedPhoto((previous) => (previous > 0 ? previous - 1 : photos.length - 1))
      }

      if (event.key === 'ArrowRight') {
        setSelectedPhoto((previous) => (previous < photos.length - 1 ? previous + 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photos.length, showGallery])

  const handleCopyListingLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)

    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }

    copyTimeoutRef.current = setTimeout(() => setCopiedLink(false), 2000)
  }

  const coverPhoto = photos.find((photo) => photo.is_cover) || photos[0]
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : null
  const maxGuests = listing.max_guests || 6
  const priceIls = formatPrice(listing.price_ils)
  const priceUsd = formatPrice(listing.price_usd)

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
          <button
            type="button"
            onClick={handleCopyListingLink}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <Link2 className="h-4 w-4" />
            {copiedLink ? 'Copied!' : 'Copy link'}
          </button>
          <SaveListingButton listingId={listing.id} />
        </div>

        <section className="mb-8">
          {photos.length > 0 ? (
            <div className="relative grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
              <button
                type="button"
                className="relative cursor-pointer overflow-hidden rounded-2xl sm:col-span-2 sm:row-span-2"
                onClick={() => {
                  setSelectedPhoto(0)
                  setShowGallery(true)
                }}
              >
                <div className="aspect-[4/3] sm:aspect-auto sm:h-full">
                  <img
                    src={coverPhoto?.photo_url}
                    alt={listing.title}
                    className="h-full w-full object-cover transition hover:scale-105"
                  />
                </div>
              </button>

              {photos.slice(1, 5).map((photo, index) => (
                <button
                  type="button"
                  key={photo.id}
                  className="relative hidden cursor-pointer overflow-hidden rounded-2xl sm:block"
                  onClick={() => {
                    setSelectedPhoto(index + 1)
                    setShowGallery(true)
                  }}
                >
                  <div className="aspect-[4/3]">
                    <img
                      src={photo.photo_url}
                      alt={`${listing.title} - Photo ${index + 2}`}
                      className="h-full w-full object-cover transition hover:scale-105"
                    />
                  </div>
                  {index === 3 && photos.length > 5 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                      <span className="text-lg font-bold">+{photos.length - 5} more</span>
                    </div>
                  )}
                </button>
              ))}

              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowGallery(true)}
                  className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-md transition hover:bg-stone-50 sm:hidden"
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

            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-6 border-b border-stone-200 pb-6">
                <h2 className="mb-3 text-lg font-bold text-stone-900">Amenities</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {listing.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 text-sm text-stone-600">
                      <CheckIcon />
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AvailabilityCalendar blockedRanges={blockedRanges} />

            <div>
              <h2 className="mb-3 text-lg font-bold text-stone-900">Reviews ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-stone-500">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-xl bg-[#F8F5F2] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-stone-900">{review.reviewer_name}</p>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, index) => (
                            <StarIcon
                              key={index}
                              className={`h-3.5 w-3.5 ${index < review.rating ? 'text-yellow-500' : 'text-stone-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.content && <p className="text-sm text-stone-600">{review.content}</p>}
                    </div>
                  ))}
                </div>
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
              />
              <HostCard host={host} publicHostName={publicHostName} />
            </div>
          </div>
        </div>
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
                mobile
              />
              <p className="mt-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>
            </div>
          </div>
        </div>
      )}

      {showGallery && photos.length > 0 && (
        <Gallery
          photos={photos}
          listingTitle={listing.title}
          selectedPhoto={selectedPhoto}
          setSelectedPhoto={setSelectedPhoto}
          onClose={() => setShowGallery(false)}
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

function BookingControls({
  listing,
  dateRange,
  setDateRange,
  guestCount,
  setGuestCount,
  maxGuests,
  mobile = false,
}: {
  listing: ListingDetailListing
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  guestCount: number
  setGuestCount: (value: number) => void
  maxGuests: number
  mobile?: boolean
}) {
  return (
    <>
      <div className={`${mobile ? 'mb-6' : 'mb-4'} space-y-3`}>
        <BookingDateRangePicker dateRange={dateRange} setDateRange={setDateRange} />
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
        <MessageHostDialog
          listingId={listing.id}
          listingTitle={listing.title}
          hostId={listing.host_id}
          dateRange={dateRange}
          guests={guestCount}
          intent="request"
          buttonLabel="Request to book"
          buttonClassName={`${mobile ? 'flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-4' : 'mb-3 flex w-full items-center justify-center rounded-xl bg-[#c76f55] py-3.5'} font-semibold text-white transition hover:bg-[#b55f47]`}
        />
        {!mobile && <p className="mb-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>}
        <div className={`${mobile ? 'space-y-3' : 'space-y-2 border-t border-stone-100 pt-4'}`}>
          <MessageHostDialog
            listingId={listing.id}
            listingTitle={listing.title}
            hostId={listing.host_id}
            dateRange={dateRange}
            guests={guestCount}
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
            <img src={host.profile_photo_url} alt={publicHostName} className="h-full w-full object-cover" />
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

function Gallery({
  photos,
  listingTitle,
  selectedPhoto,
  setSelectedPhoto,
  onClose,
}: {
  photos: ListingDetailPhoto[]
  listingTitle: string
  selectedPhoto: number
  setSelectedPhoto: (value: number | ((previous: number) => number)) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <CloseIcon />
      </button>
      <button
        type="button"
        onClick={() => setSelectedPhoto((previous) => (previous > 0 ? previous - 1 : photos.length - 1))}
        className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
      >
        <ChevronLeftIcon />
      </button>
      <div className="max-h-[80vh] max-w-[90vw]">
        <img
          src={photos[selectedPhoto]?.photo_url}
          alt={`${listingTitle} - Photo ${selectedPhoto + 1}`}
          className="max-h-[80vh] max-w-[90vw] object-contain"
        />
      </div>
      <button
        type="button"
        onClick={() => setSelectedPhoto((previous) => (previous < photos.length - 1 ? previous + 1 : 0))}
        className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
      >
        <ChevronRightLargeIcon />
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white">
        {selectedPhoto + 1} / {photos.length}
      </div>
      <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2">
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => setSelectedPhoto(index)}
            className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition ${
              selectedPhoto === index ? 'border-white' : 'border-transparent opacity-50 hover:opacity-100'
            }`}
          >
            <img src={photo.photo_url} alt="" className="h-full w-full object-cover" />
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

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-[#c76f55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

function ChevronLeftIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightLargeIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
