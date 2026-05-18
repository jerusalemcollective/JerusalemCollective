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
  title: 'JLM Collective - Jerusalem Short-term Rentals',
  description: 'Find verified short-term apartments in Jerusalem with clear availability and simple booking.',
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
