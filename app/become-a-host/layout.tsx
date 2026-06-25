import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'List Your Jerusalem Stay',
  description:
    'Submit a Jerusalem short-term stay to JLM Collective with photos, amenities, pricing, and host verification.',
  alternates: {
    canonical: '/become-a-host',
  },
}

export default function BecomeAHostLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
