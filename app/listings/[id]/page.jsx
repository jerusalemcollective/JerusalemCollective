'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DayPicker } from 'react-day-picker'
import { format, addDays } from 'date-fns'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { getSampleListing } from '@/lib/sample-listings'
import { MessageHostDialog } from '@/components/message-host-dialog'
import { SaveListingButton } from '@/components/save-listing-button'
import { recordListingEngagement } from '@/lib/listing-engagement'
import { formatHebrewMonthSpan, formatHebrewShortDate } from '@/lib/hebrew-date'
import 'react-day-picker/dist/style.css'

// Helper to get the public display name for a host
function getPublicName(host) {
  if (host.show_full_name) {
    return host.name
  }
  return host.display_name || host.name.split(' ')[0]
}

function BookingDateRangePicker({ dateRange, setDateRange }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef(null)

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={calendarRef}>
      {/* Date Display - Click to open calendar */}
      <button
        type="button"
        onClick={() => setShowCalendar(!showCalendar)}
        className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300"
      >
        <div className="grid grid-cols-2">
          <div className="border-r border-stone-100 p-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Check-in</p>
            <p className="mt-1 text-sm font-bold text-stone-950">
              {dateRange.from ? format(dateRange.from, 'EEE, d MMM') : 'Choose date'}
            </p>
            {dateRange.from && (
              <p className="mt-1 text-[11px] font-medium text-stone-500">
                {formatHebrewShortDate(dateRange.from)}
              </p>
            )}
          </div>
          <div className="p-4 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Check-out</p>
            <p className="mt-1 text-sm font-bold text-stone-950">
              {dateRange.to ? format(dateRange.to, 'EEE, d MMM') : 'Choose date'}
            </p>
            {dateRange.to && (
              <p className="mt-1 text-[11px] font-medium text-stone-500">
                {formatHebrewShortDate(dateRange.to)}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Calendar Dropdown */}
      {showCalendar && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-3xl bg-[#faf8f6] shadow-lg shadow-stone-200/50">
          <style>{`
            .booking-lux-calendar .rdp {
              margin: 0;
            }
            .booking-lux-calendar .rdp-caption {
              margin-bottom: 8px;
              padding: 0;
            }
            .booking-lux-calendar .rdp-caption_label {
              color: #44403c;
              font-size: 14px;
              font-weight: 600;
              letter-spacing: -0.01em;
            }
            .booking-lux-calendar .rdp-nav_button {
              align-items: center;
              background: transparent;
              border: none;
              border-radius: 50%;
              color: #a8a29e;
              display: inline-flex;
              height: 28px;
              justify-content: center;
              width: 28px;
              transition: color 150ms ease;
            }
            .booking-lux-calendar .rdp-nav_button:hover {
              background: transparent;
              color: #c76f55;
            }
            .booking-lux-calendar .rdp-table {
              width: 100%;
              border-spacing: 2px;
            }
            .booking-lux-calendar .rdp-head_cell {
              color: #a8a29e;
              font-size: 9px;
              font-weight: 600;
              padding-bottom: 6px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .booking-lux-calendar .rdp-cell {
              height: 44px;
              padding: 2px;
            }
            .booking-lux-calendar .rdp-button {
              border-radius: 50%;
              color: #57534e;
              font-size: 13px;
              font-weight: 500;
              height: 40px;
              width: 40px;
              transition: background-color 120ms ease, color 120ms ease;
            }
            .booking-lux-calendar .rdp-button span:last-child {
              font-size: 9px;
              line-height: 1;
              opacity: 0.62;
            }
            .booking-lux-calendar .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
              background: #f5f0eb;
              color: #78716c;
            }
            .booking-lux-calendar .rdp-day_selected:not([disabled]) {
              background-color: #c76f55;
              color: white;
              font-weight: 600;
            }
            .booking-lux-calendar .rdp-day_selected:hover:not([disabled]) {
              background-color: #b8624a;
            }
            .booking-lux-calendar .rdp-day_range_middle {
              background-color: #fdf0ed;
              border-radius: 0;
              color: #b8624a;
            }
            .booking-lux-calendar .rdp-day_disabled {
              color: #d6d3d1;
            }
          `}</style>

          {/* Header with Arrival/Departure display */}
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Arrival</p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">
                  {dateRange.from ? format(dateRange.from, 'EEE, d MMM') : 'Select'}
                </p>
                {dateRange.from && (
                  <p className="mt-1 text-[11px] font-medium text-stone-500">
                    {formatHebrewShortDate(dateRange.from)}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-white px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Departure</p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">
                  {dateRange.to ? format(dateRange.to, 'EEE, d MMM') : 'Select'}
                </p>
                {dateRange.to && (
                  <p className="mt-1 text-[11px] font-medium text-stone-500">
                    {formatHebrewShortDate(dateRange.to)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="booking-lux-calendar mx-4 mb-4 rounded-2xl bg-white p-4">
            <DayPicker
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                // If user clicks the same date twice, reset to just that date
                if (range?.from && range?.to && range.from.getTime() === range.to.getTime()) {
                  setDateRange({ from: range.from, to: undefined })
                  return
                }
                setDateRange(range || { from: undefined, to: undefined })
                // Auto-close when both dates are selected (different dates)
                if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
                  setTimeout(() => setShowCalendar(false), 300)
                }
              }}
              numberOfMonths={1}
              disabled={{ before: new Date() }}
              showOutsideDays={false}
              formatters={{
                formatCaption: (date) =>
                  `${date.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  })} · ${formatHebrewMonthSpan(date)}`,
              }}
            />
          </div>

          {/* Quick actions footer */}
          <div className="flex items-center justify-between px-5 pb-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDateRange({ from: new Date(), to: addDays(new Date(), 7) })
                  setTimeout(() => setShowCalendar(false), 300)
                }}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
              >
                1 week
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateRange({ from: new Date(), to: addDays(new Date(), 14) })
                  setTimeout(() => setShowCalendar(false), 300)
                }}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
              >
                2 weeks
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDateRange({ from: undefined, to: undefined })}
              className="text-xs font-medium text-stone-400 transition hover:text-stone-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListingDetailPage() {
  const params = useParams()
  const listingId = params.id

  const [listing, setListing] = useState(null)
  const [host, setHost] = useState(null)
  const [photos, setPhotos] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [showGallery, setShowGallery] = useState(false)
  const [showMobileBooking, setShowMobileBooking] = useState(false)
  const [bookingDateRange, setBookingDateRange] = useState({ from: undefined, to: undefined })

  useEffect(() => {
    async function fetchListingData() {
      if (!isSupabaseConfigured || !supabase) {
        const sampleListing = getSampleListing(listingId)
        if (sampleListing) {
          setListing(sampleListing)
        }
        setLoading(false)
        return
      }

      // Fetch listing
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single()

      if (listingError || !listingData) {
        const sampleListing = getSampleListing(listingId)
        if (sampleListing) {
          setListing(sampleListing)
        }
        setLoading(false)
        return
      }

      setListing(listingData)
      await recordListingEngagement(supabase, listingId, 'view')

      // Fetch photos ordered by sort_order
      const { data: photosData } = await supabase
        .from('listing_photos')
        .select('*')
        .eq('listing_id', listingId)
        .order('sort_order', { ascending: true })

      if (photosData) {
        setPhotos(photosData)
      }

      // Fetch host if exists
      if (listingData.host_id) {
        const { data: hostData } = await supabase
          .from('hosts')
          .select('*')
          .eq('id', listingData.host_id)
          .single()

        if (hostData) {
          setHost(hostData)
        }
      }

      // Fetch reviews for this listing
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

      if (reviewsData) {
        setReviews(reviewsData)
      }

      setLoading(false)
    }

    if (listingId) fetchListingData()
  }, [listingId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#c76f55]" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5F2] px-4">
        <h1 className="mb-4 text-2xl font-bold text-stone-800">Listing not found</h1>
        <Link href="/stays" className="text-[#c76f55] hover:underline">
          Browse all stays
        </Link>
      </div>
    )
  }

  const coverPhoto = photos.find(p => p.is_cover) || photos[0]
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

      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 lg:pb-8">
        <div className="mb-5 flex justify-end">
          <SaveListingButton listingId={listing.id} />
        </div>
        {/* Photo Gallery */}
        <section className="mb-8">
          {photos.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
              {/* Main photo */}
              <div 
                className="relative cursor-pointer overflow-hidden rounded-2xl sm:col-span-2 sm:row-span-2"
                onClick={() => { setSelectedPhoto(0); setShowGallery(true) }}
              >
                <div className="aspect-[4/3] sm:aspect-auto sm:h-full">
                  <img 
                    src={coverPhoto?.photo_url} 
                    alt={listing.title}
                    className="h-full w-full object-cover transition hover:scale-105"
                  />
                </div>
              </div>
              
              {/* Secondary photos */}
              {photos.slice(1, 5).map((photo, index) => (
                <div 
                  key={photo.id}
                  className="relative hidden cursor-pointer overflow-hidden rounded-2xl sm:block"
                  onClick={() => { setSelectedPhoto(index + 1); setShowGallery(true) }}
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
                </div>
              ))}

              {/* Show all photos button */}
              {photos.length > 1 && (
                <button
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
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Title and Location */}
            <div className="mb-6 border-b border-stone-200 pb-6">
              <h1 className="mb-2 text-2xl font-bold text-stone-900">{listing.title}</h1>
              <p className="text-stone-500">{listing.area}, Jerusalem</p>
            </div>

            {/* Quick Stats */}
            <div className="mb-6 flex flex-wrap gap-3 border-b border-stone-200 pb-6">
              <div className="rounded-xl bg-[#F8F5F2] px-4 py-2.5">
                <p className="text-xs text-stone-500">Bedrooms</p>
                <p className="text-lg font-bold text-stone-900">{listing.bedrooms}</p>
              </div>
              <div className="rounded-xl bg-[#F8F5F2] px-4 py-2.5">
                <p className="text-xs text-stone-500">Bathrooms</p>
                <p className="text-lg font-bold text-stone-900">{listing.bathrooms || '-'}</p>
              </div>
              <div className="rounded-xl bg-[#F8F5F2] px-4 py-2.5">
                <p className="text-xs text-stone-500">Max Guests</p>
                <p className="text-lg font-bold text-stone-900">{listing.max_guests}</p>
              </div>
              {averageRating && (
                <div className="flex items-center gap-2 rounded-xl bg-[#F8F5F2] px-4 py-2.5">
                  <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div>
                    <p className="text-lg font-bold text-stone-900">{averageRating}</p>
                    <p className="text-[10px] text-stone-500">{reviews.length} reviews</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="mb-6 border-b border-stone-200 pb-6">
                <h2 className="mb-3 text-lg font-bold text-stone-900">About this stay</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{listing.description}</p>
              </div>
            )}

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-6 border-b border-stone-200 pb-6">
                <h2 className="mb-3 text-lg font-bold text-stone-900">Amenities</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {listing.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-stone-600">
                      <svg className="h-4 w-4 text-[#c76f55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
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
                          {[...Array(5)].map((_, i) => (
                            <svg 
                              key={i} 
                              className={`h-3.5 w-3.5 ${i < review.rating ? 'text-yellow-500' : 'text-stone-300'}`} 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
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

          {/* Sidebar - Desktop Booking Panel */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
              {/* Pricing */}
              <div className="mb-6">
                <p className="text-2xl font-bold text-stone-900">
                  ₪{listing.price_ils?.toLocaleString()}
                  <span className="ml-1 text-base font-normal text-stone-500">/ night</span>
                </p>
                {listing.price_usd && (
                  <p className="text-sm text-stone-500">
                    ~${listing.price_usd?.toLocaleString()} USD / night
                  </p>
                )}
              </div>

              {/* Date and Guest Selection */}
              <div className="mb-4 space-y-3">
                <BookingDateRangePicker
                  dateRange={bookingDateRange}
                  setDateRange={setBookingDateRange}
                />
                <div className="rounded-2xl border border-stone-200 bg-white p-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-stone-500">Guests</label>
                  <select className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-stone-900 focus:outline-none focus:ring-0">
                    {[...Array(listing.max_guests || 6)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} guest{i > 0 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Primary Action */}
              <button className="mb-3 w-full rounded-xl bg-[#c76f55] py-3.5 font-semibold text-white transition hover:bg-[#b55f47]">
                Request to book
              </button>

              <p className="mb-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>

              {/* Secondary Actions */}
              <div className="space-y-2 border-t border-stone-100 pt-4">
                <MessageHostDialog
                  listingId={listing.id}
                  listingTitle={listing.title}
                  hostId={listing.host_id}
                />
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reserve with deposit
                </button>
              </div>

              {/* Host Info */}
              {host && (
                <div className="mt-6 border-t border-stone-100 pt-6">
                  <Link 
                    href={`/hosts/${host.id}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-stone-50"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-200">
                      {host.profile_photo_url ? (
                        <img src={host.profile_photo_url} alt={getPublicName(host)} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#c76f55] to-[#a85a45] text-lg font-bold text-white">
                          {getPublicName(host).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-900">Hosted by {getPublicName(host)}</p>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        {host.is_verified && (
                          <span className="flex items-center gap-1 text-green-600">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Verified host
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white p-4 shadow-lg lg:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-stone-900">
              ₪{listing.price_ils?.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-stone-500">/ night</span>
            </p>
            {listing.price_usd && (
              <p className="text-xs text-stone-500">~${listing.price_usd?.toLocaleString()} USD</p>
            )}
          </div>
          <button 
            onClick={() => setShowMobileBooking(true)}
            className="rounded-xl bg-[#c76f55] px-6 py-3 font-semibold text-white transition hover:bg-[#b55f47]"
          >
            Request to book
          </button>
        </div>
      </div>

      {/* Mobile Booking Bottom Sheet */}
      {showMobileBooking && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileBooking(false)}
          />
          
          {/* Bottom Sheet */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white">
            {/* Handle */}
            <div className="sticky top-0 flex justify-center bg-white py-3">
              <div className="h-1 w-12 rounded-full bg-stone-300" />
            </div>

            <div className="px-6 pb-8">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-stone-900">Book this stay</h3>
                <button 
                  onClick={() => setShowMobileBooking(false)}
                  className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Pricing */}
              <div className="mb-6 rounded-xl bg-[#F8F5F2] p-4">
                <p className="text-2xl font-bold text-stone-900">
                  ₪{listing.price_ils?.toLocaleString()}
                  <span className="ml-1 text-base font-normal text-stone-500">/ night</span>
                </p>
                {listing.price_usd && (
                  <p className="text-sm text-stone-500">~${listing.price_usd?.toLocaleString()} USD / night</p>
                )}
              </div>

              {/* Date and Guest Selection */}
              <div className="mb-6 space-y-3">
                <BookingDateRangePicker
                  dateRange={bookingDateRange}
                  setDateRange={setBookingDateRange}
                />
                <div className="rounded-2xl border border-stone-200 bg-white p-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-stone-500">Guests</label>
                  <select className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-stone-900 focus:outline-none focus:ring-0">
                    {[...Array(listing.max_guests || 6)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} guest{i > 0 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button className="w-full rounded-xl bg-[#c76f55] py-4 font-semibold text-white transition hover:bg-[#b55f47]">
                  Request to book
                </button>
                <MessageHostDialog
                  listingId={listing.id}
                  listingTitle={listing.title}
                  hostId={listing.host_id}
                />
                <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-4 font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reserve with deposit
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-stone-500">You won&apos;t be charged yet</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
          <button
            onClick={() => setShowGallery(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <button
            onClick={() => setSelectedPhoto((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
            className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="max-h-[80vh] max-w-[90vw]">
            <img
              src={photos[selectedPhoto]?.photo_url}
              alt={`${listing.title} - Photo ${selectedPhoto + 1}`}
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />
          </div>

          <button
            onClick={() => setSelectedPhoto((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
            className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white">
            {selectedPhoto + 1} / {photos.length}
          </div>

          {/* Thumbnail strip */}
          <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2">
            {photos.map((photo, index) => (
              <button
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
      )}
    </div>
  )
}
