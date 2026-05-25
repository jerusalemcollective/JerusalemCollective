'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type StaysNeighborhoodNavProps = {
  neighborhoods: string[]
  featuredNeighborhoods: string[]
  selectedArea: string
  baseQuery: Record<string, string>
}

export function StaysNeighborhoodNav({
  neighborhoods,
  featuredNeighborhoods,
  selectedArea,
  baseQuery,
}: StaysNeighborhoodNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const visibleAreas = useMemo(() => {
    const selectedExtra =
      selectedArea !== 'All' && !featuredNeighborhoods.includes(selectedArea)
        ? [selectedArea]
        : []

    return [...featuredNeighborhoods, ...selectedExtra].filter(
      (area, index, areas) => areas.indexOf(area) === index,
    )
  }, [featuredNeighborhoods, selectedArea])
  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const areas = normalizedQuery
      ? neighborhoods.filter((area) => area.toLowerCase().includes(normalizedQuery))
      : neighborhoods

    return areas.filter((area) => area !== 'All')
  }, [neighborhoods, query])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AreaLink
        area="All"
        label="All Jerusalem"
        selectedArea={selectedArea}
        baseQuery={baseQuery}
      />
      {visibleAreas.map((area) => (
        <AreaLink
          key={area}
          area={area}
          label={area}
          selectedArea={selectedArea}
          baseQuery={baseQuery}
        />
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-[#c76f55] hover:text-[#c76f55]"
        >
          Areas
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="border-b border-stone-100 p-3">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search neighbourhood"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredAreas.map((area) => (
                <Link
                  key={area}
                  href={buildNeighborhoodHref(baseQuery, area)}
                  onClick={() => {
                    setIsOpen(false)
                    trackNeighborhoodSearch(area, selectedArea)
                  }}
                  className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    selectedArea === area
                      ? 'bg-stone-950 text-white'
                      : 'text-stone-700 hover:bg-stone-50 hover:text-[#c76f55]'
                  }`}
                >
                  {area}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AreaLink({
  area,
  label,
  selectedArea,
  baseQuery,
}: {
  area: string
  label: string
  selectedArea: string
  baseQuery: Record<string, string>
}) {
  return (
    <Link
      href={buildNeighborhoodHref(baseQuery, area)}
      onClick={() => trackNeighborhoodSearch(area, selectedArea)}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
        selectedArea === area
          ? 'bg-stone-950 text-white'
          : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
      }`}
    >
      {label}
    </Link>
  )
}

function trackNeighborhoodSearch(area: string, selectedArea: string) {
  if (area !== 'All' && area !== selectedArea) {
    void fetch('/api/neighborhood-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neighborhood: area, source: 'stays_filter' }),
    })
  }
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
