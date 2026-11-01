'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const LISTING_CARD_IMAGE_SIZES =
  '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'

// Swipeable photo strip for a listing card: native CSS scroll-snap (so touch
// swiping needs no JS), dots for position, and arrows on desktop hover. Only the
// first photo may load eagerly; the rest are lazy so a grid stays light.
export function ListingCardPhotos({
  href,
  title,
  photoUrls,
  priority = false,
}: {
  href: string
  title: string
  photoUrls: string[]
  priority?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = photoUrls.length

  function handleScroll() {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }

  function scrollTo(target: number) {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
  }

  if (count === 0) {
    return (
      <Link href={href} className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
          <p className="mt-1 text-xs text-stone-600">Photo coming soon</p>
        </div>
      </Link>
    )
  }

  return (
    <>
      <div
        ref={trackRef}
        onScroll={count > 1 ? handleScroll : undefined}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photoUrls.map((url, photoIndex) => (
          <Link
            key={url}
            href={href}
            className="relative h-full w-full shrink-0 snap-start snap-always"
            aria-label={photoIndex === 0 ? title : `${title}, photo ${photoIndex + 1} of ${count}`}
            tabIndex={photoIndex === 0 ? undefined : -1}
          >
            <Image
              src={url}
              alt={photoIndex === 0 ? title : ''}
              fill
              className="object-cover"
              sizes={LISTING_CARD_IMAGE_SIZES}
              {...(priority && photoIndex === 0 ? { priority: true } : { loading: 'lazy' as const })}
            />
          </Link>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollTo(Math.max(0, index - 1))}
            aria-label="Previous photo"
            className={`absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-sm transition hover:bg-white focus-visible:opacity-100 sm:flex sm:opacity-0 sm:group-hover:opacity-100 ${
              index === 0 ? 'pointer-events-none opacity-0!' : ''
            }`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(Math.min(count - 1, index + 1))}
            aria-label="Next photo"
            className={`absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-sm transition hover:bg-white focus-visible:opacity-100 sm:flex sm:opacity-0 sm:group-hover:opacity-100 ${
              index === count - 1 ? 'pointer-events-none opacity-0!' : ''
            }`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5" aria-hidden="true">
            {photoUrls.map((url, dotIndex) => (
              <span
                key={url}
                className={`h-1.5 w-1.5 rounded-full shadow-sm transition ${
                  dotIndex === index ? 'bg-white' : 'bg-white/55'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
