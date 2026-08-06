'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Handles a pick from the post-login dashboard chooser.
 *
 * The "Remember this choice" checkbox fully controls the stored preference:
 *   - checked   -> save this destination and skip the chooser on future logins
 *   - unchecked -> clear any saved preference, so the chooser asks again
 * That gives the three states the design calls for (ask every time / remember
 * host / remember guest) with a single checkbox, including the reset.
 */
export async function chooseDashboard(formData: FormData) {
  const destination = formData.get('destination') === 'host' ? 'host' : 'guest'
  const remember = formData.get('remember') === 'on'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/choose-dashboard')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_dashboard: remember ? destination : null })
    .eq('id', user.id)

  if (error) {
    // Most likely the 093 migration hasn't been applied in this environment yet.
    // Don't block navigation — the preference just won't persist until it is.
    console.error('Could not save preferred_dashboard:', error)
  }

  redirect(destination === 'host' ? '/host/dashboard' : '/account')
}
