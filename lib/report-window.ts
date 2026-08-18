import type { SupabaseClient } from '@supabase/supabase-js'

// The admin-configurable reporting window: how many days after checkout a guest
// or host can still open a report about a stay. Stored in platform_settings
// (key report_window_days); defaults to 14 when unset or invalid.
export async function getReportWindowDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'report_window_days')
    .maybeSingle<{ value: string | null }>()

  const days = Number(data?.value)
  return Number.isFinite(days) && days > 0 ? Math.min(365, Math.round(days)) : 14
}

// The earliest checkout date (YYYY-MM-DD) still inside the reporting window. A
// booking is reportable while its check_out is on or after this date.
export function reportWindowCutoffISO(days: number): string {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return cutoff.toISOString().slice(0, 10)
}
