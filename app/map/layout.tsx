import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jerusalem Stay Map | JLM Collective',
  description:
    'Explore verified Jerusalem stays on a map and filter by bedrooms and practical amenities.',
}

export default function MapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
