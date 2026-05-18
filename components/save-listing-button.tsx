'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recordListingEngagement } from '@/lib/listing-engagement'

export function SaveListingButton({ listingId }: { listingId: string }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadSavedState() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('saved_listings')
        .select('id')
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
        .maybeSingle()

      setSaved(Boolean(data))
      setLoading(false)
    }

    void loadSavedState()
  }, [listingId])

  async function toggleSaved() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/listings/${listingId}`)}`)
      return
    }

    setLoading(true)

    if (saved) {
      await supabase
        .from('saved_listings')
        .delete()
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
      setSaved(false)
    } else {
      const { error } = await supabase.from('saved_listings').insert({
        listing_id: listingId,
        user_id: user.id,
      })

      if (!error) {
        setSaved(true)
        await recordListingEngagement(supabase, listingId, 'save')
      }
    }

    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-[#c76f55] hover:text-[#c76f55] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span aria-hidden="true">{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}
