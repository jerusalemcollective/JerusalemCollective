import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jerusalem Stays',
  description:
    'Browse verified short-term stays in Jerusalem by neighbourhood, bedrooms, and amenities including sukkah and kosher kitchen.',
  alternates: {
    canonical: '/stays',
  },
}

export default function StaysLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
