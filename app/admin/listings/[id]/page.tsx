import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { deleteListing, updateAdminListingDetails, updateAdminListingStatus } from '@/app/admin/listing-actions'
import { AdminListingMessageForm } from '@/components/admin-listing-message-form'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { calculateListingScore } from '@/lib/marketplace-rules'
import { AmenitySelector } from '@/components/amenity-selector'

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

export default async function AdminListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdminPermission('listings')
  const [{ data: listingData }, { data: messages, error: messagesError }, { data: photos }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, exact_address, host_id, is_published, is_featured, admin_status, online_payment_enabled, bedrooms, bathrooms, max_guests, sleeping_setup, booking_type, amenities, description, price_usd, price_ils, hosts(name)')
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

  const listingRow: AdminListingDetailRow = listingData
  const listing: AdminListingDetail = {
    ...listingRow,
    hosts: Array.isArray(listingRow.hosts)
      ? listingRow.hosts[0] || null
      : listingRow.hosts,
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
  const adminStatus = listing.admin_status || (listing.is_published ? 'live' : 'needs_work')

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/admin/listings" className="hover:text-[#c76f55]">Listings</Link>
        <span>/</span>
        <span className="text-stone-900">{listing.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Listing</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">{listing.title}</h1>
          <p className="mt-2 text-stone-600">{listing.area}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info label="Host" value={listing.hosts?.name || 'Host'} />
            <Info label="Published" value={listing.is_published ? 'Live' : 'Hidden'} />
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
              Admin edits update the live listing directly.
            </p>
            <form action={updateAdminListingDetails} className="mt-5 grid gap-4">
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
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Booking type</span>
                <select
                  name="bookingType"
                  defaultValue={listing.booking_type || 'request'}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                >
                  <option value="request">Request to book</option>
                  <option value="enquiry">Enquiry only</option>
                  <option value="instant">Instant book</option>
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
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Launch status</span>
                <select
                  name="adminStatus"
                  defaultValue={adminStatus}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                >
                  <option value="needs_work">Needs work</option>
                  <option value="ready_for_launch">Ready for launch</option>
                  <option value="live">Live</option>
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl bg-[#F8F5F2] p-4 text-sm text-stone-700">
                  <input type="checkbox" name="isPublished" defaultChecked={listing.is_published} className="mt-1" />
                  <span>
                    <span className="block font-bold text-stone-950">Published</span>
                    <span className="mt-1 block text-xs text-stone-500">Guests can see this listing.</span>
                  </span>
                </label>
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
              <button className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-stone-800">
                Save listing edits
              </button>
            </form>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-stone-950">Previous messages</h2>
            <div className="mt-4 space-y-3">
              {messagesError && (
                <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  We could not load previous listing messages: {messagesError.message}
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
        </section>

        <aside className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-950">Launch status</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Current status: <span className="font-bold text-stone-950">{adminStatusLabel(adminStatus)}</span>
          </p>
          <div className="mt-4 grid gap-2">
            {([
              ['needs_work', 'Needs work'],
              ['ready_for_launch', 'Ready for launch'],
              ['live', 'Live'],
            ] as const).map(([value, label]) => (
              <form key={value} action={updateAdminListingStatus}>
                <input type="hidden" name="listingId" value={listing.id} />
                <input type="hidden" name="adminStatus" value={value} />
                <button
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    adminStatus === value
                      ? 'bg-stone-950 text-white'
                      : 'border border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  {label}
                </button>
              </form>
            ))}
          </div>

          <div className="mt-6 border-t border-stone-100 pt-5">
          <h2 className="text-lg font-bold text-stone-950">Message host</h2>
          <div className="mt-4">
            <AdminListingMessageForm listingId={listing.id} />
          </div>
          </div>

          <div className="mt-6 border-t border-stone-100 pt-5">
            <h2 className="text-sm font-bold text-stone-950">Danger zone</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Remove this listing from the platform.
            </p>
            <form action={deleteListing} className="mt-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <ConfirmSubmitButton
                message="Remove this listing from the platform? This cannot be undone."
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
              >
                Remove listing
              </ConfirmSubmitButton>
            </form>
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

function adminStatusLabel(status: ListingAdminStatus) {
  if (status === 'ready_for_launch') return 'Ready for launch'
  if (status === 'live') return 'Live'
  return 'Needs work'
}
