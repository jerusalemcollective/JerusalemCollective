import { createClient } from '@supabase/supabase-js'

type PlatformSettingRow = {
  value: string
}

export async function getServicesBarEnabled() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return true

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'services_bar_enabled')
      .maybeSingle<PlatformSettingRow>()

    if (error || !data) return true

    return data.value !== 'false'
  } catch {
    return true
  }
}
