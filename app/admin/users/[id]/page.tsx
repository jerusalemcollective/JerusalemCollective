import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import {
  updateHostCommissionOverride,
  updateHostListingBlock,
  updateHostVerification,
} from '@/app/admin/host-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { parsePayout, formatPayoutRows } from '@/lib/direct-payment'
import { oneOrNull } from '@/lib/utils/one-or-null'
import {
  bookingGuestName,
  bookingStatusLabel,
  formatBookingAmount,
  formatDateRange,
  formatGuestCount,
  jerusalemToday,
} from '@/lib/booking-display'
import { BookingBadge } from '@/app/admin/bookings/booking-badge'

type PersonRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  is_host: boolean
  is_admin: boolean
  admin_role: string | null
  host_id: string | null
  host_type: string | null
  host_is_verified: boolean | null
  listing_count: number
  application_count: number
  booking_count: number
  saved_count: number
  created_at: string
  last_sign_in_at: string | null
}

type BookingRow = {
  id: string
  check_in: string | null
  check_out: string | null
  guests: number | null
  status: string | null
  payment_status: string | null
  total_amount_usd: number | null
  total_amount_ils: number | null
  listings?: { title: string | null } | { title: string | null }[] | null
  guest?: { full_name: string | null } | { full_name: string | null }[] | null
}

const BOOKING_LIST_LIMIT = 20
const BOOKING_COLUMNS =
  'id, check_in, check_out, guests, status, payment_status, total_amount_usd, total_amount_ils, listings(title), guest:profiles!bookings_user_id_fkey(full_name)'

