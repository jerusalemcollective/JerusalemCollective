'use client'

import { startTransition, useState, useActionState } from 'react'

export type AdminActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const initialState: AdminActionState = { status: 'idle', message: '' }

type AdminConfirmActionFormProps = {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  fields: Record<string, string>
  label: string
  pendingLabel?: string
  // When set, the first click shows an inline "Are you sure?" step instead of
  // submitting straight away. Inline rather than window.confirm(), which some
  // embedded browsers block silently.
  confirmText?: string
  confirmLabel?: string
  className: string
  description?: string
}

// A single admin button backed by a server action that returns its result, so
// refusals and errors are shown next to the button instead of an error page.
export function AdminConfirmActionForm({
  action,
  fields,
  label,
  pendingLabel = 'Working...',
  confirmText,
  confirmLabel = 'Yes, continue',
  className,
  description,
}: AdminConfirmActionFormProps) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (previousState: AdminActionState, formData: FormData) => {
      const result = await action(previousState, formData)
      setConfirming(false)
      return result
    },
    initialState,
  )

  const hiddenFields = Object.entries(fields).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ))

  return (
    <div>
      {description && <p className="mb-2 text-xs leading-5 text-stone-500">{description}</p>}
      {confirmText && confirming ? (
        <form action={formAction} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
          {hiddenFields}
          <p className="text-sm font-semibold text-stone-900">{confirmText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className={`${className} disabled:cursor-wait disabled:opacity-60`}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 transition hover:border-stone-400 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form action={formAction}>
          {hiddenFields}
          <button
            type={confirmText ? 'button' : 'submit'}
            disabled={pending}
            onClick={confirmText ? () => setConfirming(true) : undefined}
            className={`${className} disabled:cursor-wait disabled:opacity-60`}
          >
            {pending ? pendingLabel : label}
          </button>
        </form>
      )}
      {state.message && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`mt-2 rounded-2xl px-3 py-2 text-xs leading-5 ${
            state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  )
}

type AdminActionFormProps = {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  submitLabel: string
  pendingLabel: string
  className?: string
  submitClassName: string
  children: React.ReactNode
}

// A full form (e.g. edit or create listing) whose server action returns errors
// instead of throwing, so the admin sees why a save failed and keeps their input.
export function AdminActionForm({
  action,
  submitLabel,
  pendingLabel,
  className,
  submitClassName,
  children,
}: AdminActionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form
      className={className}
      // Submit manually instead of via the action prop: React resets an
      // action-prop form after every submit, which would wipe the admin's edits
      // when the save is refused.
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => formAction(formData))
      }}
    >
      {children}
      {state.status === 'error' && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${submitClassName} disabled:cursor-wait disabled:opacity-60`}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
