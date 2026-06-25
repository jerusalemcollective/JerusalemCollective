import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CleaningEnquiryForm } from '@/components/service-enquiry-forms'
import { getServicesBarEnabled } from '@/lib/platform-settings'

export const metadata = {
  title: 'Cleaning & Housekeeping',
  description: 'Professional cleaning for guests and hosts in Jerusalem. Mid-stay housekeeping and between-booking turnaround cleaning.',
  alternates: {
    canonical: '/services/cleaning',
  },
}

export default async function CleaningPage() {
  const servicesBarEnabled = await getServicesBarEnabled()

  if (!servicesBarEnabled) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-12 text-[#252525] md:px-6">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Cleaning & housekeeping</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">Housekeeping & Property Care</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-600">
          Professional, reliable cleaning arranged through JLM Collective — for guests who want a fresh mid-stay clean and hosts who need a fast turnaround between bookings.
        </p>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">For guests</p>
            <h2 className="mt-3 text-2xl font-bold text-stone-950">Mid-stay cleaning</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Staying for a week or more? We can arrange a fresh clean during your stay — linen change, bathroom clean, kitchen tidy, and rubbish removal.
            </p>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">For hosts</p>
            <h2 className="mt-3 text-2xl font-bold text-stone-950">Between-booking turnaround</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              We coordinate professional cleaning between every checkout and check-in. Same-day turnaround available. Consistent team assigned to your property.
            </p>
            <Link href="/host/dashboard" className="mt-4 inline-flex text-sm font-bold text-[#c76f55] hover:underline">
              Manage via your host dashboard →
            </Link>
          </article>
        </section>

        <section className="mt-10">
          <CleaningEnquiryForm />
        </section>
      </section>
    </main>
  )
}
