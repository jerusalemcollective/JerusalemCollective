import { AdminAddAdminForm } from '@/components/admin-add-admin-form'
import { requireAdmin } from '@/lib/admin'

type AdminUser = {
  user_id: string
  email: string | null
  full_name: string | null
}

export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.rpc('list_admin_users')

  if (error) {
    throw error
  }

  const admins = (data || []) as AdminUser[]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Admins</h2>
        <p className="mt-2 text-stone-600">
          Grant admin access to existing user accounts by email.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-950">Add admin</h3>
        <AdminAddAdminForm />
        <p className="mt-3 text-sm text-stone-500">
          The person must already have an account before they can be made an admin.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1fr_1fr]">
          <span>Email</span>
          <span>Name</span>
        </div>

        {admins.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No admins found.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {admins.map((admin) => (
              <div
                key={admin.user_id}
                className="grid gap-2 px-6 py-4 md:grid-cols-[1fr_1fr]"
              >
                <p className="font-semibold text-stone-950">{admin.email || 'No email'}</p>
                <p className="text-stone-700">{admin.full_name || 'No name'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
