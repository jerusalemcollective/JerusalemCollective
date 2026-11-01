import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import {
  archiveListing,
  deleteListing,
  updateAdminListingDetails,
  updateListingVisibility,
} from '@/app/admin/listing-actions'
import { AdminActionForm, AdminConfirmActionForm } from '@/components/admin-confirm-action-form'
import { AdminListingMessageForm } from '@/components/admin-listing-message-form'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { calculateListingScore } from '@/lib/marketplace-rules'
import { AmenitySelector } from '@/components/amenity-selector'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { StayTermsFields } from '@/components/stay-terms-fields'
import { STAY_TERMS_COLUMNS, stayTermsFromResult } from '@/lib/stay-terms'

// 'live' is a legacy value from before review and visibility were split; it reads as Ready.
type ListingAdminStatus = 'needs_work' | 'ready_for_launch' | 'live'

type AdminListingDetail = {
  id: string
  title: string
  area: string
  exact_address: string | null
  host_id: string
  is_published: boolean
  is_featured: boolean
  admin_status: ListingAdminStatus | null
  archived_at: string | null
  online_payment_enabled: boolean | null
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  sleeping_setup: string | null
  booking_type: string | null
  amenities: string[] | null
  description: string | null
  price_usd: number | null
  price_ils: number | null
  hosts?: {
    name: string
  } | null
}

type AdminListingDetailRow = Omit<AdminListingDetail, 'hosts'> & {
  hosts?: AdminListingDetail['hosts'] | NonNullable<AdminListingDetail['hosts']>[] | null
}

type MessageThreadRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string
  created_at: string
}

type ListingReviewRow = {
  id: string
  reviewer_name: string | null
  rating: number | null
  title: string | null
  content: string | null
  is_approved: boolean
  created_at: string
}

