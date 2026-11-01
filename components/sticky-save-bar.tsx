'use client'

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useFormStatus } from 'react-dom'

export type SaveFormState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type SaveStateContextValue = {
  state: SaveFormState
  pending: boolean
}

const SaveStateContext = createContext<SaveStateContextValue | null>(null)

const initialSaveFormState: SaveFormState = { status: 'idle', message: '' }

// A form whose save result comes back from the server action. It submits via
// onSubmit + startTransition (not the `action` prop) so React doesn't reset the
// fields after saving, and shares the result with StickySaveBar so the bar only
// says "saved" once the server has confirmed it.
export function SaveStateForm({
  id,
  action,
  className,
  children,
}: {
  id: string
  action: (prev: SaveFormState, formData: FormData) => Promise<SaveFormState>
  className?: string
  children: ReactNode
}) {
  const [state, formAction, pending] = useActionState<SaveFormState, FormData>(action, initialSaveFormState)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    <SaveStateContext.Provider value={{ state, pending }}>
      <form id={id} onSubmit={handleSubmit} className={className}>
        {children}
      </form>
    </SaveStateContext.Provider>
  )
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
    >
      {pending ? 'Saving...' : 'Save changes'}
    </button>
  )
}

// A sticky bottom bar with the single save button. It watches the form for
// edits to show an "Unsaved changes" hint. Must be rendered INSIDE the same
// <form>. Inside a SaveStateForm it shows, in order: Saving... / the error /
// Unsaved changes / All changes saved — and only a confirmed success clears the
// unsaved flag.
export function StickySaveBar({ formId }: { formId: string }) {
  const saveState = useContext(SaveStateContext)
  const { pending: formPending } = useFormStatus()
  const pending = saveState ? saveState.pending : formPending
  const hasSaveState = saveState !== null
  const [dirty, setDirty] = useState(false)
  // Count edits so a success only clears "unsaved" when nothing was changed
  // after that save was sent.
  const editCountRef = useRef(0)
  const submittedEditCountRef = useRef(0)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return

    const markDirty = () => {
      editCountRef.current += 1
      setDirty(true)
    }
    const recordSubmit = () => {
      submittedEditCountRef.current = editCountRef.current
      // A plain form (no server result to wait for) keeps the old behaviour.
      if (!hasSaveState) setDirty(false)
    }

    form.addEventListener('input', markDirty)
    form.addEventListener('change', markDirty)
    form.addEventListener('submit', recordSubmit)

    return () => {
      form.removeEventListener('input', markDirty)
      form.removeEventListener('change', markDirty)
      form.removeEventListener('submit', recordSubmit)
    }
  }, [formId, hasSaveState])

  const state = saveState?.state

  useEffect(() => {
    if (state?.status === 'success' && editCountRef.current === submittedEditCountRef.current) {
      setDirty(false)
    }
  }, [state])

  let statusLabel: ReactNode
  if (pending) {
    statusLabel = <span className="text-sm font-semibold text-stone-500">Saving...</span>
  } else if (state?.status === 'error') {
    statusLabel = (
      <span role="alert" className="text-sm font-semibold text-rose-600">
        {state.message || 'Could not save — please try again or contact JLM.'}
      </span>
    )
  } else if (dirty) {
    statusLabel = <span className="text-sm font-semibold text-[#c76f55]">Unsaved changes</span>
  } else {
    statusLabel = <span className="text-sm text-stone-400">All changes saved</span>
  }

  return (
    <div className="sticky bottom-4 z-30 mt-6 flex items-center justify-end gap-4 rounded-3xl border border-stone-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur sm:rounded-full">
      <span className="min-w-0 flex-1 text-right" aria-live="polite">
        {statusLabel}
      </span>
      <SaveButton pending={pending} />
    </div>
  )
}
