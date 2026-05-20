import Link from 'next/link'

export const metadata = {
  title: 'Calendar sync help | JLM Collective',
}

export default function CalendarSyncHelpPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host help</p>
        <h1 className="mt-2 text-3xl font-bold text-stone-950">How to find your iCal URL</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Most calendar and booking platforms let you copy a private iCal link. Paste that link into your JLM Collective listing and we will block matching dates automatically.
        </p>

        <div className="mt-8 space-y-6">
          <HelpStep
            title="Google Calendar"
            text="Open calendar settings, choose the calendar, then copy the secret address in iCal format."
          />
          <HelpStep
            title="Apple Calendar"
            text="Open the calendar sharing settings and copy the private calendar address if one is available."
          />
          <HelpStep
            title="Airbnb"
            text="Open the listing calendar, choose availability settings, then export calendar and copy the iCal link."
          />
          <HelpStep
            title="Booking.com"
            text="Open rates and availability, choose sync calendars, then copy the export calendar link."
          />
        </div>

        <Link
          href="/host/dashboard/listings"
          className="mt-8 inline-flex rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
        >
          Back to listings
        </Link>
      </section>
    </main>
  )
}

function HelpStep({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-t border-stone-100 pt-5">
      <h2 className="font-bold text-stone-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
    </section>
  )
}
