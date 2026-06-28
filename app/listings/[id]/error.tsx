'use client'

import { ErrorState } from '@/components/error-state'

export default function Error(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      {...props}
      title="This listing couldn't be loaded"
      message="The stay may be unavailable, or we hit a temporary error. Try again, or browse other stays."
    />
  )
}
