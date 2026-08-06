'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ChooserSignOut() {
  const [pending, setPending] = useState(false)

  const handleSignOut = async () => {
    setPending(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="font-medium text-stone-500 underline-offset-4 transition hover:text-[#c76f55] hover:underline disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Not you? Sign out'}
    </button>
  )
}
