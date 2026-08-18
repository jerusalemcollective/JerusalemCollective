import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Home, Luggage, ShieldCheck } from 'lucide-react'
import { ChooserSignOut } from '@/components/chooser-sign-out'

export function DashboardChooser({
  displayName,
  isHost = true,
  isAdmin = false,
}: {
  displayName: string | null
  isHost?: boolean
  isAdmin?: boolean
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F8F5F2] p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <Image
            src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
            alt="JLM Collective"
            width={512}
            height={128}
            priority
            className="mx-auto h-9 w-auto"
          />
          <h1 className="font-display mt-8 text-3xl font-bold text-stone-950 md:text-4xl">
            {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
          </h1>
          <p className="mt-3 text-stone-600">Where would you like to go?</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <DestinationCard
            href="/account"
            title="Guest dashboard"
            description="Browse stays, manage your trips, enquiries and messages."
            cta="Continue as guest"
            icon={<Luggage className="h-6 w-6" />}
            iconClass="bg-[#fff4ef] text-[#c76f55]"
          />
          {isHost && (
            <DestinationCard
              href="/host/dashboard"
              title="Host dashboard"
              description="Manage your listings, calendar, bookings and host messages."
              cta="Continue as host"
              icon={<Home className="h-6 w-6" />}
              iconClass="bg-[#252525] text-white"
            />
          )}
          {isAdmin && (
            <DestinationCard
              href="/admin"
              title="Admin workspace"
              description="Review applications, listings, payments and support cases."
              cta="Continue as admin"
              icon={<ShieldCheck className="h-6 w-6" />}
              iconClass="bg-[#c76f55] text-white"
            />
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-xs text-stone-500">
          <p>You can switch anytime from the menu in either dashboard.</p>
          <ChooserSignOut />
        </div>
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
      className="group flex w-full flex-col items-start rounded-3xl bg-white p-8 text-left shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#f0c2b3] sm:w-[calc(50%-0.5rem)]"
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
