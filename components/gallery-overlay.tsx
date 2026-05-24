'use client'

import { useCallback, useEffect, useRef, type TouchEvent } from 'react'
import Image from 'next/image'

export type GalleryPhoto = {
  id: string
  photo_url: string
  is_cover: boolean | null
}

type GalleryOverlayProps = {
  photos: GalleryPhoto[]
  index: number
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function GalleryOverlay({ photos, index, title, onClose, onIndexChange }: GalleryOverlayProps) {
  const total = photos.length
  const currentPhoto = photos[index] ?? photos[0]
  const touchStartX = useRef<number | null>(null)
  const prev = useCallback(() => {
    if (total === 0) return
    onIndexChange((index - 1 + total) % total)
  }, [index, onIndexChange, total])
  const next = useCallback(() => {
    if (total === 0) return
    onIndexChange((index + 1) % total)
  }, [index, onIndexChange, total])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') prev()
      if (event.key === 'ArrowRight') next()
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, onClose, prev])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    if (delta > 50) prev()
    else if (delta < -50) next()
    touchStartX.current = null
  }

  if (!currentPhoto) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
        <p className="text-sm font-semibold text-stone-950">{title}</p>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500">{index + 1} / {total}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label="Close gallery"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center bg-[#F8F5F2] px-6 py-6 md:px-24 md:py-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 z-10 rounded-full bg-white/90 p-3 text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-white hover:text-stone-950"
          aria-label="Previous photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <img
          key={currentPhoto.id}
          src={currentPhoto.photo_url}
          alt={`${title} - photo ${index + 1}`}
          loading="lazy"
          className="block h-auto max-h-[68vh] w-auto max-w-[82vw] rounded-xl object-contain shadow-xl"
        />

        <button
          type="button"
          onClick={next}
          className="absolute right-4 z-10 rounded-full bg-white/90 p-3 text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-white hover:text-stone-950"
          aria-label="Next photo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-stone-100 bg-white px-6 py-4">
        {photos.map((photo, thumbIndex) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => onIndexChange(thumbIndex)}
            className={`shrink-0 overflow-hidden rounded-lg transition ${
              thumbIndex === index
                ? 'opacity-100 ring-2 ring-[#c76f55]'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <Image
              src={photo.photo_url}
              alt=""
              width={96}
              height={64}
              loading="lazy"
              className="h-16 w-24 object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
