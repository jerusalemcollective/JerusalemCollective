import type { Metadata } from 'next'
import Link from 'next/link'
import { neighborhoodDescriptions, slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { ogImages, ogTwitterImages } from '@/lib/og'

export const revalidate = 86400

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

export default function NeighbourhoodsIndexPage() {
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
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-white">
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

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {neighbourhoods.map((neighbourhood) => (
            <Link
              key={neighbourhood.slug}
              href={`/neighbourhoods/${neighbourhood.slug}`}
              className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-[#c76f55] hover:shadow-sm"
            >
              <p className="font-display text-lg font-bold text-stone-950 transition group-hover:text-[#c76f55]">
                {neighbourhood.name}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{neighbourhood.teaser}</p>
              <span className="mt-3 inline-flex text-sm font-semibold text-[#c76f55]">
                View stays {'→'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
