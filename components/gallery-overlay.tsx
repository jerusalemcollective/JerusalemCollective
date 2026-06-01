'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react'
import Image from 'next/image'

export type GalleryPhoto = {
  id: string
  photo_url: string
  is_cover: boolean | null
  label: string | null
}

type GalleryOverlayProps = {
  photos: GalleryPhoto[]
  index: number
  title: string
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function GalleryOverlay({
  photos,
  index,
  title,
  onClose,
  onIndexChange,
}: GalleryOverlayProps) {
  const total = photos.length
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffsetPercent, setDragOffsetPercent] = useState(0)

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
    touchStartY.current = event.touches[0].clientY
    setIsDragging(true)
    setDragOffsetPercent(0)
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (touchStartX.current === null) return
    const deltaX = event.touches[0].clientX - touchStartX.current
    const deltaY = Math.abs(event.touches[0].clientY - (touchStartY.current ?? 0))

    if (Math.abs(deltaX) > deltaY) {
      setDragOffsetPercent((deltaX / window.innerWidth) * 100)
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    setIsDragging(false)
    setDragOffsetPercent(0)
    if (delta > 60) prev()
    else if (delta < -60) next()
    touchStartX.current = null
    touchStartY.current = null
  }

  if (total === 0) return null

  const translateX = -(index * 100) + (isDragging ? dragOffsetPercent : 0)
  const currentPhoto = photos[index]
  const currentLabel = currentPhoto?.label?.trim()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-stone-950">{title}</p>
          {currentLabel && (
            <p className="mt-0.5 text-xs font-medium text-stone-500">{currentLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-950"
            aria-label="Close gallery"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-[#F8F5F2]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: isDragging
              ? 'none'
              : 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            willChange: 'transform',
          }}
        >
          {photos.map((photo, photoIndex) => (
            <div
              key={photo.id}
              className="flex h-full w-full shrink-0 items-center justify-center px-5 py-8 md:px-28 md:py-10"
              style={{ minWidth: '100%' }}
            >
              <img
                src={photo.photo_url}
                alt={photo.label ? `${title} - ${photo.label}` : `${title} - photo ${photoIndex + 1}`}
                loading={Math.abs(photoIndex - index) <= 1 ? 'eager' : 'lazy'}
                className="block h-auto max-h-[58vh] w-auto max-w-[78vw] select-none rounded-2xl object-contain shadow-xl md:max-h-[62vh] md:max-w-[70vw]"
                draggable={false}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={prev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-3 text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-white hover:text-stone-950"
          aria-label="Previous photo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={next}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-3 text-stone-600 shadow-sm ring-1 ring-stone-200 transition hover:bg-white hover:text-stone-950"
          aria-label="Next photo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {currentLabel && (
          <div className="absolute bottom-5 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200">
            {currentLabel}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-stone-100 bg-white px-6 py-4">
        {photos.map((photo, thumbIndex) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => onIndexChange(thumbIndex)}
            className={`shrink-0 overflow-hidden rounded-lg transition-all duration-200 ${
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
