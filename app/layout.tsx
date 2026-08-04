import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Toaster } from '@/components/ui/sonner'
import { SessionTimeout } from '@/components/session-timeout'
import { getServicesBarEnabled } from '@/lib/platform-settings'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://jlmcollective.co'),
  title: {
    default: 'Jerusalem Short-Term Stays | JLM Collective',
    template: '%s | JLM Collective',
  },
  description:
    'Find verified short-term apartments and stays in Jerusalem with clear details, local neighbourhood search, and simple booking enquiries.',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Jerusalem Short-Term Stays | JLM Collective',
    description:
      'Find verified short-term apartments and stays in Jerusalem with clear details, local neighbourhood search, and simple booking enquiries.',
    url: '/',
    siteName: 'JLM Collective',
    images: [
      {
        url: '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
        width: 1200,
        height: 630,
        alt: 'JLM Collective',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  themeColor: '#F8F5F2',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const servicesBarEnabled = await getServicesBarEnabled()

  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable} font-sans antialiased bg-[#F8F5F2] text-[#252525]`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'JLM Collective',
              url: 'https://jlmcollective.co',
              logo: 'https://jlmcollective.co/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
            }),
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-stone-900 focus:shadow"
        >
          Skip to content
        </a>
        <Header servicesBarEnabled={servicesBarEnabled} />
        <SessionTimeout />
        <main id="main-content">{children}</main>
        <Footer />
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
