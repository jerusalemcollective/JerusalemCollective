'use client'

import { useState } from 'react'

// Preview-only image with graceful fallbacks: try the primary stock photo,
// then a secondary source, then reveal the illustrated scene behind it. Keeps
// the preview populated with real photography without ever showing a broken
// image icon. Not used on the live site.
export function PreviewImage({
  src,
  fallbackSrc,
  scene,
  alt,
}: {
  src: string
  fallbackSrc: string
  scene: string
  alt: string
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const current = stage === 0 ? src : stage === 1 ? fallbackSrc : null

  return (
    <span
      className="absolute inset-0 block bg-cover bg-center"
      style={{ backgroundImage: `url('${scene}')` }}
    >
      {current && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={alt}
          loading="lazy"
          onError={() => setStage((prev) => (prev + 1) as 0 | 1 | 2)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
    </span>
  )
}
