import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { HostAvailabilityCalendar } from '@/components/host-availability-calendar'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { addUnavailableRange, removeUnavailableRange } from './actions'

type HostListing = {
  id: string
  title: string
}

type UnavailableRange = {
  id: string
  listing_id: string
  start_date: string
  end_date: string
  reason: string | null
  listings?: {
    title: string
  } | null
}

export default async function HostCalendarPage() {
  const { supabase } = await requireHostDashboardAccess()
  const [{ data: listings }, { data: ranges }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title')
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_unavailable_ranges')
      .select('id, listing_id, start_date, end_date, reason, listings(title)')
      .order('start_date', { ascending: true }),
  ])

  const hostListings = (listings || []) as HostListing[]
  const unavailableRanges = (ranges || []) as UnavailableRange[]

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Calendar</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Keep availability accurate by blocking dates when a stay cannot be booked.
          </p>
        </div>

        {hostListings.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-stone-600 shadow-sm">
            Your calendar will appear once you have a live listing.
          </div>
        ) : (
          <>
            <HostAvailabilityCalendar
              listings={hostListings}
              addUnavailableRangeAction={addUnavailableRange}
            />

            <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className="border-b border-stone-100 px-6 py-4">
                <h2 className="text-lg font-bold text-stone-950">Blocked dates</h2>
              </div>

              {unavailableRanges.length === 0 ? (
                <div className="px-6 py-10 text-center text-stone-500">No blocked dates yet.</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {unavailableRanges.map((range) => (
                    <div
                      key={range.id}
                      className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_0.8fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-bold text-stone-950">{range.listings?.title || 'Stay'}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {range.reason || 'Unavailable'}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-stone-700">
                        {formatDate(range.start_date)} - {formatDate(range.end_date)}
                      </p>
                      <form action={removeUnavailableRange}>
                        <input type="hidden" name="rangeId" value={range.id} />
                        <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300">
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
