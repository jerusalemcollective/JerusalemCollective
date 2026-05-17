'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/account" className="hover:text-[#c76f55]">Account</Link>
          <span>/</span>
          <span className="text-stone-900">Saved</span>
        </div>

        <h1 className="mb-8 text-3xl font-bold text-stone-900">Saved Stays</h1>

        <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <img 
              src="/icons/yemin-moshe-save-ui-large.webp" 
              alt="" 
              className="h-20 w-20 object-contain opacity-40"
            />
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
      </div>
    </div>
  )
}
