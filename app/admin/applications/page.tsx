import { requireAdminPermission } from '@/lib/admin'
import {
  AdminApplicationsBrowser,
  type AdminApplicationRow,
} from '@/components/admin-applications-browser'

// Load a bounded, recent window of applications and filter/paginate on the client,
// so switching status chips is instant (no per-click server round-trip).
const MAX_APPLICATIONS = 500

export default async function AdminApplicationsPage() {
  const { supabase } = await requireAdminPermission('applications')

  const { data } = await supabase
    .from('host_applications')
    .select('id, host_name, apartment_title, area, status, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_APPLICATIONS)

  const applications = (data || []) as AdminApplicationRow[]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Applications</h2>
      </div>

      <AdminApplicationsBrowser applications={applications} />
    </div>
  )
}
