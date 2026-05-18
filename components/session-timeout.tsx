'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const idleTimeoutMs = 30 * 60 * 1000
const lastActivityKey = 'jlm-last-activity-at'
const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']

export function SessionTimeout() {
  useEffect(() => {
    let activeUserId: string | null = null
    let lastWriteAt = 0
    const supabase = createClient()

    const markActivity = () => {
      if (!activeUserId) return

      const now = Date.now()
      if (now - lastWriteAt < 10_000) return

      lastWriteAt = now
      window.localStorage.setItem(lastActivityKey, String(now))
    }

    const signOutForInactivity = async () => {
      await supabase.auth.signOut()
      window.localStorage.removeItem(lastActivityKey)
      window.location.href = '/login?reason=session-expired'
    }

    const checkInactivity = async () => {
      if (!activeUserId) return

      const stored = window.localStorage.getItem(lastActivityKey)
      const lastActivityAt = stored ? Number(stored) : Date.now()

      if (!stored) {
        window.localStorage.setItem(lastActivityKey, String(lastActivityAt))
        return
      }

      if (Date.now() - lastActivityAt >= idleTimeoutMs) {
        await signOutForInactivity()
      }
    }

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      activeUserId = user?.id || null

      if (activeUserId && !window.localStorage.getItem(lastActivityKey)) {
        window.localStorage.setItem(lastActivityKey, String(Date.now()))
      }
    }

    void loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      activeUserId = session?.user?.id || null

      if (event === 'SIGNED_IN' && activeUserId) {
        window.localStorage.setItem(lastActivityKey, String(Date.now()))
      }

      if (event === 'SIGNED_OUT') {
        window.localStorage.removeItem(lastActivityKey)
      }
    })

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true })
    })

    const intervalId = window.setInterval(() => {
      void checkInactivity()
    }, 60_000)

    const handleStorage = (event: StorageEvent) => {
      if (event.key === lastActivityKey) {
        void checkInactivity()
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      subscription.unsubscribe()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity)
      })
      window.clearInterval(intervalId)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return null
}
