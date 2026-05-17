import Link from 'next/link'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

type HostApplication = {
  id: string
  status: string
}

type HostListing = {
  id: string
  is_published: boolean
}

export default async function HostDashboardPage() {
  const { supabase } = await requireHostDashboardAccess()
  const [{ data: applications }, { data: listings }] = await Promise.all([
    supabase.from('host_applications').select('id, status'),
    supabase.from('listings').select('id, is_published'),
  ])

  const hostApplications = (applications || []) as HostApplication[]
  const hostListings = (listings || []) as HostListing[]
  const liveCount = hostListings.filter((listing) => listing.is_published).length
  const reviewCount = hostApplications.filter((application) =>
    ['new', 'in_review'].includes(application.status),
  ).length

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Manage your hosting</h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Keep track of guest enquiries, listing status, and the practical work around each stay.
          </p>
          <Link
            href="/become-a-host"
            className="mt-5 inline-flex rounded-full bg-[#252525] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111111]"
          >
            Add another stay
          </Link>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Submitted stays" value={hostApplications.length} />
          <SummaryCard label="Live" value={liveCount} />
          <SummaryCard label="In review" value={reviewCount} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Link
            href="/host/dashboard/listings"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-stone-500">Your stays</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">Listings</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              See every stay, from submitted to live, with status and next steps in one place.
            </p>
          </Link>
          <Link
            href="/host/dashboard/messages"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-stone-500">Inbox</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">Messages</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Reply to guest enquiries and keep every conversation tied to its listing.
            </p>
          </Link>
          <Link
            href="/host/dashboard/payments"
            className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-stone-500">Get paid</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">Payment setup</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Add payout details separately from your stay listing so booking money can be sent to you.
            </p>
          </Link>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-stone-500">Coming next</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">Booking requests</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Approve or decline requests once booking flow is connected.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-stone-950">{value}</p>
    </div>
  )
}
