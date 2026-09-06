import { requireAdminPermission } from '@/lib/admin'
import { AdminUsersBrowser, type AdminUserRow } from '@/components/admin-users-browser'

type PersonRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  is_host: boolean
  is_admin: boolean
  admin_role: string | null
  host_id: string | null
  booking_count: number
  saved_count: number
  created_at: string
  last_sign_in_at: string | null
}

export default async function AdminUsersPage() {
  const { supabase } = await requireAdminPermission('users')

  const { data, error } = await supabase.rpc('list_platform_people')
  if (error) throw error

  const people: AdminUserRow[] = (data || []).map((person: PersonRow) => {
    const isHost = Boolean(person.is_host) || Boolean(person.host_id)
    const hasGuestActivity = Number(person.booking_count || 0) > 0 || Number(person.saved_count || 0) > 0
    // Every non-host account is a guest by default; a host is also a guest once
    // they have guest activity (a booking or a save).
    const isGuest = hasGuestActivity || !isHost
    return {
      user_id: person.user_id,
      email: person.email,
      full_name: person.full_name,
      phone: person.phone,
      isHost,
      isGuest,
      isAdmin: Boolean(person.is_admin),
      admin_role: person.admin_role,
      booking_count: Number(person.booking_count || 0),
      saved_count: Number(person.saved_count || 0),
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Users</h2>
      </div>

      <AdminUsersBrowser people={people} />
    </div>
  )
}
