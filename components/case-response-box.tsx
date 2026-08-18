'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Lets the party viewing a report add their side, and shows the other party's
// response if they've added one. Writes go through the add_support_case_response
// RPC, which routes the text to the caller's own column.
export function CaseResponseBox({
  caseId,
  ownResponse,
  counterpartyResponse,
  counterpartyLabel,
}: {
  caseId: string
  ownResponse: string | null
  counterpartyResponse: string | null
  counterpartyLabel: string
}) {
  const router = useRouter()
  const [text, setText] = useState(ownResponse || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!text.trim()) {
      setError('Write your response first.')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('add_support_case_response', {
        target_case_id: caseId,
        response_text: text.trim(),
      })
      if (rpcError) throw rpcError
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your response. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      {counterpartyResponse && (
        <div className="mb-3 rounded-xl bg-[#F8F5F2] p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">{counterpartyLabel}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{counterpartyResponse}</p>
        </div>
      )}
      <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Your side</p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setSaved(false)
        }}
        rows={3}
        className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-2 rounded-full bg-stone-950 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : ownResponse ? 'Update your response' : 'Add your response'}
      </button>
    </div>
  )
}