type ListingRow = {
  id: string
  title: string | null
  area: string | null
  is_published: boolean | null
  price_usd: number | null
  price_ils: number | null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const { supabase } = await requireAdminPermission('users')

  const { data: peopleData, error } = await supabase.rpc('list_platform_people')
  if (error) throw error
  const person = ((peopleData || []) as PersonRow[]).find((row) => row.user_id === userId)
  if (!person) notFound()

  const isHost = Boolean(person.is_host) || Boolean(person.host_id)
  const hasGuestActivity = Number(person.booking_count || 0) > 0 || Number(person.saved_count || 0) > 0
  const isGuest = hasGuestActivity || !isHost

  // Bookings were invisible here because admins had no SELECT policy on
  // bookings (fixed by migration 114). Guest trips key on bookings.user_id;
  // bookings on their listings key on bookings.host_id = hosts.id.
  const [guestBookingsResult, hostBookingsResult] = await Promise.all([
    supabase
      .from('bookings')
      .select(BOOKING_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('check_in', { ascending: false })
      .limit(BOOKING_LIST_LIMIT),
    person.host_id
      ? supabase
          .from('bookings')
          .select(BOOKING_COLUMNS, { count: 'exact' })
          .eq('host_id', person.host_id)
          .order('check_in', { ascending: false })
          .limit(BOOKING_LIST_LIMIT)
      : Promise.resolve({ data: [], count: 0, error: null }),
  ])
  const bookings = (guestBookingsResult.data || []) as BookingRow[]
  const guestBookingTotal = guestBookingsResult.count ?? bookings.length
  const hostBookings = (hostBookingsResult.data || []) as BookingRow[]
  const hostBookingTotal = hostBookingsResult.count ?? hostBookings.length
  const bookingsError = guestBookingsResult.error?.message || hostBookingsResult.error?.message || null
  // list_platform_people counts bookings with SECURITY DEFINER, so a non-zero
  // count with no readable rows means migration 114 hasn't been run.
  const bookingsHidden = !bookingsError && bookings.length === 0 && Number(person.booking_count || 0) > 0
  const today = jerusalemToday()

  // Host-side data (only when they own a host record).
  let listings: ListingRow[] = []
  let listingBlocked = false
  let listingBlockedReason: string | null = null
  let commissionOverride: number | null = null
  let payoutMethod: string | null = null
  let payoutDetails: unknown = null
  let defaultCommission = 0

  if (person.host_id) {
    const [{ data: listingRows }, { data: blockRow }, { data: paymentProfile }, { data: settingRows }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, area, is_published, price_usd, price_ils')
        .eq('host_id', person.host_id)
        .order('created_at', { ascending: false }),
      supabase.from('hosts').select('listing_blocked, listing_blocked_reason').eq('id', person.host_id).maybeSingle(),
      supabase
        .from('host_payment_profiles')
        .select('commission_percent_override, payout_method, payout_details')
        .eq('host_id', person.host_id)
        .maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'commission_percent').maybeSingle(),
    ])
    listings = (listingRows || []) as ListingRow[]
    listingBlocked = Boolean((blockRow as { listing_blocked?: boolean | null } | null)?.listing_blocked)
    listingBlockedReason = (blockRow as { listing_blocked_reason?: string | null } | null)?.listing_blocked_reason ?? null
    commissionOverride = (paymentProfile as { commission_percent_override?: number | null } | null)?.commission_percent_override ?? null
    payoutMethod = (paymentProfile as { payout_method?: string | null } | null)?.payout_method ?? null
    payoutDetails = (paymentProfile as { payout_details?: unknown } | null)?.payout_details ?? null
    const rawDefault = Number((settingRows as { value?: string } | null)?.value || 0)
    defaultCommission = Number.isFinite(rawDefault) && rawDefault >= 0 ? rawDefault : 0
  }

  const parsedPayout = payoutDetails ? parsePayout(payoutDetails) : null
  const payoutRows = parsedPayout ? formatPayoutRows(parsedPayout) : []
  const effectiveCommission = commissionOverride ?? defaultCommission

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex text-sm font-semibold text-[#c76f55] hover:underline">
        ← Back to users
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-stone-950">{person.full_name || 'Unnamed user'}</h2>
          {isHost && <Pill label="Host" />}
          {isGuest && <Pill label="Guest" muted />}
          {person.is_admin && <Pill label={person.admin_role || 'admin'} accent />}
        </div>
      </div>

      {/* Account details */}
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-950">Account</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={person.email || 'No email'} />
          <Detail label="Phone" value={person.phone || 'No phone'} />
          <Detail label="Joined" value={formatDate(person.created_at)} />
          <Detail label="Last sign-in" value={formatDate(person.last_sign_in_at)} />
          <Detail label="Trips booked" value={String(person.booking_count || 0)} />
          <Detail label="Saved stays" value={String(person.saved_count || 0)} />
        </dl>
      </section>

      {/* Guest activity */}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-6 py-4">
          <h3 className="text-lg font-bold text-stone-950">Trips as a guest</h3>
          {guestBookingTotal > bookings.length && (
            <p className="text-xs text-stone-500">
              Showing {bookings.length} of {guestBookingTotal}
            </p>
          )}
        </div>
        {bookingsError ? (
          <div className="px-6 py-6 text-sm text-rose-700">Bookings could not be loaded: {bookingsError}</div>
        ) : bookingsHidden ? (
          <div className="px-6 py-6 text-sm text-amber-900">
            This user has {person.booking_count} booking{Number(person.booking_count) === 1 ? '' : 's'}, but admins can’t
            read bookings yet. Run <code className="rounded bg-amber-100 px-1">114_admin_read_bookings.sql</code> in the
            Supabase SQL editor.
          </div>
        ) : (
          <BookingList bookings={bookings} today={today} empty="No bookings yet." />
        )}
      </section>

      {person.host_id && (
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-6 py-4">
            <h3 className="text-lg font-bold text-stone-950">Bookings on their listings</h3>
            {hostBookingTotal > hostBookings.length && (
              <p className="text-xs text-stone-500">
                Showing {hostBookings.length} of {hostBookingTotal}
              </p>
            )}
          </div>
          {bookingsError ? (
            <div className="px-6 py-6 text-sm text-rose-700">Bookings could not be loaded: {bookingsError}</div>
          ) : (
            <BookingList bookings={hostBookings} today={today} empty="No bookings on their listings yet." showGuest />
          )}
        </section>
      )}

      {/* Host section */}
      {person.host_id && (
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
            <h3 className="text-lg font-bold text-stone-950">Host</h3>
            <div className="flex flex-wrap items-center gap-2">
              <BooleanBadge value={Boolean(person.host_is_verified)} yes="Verified" no="Unverified" falseTone="strong" />
              {listingBlocked && (
                <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                  Listing blocked
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Host type" value={person.host_type || 'owner'} />
              <Detail
                label="Inventory"
                value={`${person.listing_count || 0} live · ${person.application_count || 0} submitted`}
              />
            </div>

            {listingBlocked && listingBlockedReason && (
              <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">Reason: {listingBlockedReason}</p>
            )}

            {/* Commission */}
            <div className="rounded-2xl border border-stone-200 p-4">
              <p className="text-sm font-semibold text-stone-900">Commission</p>
              <p className="mt-1 text-sm text-stone-600">
                Effective {formatCommission(effectiveCommission)}
                {commissionOverride === null ? ` (default ${formatCommission(defaultCommission)})` : ' (custom rate)'}
              </p>
              <form action={updateHostCommissionOverride} className="mt-3 flex gap-2">
                <input type="hidden" name="hostId" value={person.host_id} />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="commissionOverride"
                  defaultValue={commissionOverride ?? ''}
                  placeholder="Default"
                  className="w-32 rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
                  aria-label="Host commission override"
                />
                <button
                  type="submit"
                  className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                >
                  Save
                </button>
              </form>
            </div>

            {/* Payout */}
            <div className="rounded-2xl bg-[#fbfaf8] px-4 py-2 text-xs text-stone-600">
              <span className="font-bold uppercase tracking-widest text-stone-500">Payout </span>
              {payoutMethod === 'stripe' ? (
                <span>Stripe — send from the Stripe dashboard</span>
              ) : payoutRows.length > 0 ? (
                <span>Manual — {payoutRows.map(([label, value]) => `${label}: ${value}`).join(' · ')}</span>
              ) : (
                <span className="text-stone-400">Not set</span>
              )}
            </div>

            {/* Host actions */}
            <div className="flex flex-wrap gap-2">
              <form action={updateHostVerification}>
                <input type="hidden" name="hostId" value={person.host_id} />
                <input type="hidden" name="value" value={String(!person.host_is_verified)} />
                <ConfirmSubmitButton
                  message="Are you sure?"
                  className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                >
                  {person.host_is_verified ? 'Remove verification' : 'Verify'}
                </ConfirmSubmitButton>
              </form>
              <form action={updateHostListingBlock}>
                <input type="hidden" name="hostId" value={person.host_id} />
                <input type="hidden" name="value" value={String(!listingBlocked)} />
                <input type="hidden" name="reason" value="Blocked by platform admin" />
                <ConfirmSubmitButton
                  message={listingBlocked ? 'Allow this host to list again?' : 'Block this host from listing and hide their live listings?'}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    listingBlocked
                      ? 'border border-stone-200 text-stone-700 hover:border-stone-300'
                      : 'bg-rose-600 text-white hover:bg-rose-700'
                  }`}
                >
                  {listingBlocked ? 'Unblock listing' : 'Block listing'}
                </ConfirmSubmitButton>
              </form>
            </div>

            {/* Their listings */}
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-stone-500">Listings</p>
              {listings.length === 0 ? (
                <p className="mt-2 text-sm text-stone-500">No listings yet.</p>
              ) : (
                <div className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200">
                  {listings.map((listing) => (
                    <div key={listing.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_1fr_0.7fr] md:items-center">
                      <Link href={`/admin/listings/${listing.id}`} className="font-semibold text-stone-950 hover:underline">
                        {listing.title || 'Untitled listing'}
                      </Link>
                      <p className="text-sm text-stone-600">{listing.area || 'Unknown area'}</p>
                      <p className="text-sm font-semibold text-stone-700">
                        {listing.is_published ? 'Published' : 'Draft'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function BookingList({
  bookings,
  today,
  empty,
  showGuest = false,
}: {
  bookings: BookingRow[]
  today: string
  empty: string
  showGuest?: boolean
}) {
  if (bookings.length === 0) return <div className="px-6 py-8 text-center text-stone-500">{empty}</div>
  return (
    <div className="divide-y divide-stone-100">
      {bookings.map((booking) => (
        <Link
          key={booking.id}
          href={`/admin/bookings/${booking.id}`}
          className="grid gap-1 px-6 py-4 transition hover:bg-stone-50 md:grid-cols-[1.4fr_1.1fr_0.8fr_auto] md:items-center md:gap-3"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-900">{oneOrNull(booking.listings)?.title || 'Listing removed'}</p>
            {showGuest && (
              <p className="truncate text-xs text-stone-500">
                Guest: {bookingGuestName({ full_name: oneOrNull(booking.guest)?.full_name })}
              </p>
            )}
          </div>
          <p className="text-sm text-stone-600">
            {formatDateRange(booking.check_in, booking.check_out)} · {formatGuestCount(booking.guests)}
          </p>
          <p className="text-sm font-semibold text-stone-800">{formatBookingAmount(booking)}</p>
          <BookingBadge {...bookingStatusLabel(booking, today)} />
        </Link>
      ))}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm text-stone-900">{value}</dd>
    </div>
  )
}

function Pill({ label, muted = false, accent = false }: { label: string; muted?: boolean; accent?: boolean }) {
  const tone = accent
    ? 'bg-[#c76f55]/15 text-[#9d513b]'
    : muted
      ? 'bg-stone-200 text-stone-700'
      : 'bg-stone-950 text-white'
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${tone}`}>{label}</span>
  )
}

function formatCommission(value: number) {
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}%`
}
