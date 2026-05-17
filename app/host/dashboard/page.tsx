import Link from 'next/link'

export default function HostDashboardPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
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

        <div className="grid gap-4 md:grid-cols-3">
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
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-stone-500">Coming next</p>
            <h2 className="mt-2 text-xl font-bold text-stone-950">Listings</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Review live listings, draft details, and verification status.
            </p>
          </div>
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
