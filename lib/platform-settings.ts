import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export const PLATFORM_SETTINGS_TAG = 'platform-settings'

type PlatformSettingRow = { key: string; value: string }

// One cached read of all platform settings, shared across every request and
// every page. Previously getServicesBarEnabled ran in the root layout on every
// request and getPaymentRouteSettings fired three separate queries per listing
// view. Revalidates every 60s; the admin settings action calls
// revalidateTag(PLATFORM_SETTINGS_TAG) so a toggle takes effect immediately.
const loadPlatformSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return {}

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { data, error } = await supabase.from('platform_settings').select('key, value')
      if (error || !data) return {}

      const map: Record<string, string> = {}
      for (const row of data as PlatformSettingRow[]) map[row.key] = row.value
      return map
    } catch {
      return {}
    }
  },
  ['platform-settings-all'],
  { revalidate: 60, tags: [PLATFORM_SETTINGS_TAG] },
)

function boolSetting(settings: Record<string, string>, key: string, fallback: boolean) {
  const value = settings[key]
  if (value === undefined) return fallback
  return value !== 'false'
}

function numberSetting(settings: Record<string, string>, key: string, fallback: number) {
  const value = settings[key]
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function getServicesBarEnabled() {
  const settings = await loadPlatformSettings()
  return boolSetting(settings, 'services_bar_enabled', true)
}

export async function getPaymentRouteSettings() {
  const settings = await loadPlatformSettings()
  return {
    jlmPaymentsEnabled: boolSetting(settings, 'jlm_payments_enabled', false),
    directPaymentsEnabled: boolSetting(settings, 'direct_payments_enabled', true),
    commissionPercent: numberSetting(settings, 'commission_percent', 0),
  }
}
