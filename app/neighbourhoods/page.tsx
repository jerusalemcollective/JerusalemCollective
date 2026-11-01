import type { Metadata } from 'next'
import Link from 'next/link'
import {
  findNeighborhoodBySlug,
  neighborhoodDescriptions,
  slugifyNeighborhood,
} from '@/lib/neighborhood-pages'
import { ogImages, ogTwitterImages } from '@/lib/og'
import { createPublicClient } from '@/lib/supabase/public'
import { getLiveAreaSet } from '@/lib/live-areas'

// Hourly so a neighbourhood appears soon after its first stay is published.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Jerusalem Neighbourhoods for Short-Term Stays',
  description:
    'Explore Jerusalem neighbourhood by neighbourhood — Rechavia, the German Colony, Katamon, Baka, Nachlaot, Har Nof, Ramat Eshkol and more — to find the right base for your stay.',
  alternates: { canonical: '/neighbourhoods' },
  openGraph: {
    title: 'Jerusalem Neighbourhoods | JLM Collective',
    description: 'Find the right Jerusalem neighbourhood for your stay — community, shuls, and walking distance to the Kotel.',
    url: '/neighbourhoods',
    type: 'website',
    ...ogImages('Jerusalem neighbourhoods for your stay'),
  },
  twitter: { card: 'summary_large_image', images: ogTwitterImages('Jerusalem neighbourhoods for your stay') },
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.]*\./)
  return match ? match[0] : text
}

async function loadLiveAreaSet() {
  try {
    return await getLiveAreaSet(createPublicClient())
  } catch {
    return null
  }
}

export default async function NeighbourhoodsIndexPage() {
  // Only neighbourhoods with at least one published stay; every one if the read
  // fails. Match on the area name the neighbourhood page itself queries, so an
  // alternate spelling (e.g. "Talbieh") counts its canonical area's listings.
  const liveAreas = await loadLiveAreaSet()
  const seen = new Set<string>()
  const neighbourhoods = Object.entries(neighborhoodDescriptions)
    .filter(([, description]) => {
      if (seen.has(description)) return false
      seen.add(description)
      return true
    })
    .map(([name, description]) => ({
      name,
      slug: slugifyNeighborhood(name),
      teaser: firstSentence(description),
    }))
    .filter((neighbourhood) => {
      if (!liveAreas) return true
      const pageArea = findNeighborhoodBySlug(neighbourhood.slug) ?? neighbourhood.name
      return liveAreas.has(pageArea)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/stays" className="hover:text-[#c76f55]">
            Stays
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-stone-900">Neighbourhoods</span>
        </nav>

        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Explore</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">
          Jerusalem neighbourhoods
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
          Every Jerusalem neighbourhood has its own character — its community, its shuls, its walking
          distance to the Kotel, and its pace of life. Explore them below to find the right base for your stay.
        </p>

        {neighbourhoods.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-stone-200 bg-white p-8 text-center">
            <p className="font-heading text-lg font-semibold text-stone-950">No neighbourhoods have stays yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
              We&apos;re curating our first Jerusalem stays. Check back soon, or send an enquiry and our
              local team will help you find the right place.
            </p>
            <Link
              href="/stays"
              className="mt-5 inline-flex rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]"
            >
              Browse all stays
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {neighbourhoods.map((neighbourhood) => (
              <Link
                key={neighbourhood.slug}
                href={`/neighbourhoods/${neighbourhood.slug}`}
                className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-[#c76f55] hover:shadow-sm"
              >
                <p className="font-heading text-lg font-semibold text-stone-950 transition group-hover:text-[#c76f55]">
                  {neighbourhood.name}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{neighbourhood.teaser}</p>
                <span className="mt-3 inline-flex text-sm font-semibold text-[#c76f55]">
                  View stays {'→'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
