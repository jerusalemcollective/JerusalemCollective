import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { ServicesVisibilityForm } from '@/components/services-visibility-form'
import { ReportWindowForm } from '@/components/report-window-form'

type PlatformSetting = {
  key: string
  value: string
  description: string | null
  updated_at: string | null
}

export default async function AdminSettingsPage() {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    redirect('/admin')
  }

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('key, value, description, updated_at')
    .order('key', { ascending: true })

  const platformSettings: PlatformSetting[] = settings || []
  const servicesVisibilitySetting = platformSettings.find(
    (setting) => setting.key === 'services_bar_enabled',
  )
  const reportWindowSetting = platformSettings.find(
    (setting) => setting.key === 'report_window_days',
  )
  const servicesBarEnabled = servicesVisibilitySetting?.value !== 'false'
  const reportWindowDays = Number(reportWindowSetting?.value) || 14

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
          Owner settings
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">
          Platform settings
        </h1>
      </div>

      <section className="max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-stone-950">Services visibility</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Hide the Services navigation and service promotion areas until they are launch ready.
        </p>

        <ServicesVisibilityForm enabled={servicesBarEnabled} />
      </section>

      <section className="mt-6 max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-stone-950">Reporting window</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          How long after a stay ends a guest or host can still open a report about it. Currently{' '}
          <strong>{reportWindowDays} days</strong> after checkout.
        </p>

        <ReportWindowForm days={reportWindowDays} />
      </section>
    </div>
  )
}
