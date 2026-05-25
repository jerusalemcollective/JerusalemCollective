'use client'

import dynamic from 'next/dynamic'

export const RecentlyViewed = dynamic(
  () => import('@/components/recently-viewed').then((mod) => mod.RecentlyViewed),
  { ssr: false },
)
