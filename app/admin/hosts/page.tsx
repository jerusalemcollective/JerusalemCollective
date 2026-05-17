import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { updateHostVerification } from '@/app/admin/actions'

type HostRow = {
  id: string
  name: string
  email: string | null
  host_type: string
  is_verified: boolean
  created_at: string
}

export default async function AdminHostsPage() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from('hosts')
    .select('id, name, email, host_type, is_verified, created_at')
    .order('created_at', { ascending: false })

  const hosts = (data || []) as HostRow[]

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Hosts</h2>
        <p className="mt-2 text-stone-600">Review host accounts and manage verification status.</p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr]">
          <span>Host</span>
          <span>Email</span>
          <span>Type</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {hosts.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No hosts yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {hosts.map((host) => (
              <div
                key={host.id}
                className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr] md:items-center"
              >
                <Link href={`/hosts/${host.id}`} className="font-bold text-stone-950 hover:underline">
                  {host.name}
                </Link>
                <p className="text-sm text-stone-700">{host.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{host.host_type}</p>
                <BooleanBadge value={host.is_verified} yes="Verified" no="Unverified" />
                <form action={updateHostVerification}>
                  <input type="hidden" name="hostId" value={host.id} />
                  <input type="hidden" name="value" value={String(!host.is_verified)} />
                  <button className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300">
                    {host.is_verified ? 'Remove' : 'Verify'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BooleanBadge({
  value,
  yes,
  no,
}: {
  value: boolean
  yes: string
  no: string
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
        value ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'
      }`}
    >
      {value ? yes : no}
    </span>
  )
}

