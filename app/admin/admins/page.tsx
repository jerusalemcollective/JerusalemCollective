import { AdminAddAdminForm } from '@/components/admin-add-admin-form'
import { describeAdminRole, requireAdminPermission } from '@/lib/admin'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'

const PAGE_SIZE = 25

type AdminUser = {
  user_id: string
  email: string | null
  full_name: string | null
  admin_role: string | null
  created_at: string | null
  last_sign_in_at: string | null
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('admins')
  const currentSearchParams = normalizePaginationSearchParams(await searchParams)
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  const { data, error } = await supabase.rpc('list_admin_users')

  if (error) {
    throw error
  }

  const admins: AdminUser[] = (data || []).map((admin) => ({
    user_id: admin.user_id,
    email: admin.email,
    full_name: admin.full_name,
    admin_role: admin.admin_role,
    created_at: admin.created_at,
    last_sign_in_at: admin.last_sign_in_at,
  }))
  const paged = admins.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = admins.length

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Admin access</h2>
        <p className="mt-2 text-stone-600">
          Give trusted team members the right amount of access, not more than they need.
        </p>
      </div>

      <section className="border-y border-stone-200 py-6">
        <h3 className="text-lg font-bold text-stone-950">Set admin role</h3>
        <AdminAddAdminForm />
        <p className="mt-3 text-sm text-stone-500">
          The person must already have an account before an admin role can be assigned.
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-xl font-bold text-stone-950">Current admins</h3>
        <div className="mt-4 overflow-hidden border-y border-stone-200">
          <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1fr_1fr_0.7fr_0.8fr]">
            <span>Email</span>
            <span>Name</span>
            <span>Role</span>
            <span>Last sign in</span>
          </div>

          {paged.length === 0 ? (
            <div className="py-12 text-center text-stone-500">No admins found.</div>
          ) : (
            <div className="divide-y divide-stone-200">
              {paged.map((admin) => (
                <div
                  key={admin.user_id}
                  className="grid gap-2 py-4 md:grid-cols-[1fr_1fr_0.7fr_0.8fr] md:items-center"
                >
                  <p className="font-semibold text-stone-950">{admin.email || 'No email'}</p>
                  <p className="text-stone-700">{admin.full_name || 'No name'}</p>
                  <RoleBadge role={admin.admin_role} />
                  <p className="text-sm text-stone-600">
                    {admin.last_sign_in_at
                      ? new Date(admin.last_sign_in_at).toLocaleString('en-GB')
                      : 'Never'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/admins" searchParams={currentSearchParams} />
      </section>
    </div>
  )
}

function RoleBadge({ role }: { role: string | null }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-stone-950 px-3 py-1 text-xs font-bold text-white">
      {describeAdminRole(role)}
    </span>
  )
}
