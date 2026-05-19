import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { updateHostVerification } from '@/app/admin/host-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { BooleanBadge } from '@/components/boolean-badge'
import { Pagination } from '@/components/pagination'

const PAGE_SIZE = 25

type PersonRow = {
  user_id: string
  email: string | null
  full_name: string | null
  host_id: string | null
  host_name: string | null
  host_type: string | null
  host_is_verified: boolean | null
  listing_count: number
  application_count: number
  created_at: string
  last_sign_in_at: string | null
}

export default async function AdminHostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { supabase } = await requireAdminPermission('hosts')
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const { data, error } = await supabase.rpc('list_platform_people')

  if (error) {
    throw error
  }

  const hosts = ((data || []) as PersonRow[]).filter((person) => person.host_id)
  const paged = hosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = hosts.length

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Hosts</h2>
        <p className="mt-2 text-stone-600">
          All host accounts, their contact details, verification, and inventory.
        </p>
      </div>

      <div className="overflow-hidden border-y border-stone-200">
        <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.2fr_1fr_0.75fr_0.85fr_0.8fr_0.8fr]">
          <span>Host</span>
          <span>Email</span>
          <span>Type</span>
          <span>Inventory</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center text-stone-500">No hosts yet.</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {paged.map((host) => (
              <div
                key={host.host_id}
                className="grid gap-4 py-5 md:grid-cols-[1.2fr_1fr_0.75fr_0.85fr_0.8fr_0.8fr] md:items-center"
              >
                <Link href={`/hosts/${host.host_id}`} className="font-bold text-stone-950 hover:underline">
                  {host.host_name || host.full_name || 'Host'}
                </Link>
                <p className="text-sm text-stone-700">{host.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{host.host_type || 'owner'}</p>
                <p className="text-sm text-stone-700">
                  {Number(host.listing_count || 0)} live / {Number(host.application_count || 0)} submitted
                </p>
                <BooleanBadge value={Boolean(host.host_is_verified)} yes="Verified" no="Unverified" falseTone="strong" />
                <form action={updateHostVerification}>
                  <input type="hidden" name="hostId" value={host.host_id || ''} />
                  <input type="hidden" name="value" value={String(!host.host_is_verified)} />
                  <ConfirmSubmitButton
                    message="Are you sure?"
                    className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
                  >
                    {host.host_is_verified ? 'Remove' : 'Verify'}
                  </ConfirmSubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/hosts" />
    </div>
  )
}
