import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SessionTimeout } from '@/components/session-timeout'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter'
})

export const metadata: Metadata = {
  metadataBase: new URL('https://jlmcollective.co'),
  title: {
    default: 'JLM Collective | Jerusalem Short-Term Stays',
    template: '%s | JLM Collective',
  },
  description:
    'Find verified short-term apartments and stays in Jerusalem with clear details, local neighbourhood search, and simple booking enquiries.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'JLM Collective | Jerusalem Short-Term Stays',
    description:
      'Find verified short-term apartments and stays in Jerusalem with clear details, local neighbourhood search, and simple booking enquiries.',
    url: 'https://jlmcollective.co',
    siteName: 'JLM Collective',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#F8F5F2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-[#F8F5F2] text-[#252525]`}>
        <Header />
        <SessionTimeout />
        <main>{children}</main>
        <Footer />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
