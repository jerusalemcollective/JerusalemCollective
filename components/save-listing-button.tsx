'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { recordListingEngagement } from '@/lib/listing-engagement'

export function SaveListingButton({ listingId }: { listingId: string }) {
  const [saved, setSaved] = useState(false)
  const [optimisticSaved, setOptimisticSaved] = useState(false)
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
      setOptimisticSaved(Boolean(data))
      setLoading(false)
    }

    void loadSavedState()
  }, [listingId])

  useEffect(() => {
    setOptimisticSaved(saved)
  }, [saved])

  async function toggleSaved() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/listings/${listingId}`)}`)
      return
    }

    const newValue = !optimisticSaved
    setOptimisticSaved(newValue)

    try {
      if (newValue) {
        const { error } = await supabase.from('saved_listings').insert({
          listing_id: listingId,
          user_id: user.id,
        })
        if (error) throw error
        setSaved(true)
        void recordListingEngagement(supabase, listingId, 'save')
      } else {
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('listing_id', listingId)
          .eq('user_id', user.id)
        if (error) throw error
        setSaved(false)
      }
    } catch (error) {
      // Surface the real reason instead of silently reverting, so a blocked
      // save (RLS, a constraint, a missing column) is visible rather than
      // looking like a dead button.
      setOptimisticSaved(!newValue)
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Could not update your saved list. Please try again.'
      console.error('Save listing failed:', error)
      toast.error(message)
    }
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        optimisticSaved
          ? 'border-[#c76f55] bg-white text-[#c76f55]'
          : 'border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
      }`}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={optimisticSaved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span aria-hidden="true">{optimisticSaved ? 'Saved' : 'Save'}</span>
    </button>
  )
}
