import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { NotificationPreferencesForm } from '@/components/notification-preferences-form'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'

type HostNotificationPreferences = {
  notify_new_enquiry_email: boolean | null
  notify_booking_confirmed_email: boolean | null
  notify_messages_email: boolean | null
}

export default async function HostNotificationsPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()

  const { data: host } = await supabase
    .from('hosts')
    .select('notify_new_enquiry_email, notify_booking_confirmed_email, notify_messages_email')
    .in('id', hostIds)
    .limit(1)
    .maybeSingle()
  const hostPreferences: HostNotificationPreferences | null = host
    ? {
        notify_new_enquiry_email: host.notify_new_enquiry_email ?? true,
        notify_booking_confirmed_email: host.notify_booking_confirmed_email ?? true,
        notify_messages_email: host.notify_messages_email ?? true,
      }
    : null

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 md:px-6">
      <section className="mx-auto max-w-2xl">
        <HostDashboardNav />
        <h1 className="font-display mt-6 text-3xl font-bold text-stone-950">
          Notification preferences
        </h1>
        <p className="mt-2 text-stone-600">
          Choose how you want to be notified about activity on your listings.
        </p>
        <NotificationPreferencesForm
          initialPreferences={hostPreferences}
        />
      </section>
    </div>
  )
}
