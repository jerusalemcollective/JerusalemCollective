'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotificationPrefs = {
  notify_new_enquiry_email: boolean | null
  notify_booking_confirmed_email: boolean | null
  notify_messages_email: boolean | null
}

type NotificationPreferencesFormProps = {
  initialPreferences: NotificationPrefs | null
}

const PREFERENCES: Array<{
  key: keyof NotificationPrefs
  label: string
  description: string
}> = [
  {
    key: 'notify_new_enquiry_email',
    label: 'New enquiry',
    description: 'Email me when a guest sends a new enquiry for one of my listings.',
  },
  {
    key: 'notify_booking_confirmed_email',
    label: 'Booking confirmed',
    description: 'Email me when a booking is confirmed.',
  },
  {
    key: 'notify_messages_email',
    label: 'New messages',
    description: 'Email me when a guest sends a message.',
  },
]

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    initialPreferences || {
      notify_new_enquiry_email: true,
      notify_booking_confirmed_email: true,
      notify_messages_email: true,
    },
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((current) => ({
      ...current,
      [key]: !current[key],
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: host } = await supabase
        .from('hosts')
        .select('id')
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle()

      if (host) {
        await supabase
          .from('hosts')
          .update(prefs)
          .eq('id', host.id)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {PREFERENCES.map((pref) => (
        <div
          key={pref.key}
          className="flex items-start justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm"
        >
          <div>
            <p className="font-bold text-stone-950">{pref.label}</p>
            <p className="mt-1 text-sm text-stone-600">{pref.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(prefs[pref.key])}
            onClick={() => handleToggle(pref.key)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              prefs[pref.key] ? 'bg-[#c76f55]' : 'bg-stone-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                prefs[pref.key] ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
      >
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save preferences'}
      </button>
    </div>
  )
}
