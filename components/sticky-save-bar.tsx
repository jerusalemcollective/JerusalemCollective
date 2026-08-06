'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
    >
      {pending ? 'Saving...' : 'Save changes'}
    </button>
  )
}

// A sticky bottom bar with the single save button. The button is tied to the
// main edit form via the HTML `form` attribute, so this bar can live outside the
// form in the DOM. It watches the form for edits to show an "Unsaved changes"
// hint. Must be rendered INSIDE the same <form> so useFormStatus sees it.
export function StickySaveBar({ formId }: { formId: string }) {
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return

    const markDirty = () => setDirty(true)
    const markClean = () => setDirty(false)

    form.addEventListener('input', markDirty)
    form.addEventListener('change', markDirty)
    form.addEventListener('submit', markClean)

    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('change', markDirty)
      form.removeEventListener('submit', markClean)
    }
  }, [formId])

  return (
    <div className="sticky bottom-4 z-30 mt-6 flex items-center justify-end gap-4 rounded-full border border-stone-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
      {dirty ? (
        <span className="text-sm font-semibold text-[#c76f55]">Unsaved changes</span>
      ) : (
        <span className="text-sm text-stone-400">All changes saved</span>
      )}
      <SaveButton />
    </div>
  )
}
