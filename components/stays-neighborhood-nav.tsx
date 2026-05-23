'use client'

import Link from 'next/link'

type StaysNeighborhoodNavProps = {
  neighborhoods: string[]
  selectedArea: string
  baseQuery: Record<string, string>
}

export function StaysNeighborhoodNav({
  neighborhoods,
  selectedArea,
  baseQuery,
}: StaysNeighborhoodNavProps) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {neighborhoods.map((area) => (
        <Link
          key={area}
          href={buildNeighborhoodHref(baseQuery, area)}
          onClick={() => {
            if (area !== 'All' && area !== selectedArea) {
              void fetch('/api/neighborhood-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ neighborhood: area, source: 'stays_filter' }),
              })
            }
          }}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
            selectedArea === area
              ? 'bg-stone-950 text-white'
              : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
          }`}
        >
          {area}
        </Link>
      ))}
    </div>
  )
}

function buildNeighborhoodHref(baseQuery: Record<string, string>, area: string) {
  const params = new URLSearchParams(baseQuery)

  if (area === 'All') {
    params.delete('neighborhood')
    params.delete('area')
  } else {
    params.set('neighborhood', area)
    params.delete('area')
  }

  const query = params.toString()
  return query ? `/stays?${query}` : '/stays'
}
