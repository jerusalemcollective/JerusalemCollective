'use client'

import Link from 'next/link'

export function HomeMapSection() {
  return (
    <aside id="map" className="sticky top-24 hidden h-[380px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block">
      <div className="relative h-full bg-[#E9DFD2]">
        {/* Illustrative price pins until this homepage preview is connected to live listing prices. */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(#cdbfad 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="absolute left-4 top-4 rounded-xl bg-white px-3 py-2 shadow-md">
          <div className="text-xs font-bold">Map view</div>
          <div className="text-[10px] text-stone-500">Browse by area</div>
        </div>
        <Link href="/map" className="absolute right-4 top-4 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-stone-800 shadow-md transition hover:bg-stone-50">
          Full screen
        </Link>
        <Link href="/map" className="absolute left-[38%] top-[26%] rounded-lg bg-[#c76f55] px-2 py-1 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5">&#8362;14.9k</Link>
        <Link href="/map" className="absolute left-[56%] top-[42%] rounded-lg bg-[#c76f55] px-2 py-1 text-xs font-bold text-white shadow-lg transition hover:-translate-y-0.5">&#8362;18.5k</Link>
        <Link href="/map" className="absolute left-[24%] top-[58%] rounded-lg bg-white px-2 py-1 text-xs font-bold text-stone-800 shadow-lg transition hover:-translate-y-0.5">&#8362;12.9k</Link>
        <Link href="/map" className="absolute left-[48%] top-[70%] rounded-lg bg-white px-2 py-1 text-xs font-bold text-stone-800 shadow-lg transition hover:-translate-y-0.5">&#8362;15.9k</Link>
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-[#c76f55]" />
              <div>
                <div className="text-xs font-bold">Open full map</div>
                <div className="text-[10px] text-stone-500">View prices and areas</div>
              </div>
            </div>
            <Link href="/map" className="rounded-full bg-[#252525] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#111111]">
              Open
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}
