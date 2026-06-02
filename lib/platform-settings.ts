import { createClient } from '@supabase/supabase-js'

type PlatformSettingRow = {
  value: string
}

export async function getServicesBarEnabled() {
  return getBooleanPlatformSetting('services_bar_enabled', true)
}

export async function getPaymentRouteSettings() {
  const [jlmPaymentsEnabled, directPaymentsEnabled, commissionPercent] = await Promise.all([
    getBooleanPlatformSetting('jlm_payments_enabled', false),
    getBooleanPlatformSetting('direct_payments_enabled', true),
    getNumberPlatformSetting('commission_percent', 0),
  ])

  return {
    jlmPaymentsEnabled,
    directPaymentsEnabled,
    commissionPercent,
  }
}

async function getBooleanPlatformSetting(key: string, fallback: boolean) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return fallback

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle<PlatformSettingRow>()

    if (error || !data) return fallback

    return data.value !== 'false'
  } catch {
    return fallback
  }
}

async function getNumberPlatformSetting(key: string, fallback: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return fallback

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle<PlatformSettingRow>()

    if (error || !data) return fallback

    const numberValue = Number(data.value)
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
  } catch {
    return fallback
  }
}