export default async function AdminListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams
  const { supabase } = await requireAdminPermission('listings')
  const [{ data: listingData }, { data: messages, error: messagesError }, { data: photos }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, exact_address, host_id, is_published, is_featured, admin_status, archived_at, online_payment_enabled, bedrooms, bathrooms, max_guests, sleeping_setup, booking_type, amenities, description, price_usd, price_ils, hosts(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('listing_admin_messages')
      .select('id, body, created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_photos')
      .select('id')
      .eq('listing_id', id),
  ])

  if (!listingData) notFound()
  if (messagesError) console.error('Could not load listing admin messages', id, messagesError)

  const listingRow: AdminListingDetailRow = listingData
  const listing: AdminListingDetail = {
    ...listingRow,
    hosts: oneOrNull(listingRow.hosts),
  }

  // Reviews for this listing — admins can read all (incl. hidden) via RLS.
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, title, content, is_approved, created_at')
    .eq('listing_id', id)
    .order('created_at', { ascending: false })

  // Check-in/out and cancellation (migration 118), read on their own so this page
  // still loads before the migration has been run.
  const stayTerms = stayTermsFromResult(
    await supabase.from('listings').select(STAY_TERMS_COLUMNS.join(', ')).eq('id', id).maybeSingle(),
  )

  // Host <-> guest message threads. conversations/messages are RLS-scoped to the
  // participants, so read them with the service role — this page is admin-gated
  // (requireAdminPermission('listings')), so an admin overseeing a listing is
  // authorised to see its communication.
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const svc = serviceUrl && serviceKey ? createServiceRoleClient(serviceUrl, serviceKey) : null

  const messagesByConvo = new Map<string, MessageThreadRow[]>()
  const nameById = new Map<string, string>()
  let hasThreads = false
  if (svc) {
    const { data: convoData } = await svc
      .from('conversations')
      .select('id, created_at')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
    const convoIds = (convoData || []).map((c: { id: string }) => c.id)
    if (convoIds.length) {
      const { data: msgData } = await svc
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: true })
      for (const message of (msgData || []) as MessageThreadRow[]) {
        const list = messagesByConvo.get(message.conversation_id) || []
        list.push(message)
        messagesByConvo.set(message.conversation_id, list)
        hasThreads = true
      }
      const senderIds = [
        ...new Set(
          ((msgData || []) as MessageThreadRow[])
            .map((message) => message.sender_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ]
      if (senderIds.length) {
        const { data: peopleData } = await svc
          .from('profiles')
          .select('id, full_name')
          .in('id', senderIds)
        for (const person of (peopleData || []) as { id: string; full_name: string | null }[]) {
          nameById.set(person.id, person.full_name || 'Unknown')
        }
      }
    }
  }

  const qualityScore = calculateListingScore({
    photo_count: photos?.length || 0,
    description: listing.description,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sleeping_setup: listing.sleeping_setup,
    amenities: listing.amenities || [],
    price_usd: listing.price_usd,
    price_ils: listing.price_ils,
  })
  const reviewStatus = listing.admin_status === 'needs_work' || !listing.admin_status ? 'needs_work' : 'ready_for_launch'
  const visibility = listing.archived_at ? 'Archived' : listing.is_published ? 'On the site' : 'Hidden'

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/admin/listings" className="hover:text-[#c76f55]">Listings</Link>
        <span>/</span>
        <span className="text-stone-900">{listing.title}</span>
      </div>

      <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-stone-950">Listing status</h2>
          <p className="text-sm text-stone-600">
            Now: <span className="font-bold text-stone-950">{visibility}</span>
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {!listing.archived_at && (
            <AdminConfirmActionForm
              action={updateListingVisibility}
              fields={{ listingId: listing.id, field: 'is_published', value: String(!listing.is_published) }}
              label={listing.is_published ? 'Hide from site' : 'Show on site'}
              pendingLabel={listing.is_published ? 'Hiding...' : 'Showing...'}
              description={
                listing.is_published
                  ? 'Guests can no longer see or book it. You can show it again any time.'
                  : 'Guests can find and book it. The host is emailed.'
              }
              confirmText={listing.is_published ? 'Hide this listing from guests?' : 'Show this listing to guests?'}
              confirmLabel={listing.is_published ? 'Yes, hide it' : 'Yes, show it'}
              className="rounded-full bg-stone-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
            />
          )}
          <AdminConfirmActionForm
            action={archiveListing}
            fields={listing.archived_at ? { listingId: listing.id, restore: 'true' } : { listingId: listing.id }}
            label={listing.archived_at ? 'Restore' : 'Archive'}
            pendingLabel={listing.archived_at ? 'Restoring...' : 'Archiving...'}
            description={
              listing.archived_at
                ? 'Brings it back as hidden, so you can check it before showing it.'
                : 'Takes it off the site and keeps all its bookings and history. You can restore it.'
            }
            confirmText={listing.archived_at ? 'Restore this listing?' : 'Archive this listing?'}
            confirmLabel={listing.archived_at ? 'Yes, restore' : 'Yes, archive'}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
          />
          <AdminConfirmActionForm
            action={deleteListing}
            fields={{ listingId: listing.id }}
            label="Delete permanently"
            pendingLabel="Deleting..."
            description="Removes the listing and its photos forever. Not possible once it has bookings or requests."
            confirmText="Delete this listing and its photos forever? This cannot be undone."
            confirmLabel="Yes, delete"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Listing</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">{listing.title}</h1>
          <p className="mt-2 text-stone-600">{listing.area}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Host" value={listing.hosts?.name || 'Host'} />
            <Info label="On the site" value={visibility} />
            <Info label="Featured" value={listing.is_featured ? 'Featured' : 'Standard'} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Info label="Rooms" value={`${listing.bedrooms ?? '-'} bed / ${listing.bathrooms ?? '-'} bath`} />
            <Info label="Sleeps" value={String(listing.max_guests ?? '-')} />
            <Info label="Sleeping setup" value={listing.sleeping_setup ? 'Complete' : 'Missing'} />
          </div>
          {listing.sleeping_setup && (
            <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Sleeping setup</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                {listing.sleeping_setup}
              </p>
            </div>
          )}
          <div className="mt-6 rounded-2xl bg-[#F8F5F2] p-4">
            <ListingQualityScore score={qualityScore} />
          </div>

          <div className="mt-8 border-t border-stone-100 pt-8">
            <h2 className="text-lg font-bold text-stone-950">Edit listing details</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Admin edits update the live listing directly. The host is emailed a list of what changed.
            </p>
            <AdminActionForm
              action={updateAdminListingDetails}
              submitLabel="Save listing edits"
              pendingLabel="Saving..."
              className="mt-5 grid gap-4"
              submitClassName="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-stone-800"
            >
              <input type="hidden" name="listingId" value={listing.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <EditField label="Title" name="title" defaultValue={listing.title} required />
                <EditField label="Neighbourhood" name="area" defaultValue={listing.area} required />
                <div className="md:col-span-2">
                  <EditField label="Exact address" name="exactAddress" defaultValue={listing.exact_address || ''} />
                </div>
                <EditField label="Bedrooms" name="bedrooms" type="number" min="0" defaultValue={String(listing.bedrooms ?? '')} />
                <EditField label="Bathrooms" name="bathrooms" type="number" min="0" step="0.5" defaultValue={String(listing.bathrooms ?? '')} />
                <EditField label="Max guests" name="maxGuests" type="number" min="1" defaultValue={String(listing.max_guests ?? '')} />
                <EditField label="Price ILS" name="priceIls" type="number" min="0" defaultValue={String(listing.price_ils ?? '')} />
                <EditField label="Price USD" name="priceUsd" type="number" min="0" defaultValue={String(listing.price_usd ?? '')} />
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Booking style (payment method is separate)</span>
                <select
                  name="bookingType"
                  defaultValue={listing.booking_type || 'request'}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                >
                  <option value="request">Request to book (host accepts first)</option>
                  <option value="instant">Instant book (confirmed when the guest books)</option>
                  {listing.booking_type === 'enquiry' && <option value="enquiry">Enquiry only</option>}
                </select>
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-700">
                <input
                  type="checkbox"
                  name="onlinePaymentEnabled"
                  defaultChecked={Boolean(listing.online_payment_enabled)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-stone-950">Allow Book now with JLM payment</span>
                  <span className="mt-1 block text-xs text-stone-500">
                    Guests can pay JLM Collective online. Host payout stays in the currency received where supported.
                  </span>
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Review</span>
                <select
                  name="adminStatus"
                  defaultValue={reviewStatus}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                >
                  <option value="needs_work">Needs work</option>
                  <option value="ready_for_launch">Ready</option>
                </select>
                <span className="mt-1 block text-xs text-stone-500">
                  A note for the JLM team only. Use Listing status above to show or hide it.
                </span>
              </label>
              <div className="grid gap-3">
                <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-700">
                  <input type="checkbox" name="isFeatured" defaultChecked={listing.is_featured} className="mt-1" />
                  <span>
                    <span className="block font-bold text-stone-950">Featured</span>
                    <span className="mt-1 block text-xs text-stone-500">Prioritise this stay in listing displays.</span>
                  </span>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Sleeping setup</span>
                <textarea
                  name="sleepingSetup"
                  defaultValue={listing.sleeping_setup || ''}
                  rows={5}
                  className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                />
              </label>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Amenities</span>
                <div className="mt-2">
                  <AmenitySelector defaultSelectedAmenities={listing.amenities || []} />
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Description</span>
                <textarea
                  name="description"
                  defaultValue={listing.description || ''}
                  rows={7}
                  className="mt-2 min-h-36 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                />
              </label>
              <StayTermsFields
                terms={stayTerms.terms}
                available={stayTerms.available}
                audience="admin"
                className="border-t border-stone-100 pt-4"
                unavailableNote="Check-in time, check-out time and cancellation policy can be edited here once database migration 118 has been run."
              />
              {saved === '1' && (
                <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Listing edits saved.
                </p>
              )}
            </AdminActionForm>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-stone-950">Previous messages</h2>
            <div className="mt-4 space-y-3">
              {messagesError && (
                <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  We could not load previous listing messages. Please refresh the page.
                </p>
              )}
              {(messages || []).map((message) => (
                <article key={message.id} className="rounded-2xl bg-[#F8F5F2] p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
                    Message from JLM Collective
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    {new Date(message.created_at).toLocaleString('en-GB')}
                  </p>
                </article>
              ))}
              {!messages?.length && (
                <p className="text-sm text-stone-500">No messages sent for this listing yet.</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-stone-950">Reviews</h2>
            <div className="mt-4 space-y-3">
              {((reviews || []) as ListingReviewRow[]).map((review) => (
                <article key={review.id} className="rounded-2xl bg-[#F8F5F2] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-stone-900">{review.reviewer_name || 'Guest'}</p>
                    <span className="text-sm text-[#c76f55]" aria-label={`${review.rating ?? 0} out of 5`}>
                      {'★'.repeat(Math.round(review.rating ?? 0))}
                      <span className="text-stone-300">
                        {'★'.repeat(Math.max(0, 5 - Math.round(review.rating ?? 0)))}
                      </span>
                    </span>
                  </div>
                  {review.title && <p className="mt-1 text-sm font-semibold text-stone-800">{review.title}</p>}
                  {review.content && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">{review.content}</p>
                  )}
                  <p className="mt-2 text-xs text-stone-500">
                    {new Date(review.created_at).toLocaleDateString('en-GB')}
                    {!review.is_approved && ' · Hidden from public'}
                  </p>
                </article>
              ))}
              {!((reviews || []) as ListingReviewRow[]).length && (
                <p className="text-sm text-stone-500">No reviews yet.</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-stone-950">Guest &amp; host messages</h2>
            <div className="mt-4 space-y-4">
              {[...messagesByConvo.entries()].map(([conversationId, thread]) => (
                <div key={conversationId} className="rounded-2xl border border-stone-200 p-4">
                  <div className="space-y-3">
                    {thread.map((message) => (
                      <div key={message.id}>
                        <p className="text-xs font-semibold text-stone-500">
                          <span className="text-stone-900">
                            {message.sender_id ? nameById.get(message.sender_id) || 'Unknown' : 'Unknown'}
                          </span>
                          {' · '}
                          {new Date(message.created_at).toLocaleString('en-GB')}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-stone-800">
                          {message.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!hasThreads && (
                <p className="text-sm text-stone-500">No guest messages for this listing yet.</p>
              )}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-950">Message host</h2>
          <div className="mt-4">
            <AdminListingMessageForm listingId={listing.id} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F8F5F2] p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  )
}

function EditField({
  label,
  name,
  defaultValue,
  type = 'text',
  min,
  step,
  required = false,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  min?: string
  step?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        min={min}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
      />
    </label>
  )
}
