import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getServicesBarEnabled } from '@/lib/platform-settings'

export const metadata = {
  title: 'Guest Services | JLM Collective',
  description: 'Enhance your Jerusalem stay with custom catering, Shabbat meal packages, and housekeeping arranged by JLM Collective.',
}

export default async function ServicesPage() {
  const servicesBarEnabled = await getServicesBarEnabled()

  if (!servicesBarEnabled) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-12 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">For guests & hosts</p>
        <h1 className="font-display mt-3 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">JLM Services</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-600">
          Everything you need for a perfect Jerusalem stay — arranged by us, delivered to your door.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <ServiceCard
            href="/services/catering"
            title="Custom Menus & Shabbat Packages"
            description="Kosher meals, Shabbat packages, and Yom Tov menus delivered to your property. Tell us your dates and we arrange the rest."
            buttonLabel="Order food"
            icon={<ForkKnifeIcon />}
          />
          <ServiceCard
            href="/services/cleaning"
            title="Housekeeping & Property Care"
            description="Mid-stay cleaning for guests and turnaround cleaning for hosts. Available across Jerusalem."
            buttonLabel="Book cleaning"
            icon={<SparklesIcon />}
          />
        </div>

        <section className="mt-8 rounded-3xl bg-white/70 p-6 text-stone-700">
          <p className="text-sm leading-6">
            Are you a host? We also help hosts keep their properties guest-ready between bookings.
          </p>
          <Link href="/host/dashboard" className="mt-3 inline-flex text-sm font-bold text-[#c76f55] hover:underline">
            Go to host dashboard →
          </Link>
        </section>
      </section>
    </main>
  )
}

function ServiceCard({
  href,
  title,
  description,
  buttonLabel,
  icon,
}: {
  href: string
  title: string
  description: string
  buttonLabel: string
  icon: ReactNode
}) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4ef] text-[#c76f55]">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-bold text-stone-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">{description}</p>
      <Link href={href} className="mt-6 inline-flex rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111]">
        {buttonLabel}
      </Link>
    </article>
  )
}

function ForkKnifeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}
