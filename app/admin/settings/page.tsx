import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { UpdateCommissionForm } from '@/components/update-commission-form'
import { ServicesVisibilityForm } from '@/components/services-visibility-form'
import { PaymentRouteControlsForm } from '@/components/payment-route-controls-form'

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
  const commissionSetting = platformSettings.find(
    (setting) => setting.key === 'commission_percent',
  )
  const servicesVisibilitySetting = platformSettings.find(
    (setting) => setting.key === 'services_bar_enabled',
  )
  const jlmPaymentsSetting = platformSettings.find(
    (setting) => setting.key === 'jlm_payments_enabled',
  )
  const directPaymentsSetting = platformSettings.find(
    (setting) => setting.key === 'direct_payments_enabled',
  )
  const currentCommission = commissionSetting?.value ?? '0'
  const servicesBarEnabled = servicesVisibilitySetting?.value !== 'false'
  const jlmPaymentsEnabled = jlmPaymentsSetting?.value === 'true'
  const directPaymentsEnabled = directPaymentsSetting?.value !== 'false'

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
          Owner settings
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">
          Platform settings
        </h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Global settings that affect bookings and platform operations.
        </p>
      </div>

      <section className="max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-stone-950">Commission rate</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          The percentage JLM Collective takes from new bookings. Currently{' '}
          <strong>{currentCommission}%</strong>.
          {currentCommission === '0' && (
            <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Free phase
            </span>
          )}
        </p>

        <UpdateCommissionForm currentValue={currentCommission} />

        {commissionSetting?.updated_at && (
          <p className="mt-3 text-xs text-stone-400">
            Last updated:{' '}
            {new Date(commissionSetting.updated_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </section>

      <section className="mt-6 max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-stone-950">Services visibility</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Hide the Services navigation and service promotion areas until they are launch ready.
        </p>

        <ServicesVisibilityForm enabled={servicesBarEnabled} />
      </section>

      <section className="mt-6 max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="font-bold text-stone-950">Payment route controls</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Globally allow or pause JLM-collected payments and direct-to-host payment options.
        </p>

        <PaymentRouteControlsForm
          jlmPaymentsEnabled={jlmPaymentsEnabled}
          directPaymentsEnabled={directPaymentsEnabled}
        />
      </section>

      <section className="mt-6 max-w-3xl rounded-3xl bg-stone-50 p-6">
        <h2 className="font-bold text-stone-950">Business model notes</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-stone-600">
          <p>
            <strong>Current phase:</strong> Commission is 0%. The platform is free for hosts while JLM Collective builds supply, trust, and traction.
          </p>
          <p>
            <strong>Manual commission:</strong> When the platform is ready, owner admins can update the commission percentage above. Keep the rate low enough that hosts and guests both prefer staying on-platform.
          </p>
          <p>
            <strong>Optional future revenue:</strong> Featured listings or other paid visibility can be added separately without making every booking feel expensive.
          </p>
          <p className="border-t border-stone-200 pt-3 text-xs text-stone-400">
            Changing commission affects only new bookings from that point. Existing bookings keep the rate that was locked when they were created.
          </p>
        </div>
      </section>
    </div>
  )
}
