import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Home, Luggage } from 'lucide-react'

export function DashboardChooser({ displayName }: { displayName: string | null }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-stone-950 md:text-4xl">
            {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h1>
          <p className="mt-3 text-stone-600">Where would you like to go?</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DestinationCard
            href="/account"
            title="Guest dashboard"
            description="Browse stays, manage your trips, enquiries and messages."
            cta="Continue as guest"
            icon={<Luggage className="h-6 w-6" />}
            iconClass="bg-[#fff4ef] text-[#c76f55]"
          />
          <DestinationCard
            href="/host/dashboard"
            title="Host dashboard"
            description="Manage your listings, calendar, bookings and host messages."
            cta="Continue as host"
            icon={<Home className="h-6 w-6" />}
            iconClass="bg-[#252525] text-white"
          />
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          You can switch anytime from the menu in either dashboard.
        </p>
      </div>
    </div>
  )
}

function DestinationCard({
  href,
  title,
  description,
  cta,
  icon,
  iconClass,
}: {
  href: string
  title: string
  description: string
  cta: string
  icon: ReactNode
  iconClass: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-start rounded-3xl bg-white p-8 text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#f0c2b3]"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}>
        {icon}
      </span>
      <span className="mt-5 text-xl font-bold text-stone-950">{title}</span>
      <span className="mt-2 text-sm leading-6 text-stone-600">{description}</span>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#c76f55]">
        {cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
