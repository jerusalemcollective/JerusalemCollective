import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { oneOrNull } from '@/lib/utils/one-or-null'
import {
  bookingGuestName,
  bookingNights,
  bookingStatusLabel,
  formatBookingAmount,
  formatDateRange,
  formatGuestCount,
  formatNights,
  jerusalemToday,
} from '@/lib/booking-display'
import { BookingBadge } from './booking-badge'

const PAGE_SIZE = 25
// Cap on ids per search bucket so the PostgREST `in` filter stays a sane size.
const SEARCH_ID_LIMIT = 200

const VIEWS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
] as const

type View = (typeof VIEWS)[number]['value']

type BookingRow = {
  id: string
  listing_id: string | null
  host_id: string | null
  user_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  status: string | null
  payment_status: string | null
  total_amount_usd: number | null
  total_amount_ils: number | null
  created_at: string | null
  listings: { id: string; title: string | null; area: string | null } | null
  hosts: { id: string; name: string | null; user_id: string | null } | null
  guest: { full_name: string | null } | null
}

type BookingQueryRow = Omit<BookingRow, 'listings' | 'hosts' | 'guest'> & {
  listings?: BookingRow['listings'] | NonNullable<BookingRow['listings']>[] | null
  hosts?: BookingRow['hosts'] | NonNullable<BookingRow['hosts']>[] | null
  guest?: BookingRow['guest'] | NonNullable<BookingRow['guest']>[] | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

function viewHref(currentParams: Record<string, string>, updates: Record<string, string>) {
  const params = new URLSearchParams()
  Object.entries({ ...currentParams, ...updates }).forEach(([key, value]) => {
    if (key === 'page' || !value) return
    if (key === 'view' && value === 'upcoming') return
    params.set(key, value)
  })
  const query = params.toString()
  return query ? `/admin/bookings?${query}` : '/admin/bookings'
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('guests')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const view: View = VIEWS.some((option) => option.value === currentSearchParams.view)
    ? (currentSearchParams.view as View)
    : 'upcoming'
  const search = (currentSearchParams.q || '').trim().slice(0, 100)
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const today = jerusalemToday()

  // Search spans three tables, so resolve matching listing / host / guest ids
  // first and filter bookings by any of them.
  let searchFilter: string | null = null
  let searchMatchedNothing = false
  if (search) {
    const pattern = `%${escapeLike(search)}%`
    const [{ data: listingMatches }, { data: hostMatches }, { data: guestMatches }] = await Promise.all([
      supabase.from('listings').select('id').ilike('title', pattern).limit(SEARCH_ID_LIMIT),
      supabase.from('hosts').select('id').ilike('name', pattern).limit(SEARCH_ID_LIMIT),
      supabase.from('profiles').select('id').ilike('full_name', pattern).limit(SEARCH_ID_LIMIT),
    ])
    const ids = (rows: { id: string }[] | null) => (rows || []).map((row) => row.id).filter((id) => UUID_PATTERN.test(id))
    const clauses: string[] = []
    const listingIds = ids(listingMatches)
    const hostIds = ids(hostMatches)
    const guestIds = ids(guestMatches)
    if (listingIds.length) clauses.push(`listing_id.in.(${listingIds.join(',')})`)
    if (hostIds.length) clauses.push(`host_id.in.(${hostIds.join(',')})`)
    if (guestIds.length) clauses.push(`user_id.in.(${guestIds.join(',')})`)
    if (UUID_PATTERN.test(search)) clauses.push(`id.eq.${search.toLowerCase()}`)
    if (clauses.length) searchFilter = clauses.join(',')
    else searchMatchedNothing = true
  }

  let bookings: BookingRow[] = []
  let total = 0
  let queryError: string | null = null

  if (!searchMatchedNothing) {
    let query = supabase
      .from('bookings')
      .select(
        `id, listing_id, host_id, user_id, check_in, check_out, guests, status, payment_status,
        total_amount_usd, total_amount_ils, created_at,
        listings(id, title, area),
        hosts(id, name, user_id),
        guest:profiles!bookings_user_id_fkey(full_name)`,
        { count: 'exact' },
      )

    // "Not cancelled" must keep rows with a NULL status (neq alone drops them),
    // and it has to share one `or` tree with the search filter.
    const notCancelled = 'status.is.null,status.neq.cancelled'
    const excludeCancelled = view === 'upcoming' || view === 'past'
    if (excludeCancelled && searchFilter) {
      query = query.or(`and(or(${notCancelled}),or(${searchFilter}))`)
    } else if (excludeCancelled) {
      query = query.or(notCancelled)
    } else if (searchFilter) {
      query = query.or(searchFilter)
    }

    if (view === 'upcoming') {
      query = query.gte('check_out', today).order('check_in', { ascending: true })
    } else if (view === 'past') {
      query = query.lt('check_out', today).order('check_in', { ascending: false })
    } else if (view === 'cancelled') {
      query = query.eq('status', 'cancelled').order('check_in', { ascending: false })
    } else {
      query = query.order('check_in', { ascending: false })
    }

    const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (error) {
      queryError = error.message
    } else {
      bookings = ((data || []) as BookingQueryRow[]).map((row) => ({
        ...row,
        listings: oneOrNull(row.listings),
        hosts: oneOrNull(row.hosts),
        guest: oneOrNull(row.guest),
      }))
      total = count || 0
    }
  }

  // Without migration 114 admins cannot read bookings at all, so the list is
  // silently empty. Accepted enquiries link to their booking and ARE readable
  // by admins, so if any exist while no bookings come back, flag the migration.
  let missingAdminRead = false
  if (!queryError && total === 0 && !search) {
    const [{ count: anyVisible }, { count: linkedRequests }] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('booking_requests').select('id', { count: 'exact', head: true }).not('booking_id', 'is', null),
    ])
    missingAdminRead = (anyVisible || 0) === 0 && (linkedRequests || 0) > 0
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const viewLabel = VIEWS.find((option) => option.value === view)?.label.toLowerCase() || view

  return (
    <div>
      <header className="border-b border-stone-200 pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Bookings</h2>
        <p className="mt-1 text-sm text-stone-500">
          {total} {viewLabel} booking{total === 1 ? '' : 's'}
          {search ? ` matching “${search}”` : ''}
        </p>
      </header>

      <div className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Booking views" className="flex flex-wrap gap-2">
          {VIEWS.map((option) => (
            <Link
              key={option.value}
              href={viewHref(currentSearchParams, { view: option.value })}
              aria-current={view === option.value ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === option.value
                  ? 'bg-stone-950 text-white'
                  : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <form action="/admin/bookings" method="get" className="flex w-full gap-2 md:w-auto">
          {view !== 'upcoming' && <input type="hidden" name="view" value={view} />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search guest, listing or host"
            aria-label="Search bookings by guest, listing or host"
            className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55] md:w-72"
          />
          <button
            type="submit"
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Search
          </button>
          {search && (
            <Link
              href={viewHref(currentSearchParams, { q: '' })}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {queryError && (
        <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Bookings could not be loaded.</p>
          <p className="mt-1">{queryError}</p>
        </div>
      )}

      {missingAdminRead && (
        <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Bookings exist, but admins can’t read them yet.</p>
          <p className="mt-1">
            Accepted enquiries point to bookings, yet none are visible to your account. Run{' '}
            <code className="rounded bg-amber-100 px-1">supabase/migrations/114_admin_read_bookings.sql</code> in the
            Supabase SQL editor to give admins read access, then reload this page.
          </p>
        </div>
      )}

      {/* Phones: cards */}
      <div className="space-y-3 md:hidden">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/admin/bookings/${booking.id}`}
            className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-stone-950">{booking.listings?.title || 'Listing removed'}</p>
              <BookingBadge {...bookingStatusLabel(booking, today)} />
            </div>
            <p className="mt-1 text-sm text-stone-700">
              {formatDateRange(booking.check_in, booking.check_out)} ·{' '}
              {formatNights(bookingNights(booking.check_in, booking.check_out))}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">Guest</dt>
                <dd className="truncate text-stone-900">{bookingGuestName({ full_name: booking.guest?.full_name })}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">Host</dt>
                <dd className="truncate text-stone-900">{booking.hosts?.name || 'Host'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">Guests</dt>
                <dd className="text-stone-900">{formatGuestCount(booking.guests)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">Amount</dt>
                <dd className="font-semibold text-stone-900">{formatBookingAmount(booking)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

      {/* Tablet and up: table */}
      {bookings.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-stone-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase tracking-widest text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3">Listing</th>
                <th scope="col" className="px-4 py-3">Guest</th>
                <th scope="col" className="px-4 py-3">Host</th>
                <th scope="col" className="px-4 py-3">Dates</th>
                <th scope="col" className="px-4 py-3">Guests</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="align-top transition hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${booking.id}`} className="font-semibold text-stone-950 hover:underline">
                      {booking.listings?.title || 'Listing removed'}
                    </Link>
                    {booking.listings?.area && <p className="text-xs text-stone-500">{booking.listings.area}</p>}
                  </td>
                  <td className="px-4 py-3 text-stone-800">{bookingGuestName({ full_name: booking.guest?.full_name })}</td>
                  <td className="px-4 py-3 text-stone-800">{booking.hosts?.name || 'Host'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-800">
                    {formatDateRange(booking.check_in, booking.check_out)}
                    <p className="text-xs text-stone-500">{formatNights(bookingNights(booking.check_in, booking.check_out))}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-800">{Math.max(1, Number(booking.guests) || 1)}</td>
                  <td className="px-4 py-3">
                    <BookingBadge {...bookingStatusLabel(booking, today)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-stone-900">
                    {formatBookingAmount(booking)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookings.length === 0 && !queryError && !missingAdminRead && (
        <div className="rounded-2xl border border-dashed border-stone-200 py-12 text-center text-stone-500">
          {search
            ? `No ${viewLabel === 'all' ? '' : `${viewLabel} `}bookings match “${search}”.`
            : view === 'upcoming'
              ? 'No upcoming stays.'
              : `No ${viewLabel === 'all' ? '' : `${viewLabel} `}bookings yet.`}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} basePath="/admin/bookings" searchParams={currentSearchParams} />
      )}
    </div>
  )
}
