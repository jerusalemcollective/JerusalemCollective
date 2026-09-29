'use client'

import { useActionState } from 'react'
import { deleteListing, type ListingDeleteState } from '@/app/admin/listing-actions'

const initialState: ListingDeleteState = {
  status: 'idle',
  message: '',
}

type AdminDeleteListingFormProps = {
  listingId: string
  confirmMessage: string
  className: string
  children: React.ReactNode
}

export function AdminDeleteListingForm({
  listingId,
  confirmMessage,
  className,
  children,
}: AdminDeleteListingFormProps) {
  const [state, formAction, isPending] = useActionState(deleteListing, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <button
        type="submit"
        disabled={isPending}
        className={`${className} disabled:cursor-wait disabled:opacity-60`}
        onClick={(event) => {
          if (!window.confirm(confirmMessage)) {
            event.preventDefault()
          }
        }}
      >
        {isPending ? 'Deleting...' : children}
      </button>
      {state.status === 'error' && (
        <p role="alert" className="mt-2 max-w-sm rounded-2xl bg-red-50 p-3 text-xs leading-5 text-red-700">
          {state.message}
        </p>
      )}
    </form>
  )
}
