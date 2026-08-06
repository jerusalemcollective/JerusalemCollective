'use client'

import { useEffect, useRef } from 'react'
import { markApplicationInReviewOnOpen } from '@/app/admin/application-actions'

// Auto-moves a freshly-submitted application to "in review" the moment an admin
// opens it, so there is no separate "Start review" button. Runs on real mount
// only (not on link prefetch), and never overrides an existing decision.
const ALREADY_DECIDED = ['in_review', 'approved', 'rejected', 'changes_requested']

export function MarkApplicationInReview({
  applicationId,
  status,
}: {
  applicationId: string
  status: string
}) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (ALREADY_DECIDED.includes(status)) return
    firedRef.current = true
    void markApplicationInReviewOnOpen(applicationId)
  }, [applicationId, status])

  return null
}
