'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Opens (or reuses) a direct chat between the host and JLM Collective's admin,
// then drops the host into their messages where the thread lives.
export function ContactJlmButton() {
  const router = useRouter()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsOpening(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('get_or_create_jlm_conversation')
      if (rpcError) throw rpcError
      router.push('/account/messages')
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open the chat. Please try again.')
      setIsOpening(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isOpening}
        className="inline-flex items-center gap-2 rounded-full bg-[#252525] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LifeBuoy className="h-4 w-4" />
        {isOpening ? 'Opening…' : 'Contact JLM'}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
