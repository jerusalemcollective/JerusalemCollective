'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SavedPage() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=/account/saved')
        return
      }
      setIsLoading(false)
    }
    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F5F2]">
        <div className="text-stone-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      <Header />
      
      <main className="mx-auto max-w-4xl px-5 py-10 md:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/account" className="hover:text-[#c76f55]">Account</Link>
          <span>/</span>
          <span className="text-stone-900">Saved</span>
        </div>

        <h1 className="mb-8 text-3xl font-bold text-stone-900">Saved Stays</h1>

        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
            <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-stone-900">No saved stays</h2>
          <p className="mb-6 text-stone-600">
            Tap the heart on any stay to save it here.
          </p>
          <Link
            href="/stays"
            className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b5624a]"
          >
            Explore stays
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
