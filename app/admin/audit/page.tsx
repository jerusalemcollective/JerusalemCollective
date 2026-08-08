import { requireAdminPermission } from '@/lib/admin'

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string
  detail: string | null
  created_at: string
  performed_by?: string | null
}

export default async function AdminAuditPage() {
  const { supabase } = await requireAdminPermission('admins')
  const { data } = await supabase
    .from('admin_audit_log')
    .select('id, action, target_type, target_id, detail, created_at, performed_by')
    .order('created_at', { ascending: false })
    .limit(200)

  const logs: AuditLogRow[] = (data || []).map((log: AuditLogRow) => ({
    id: log.id,
    action: log.action,
    target_type: log.target_type,
    target_id: log.target_id,
    detail: log.detail,
    created_at: log.created_at,
    performed_by: log.performed_by,
  }))

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Audit log</h2>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid-cols-[1fr_1fr_0.8fr_1fr_1fr]">
          <span>Timestamp</span>
          <span>Action</span>
          <span>Target type</span>
          <span>Target id</span>
          <span>Detail</span>
        </div>

        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No audit log entries yet.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {logs.map((log) => (
              <article
                key={log.id}
                className="grid gap-4 px-6 py-5 text-sm md:grid-cols-[1fr_1fr_0.8fr_1fr_1fr] md:items-center"
              >
                <span className="font-medium text-stone-700">{formatTimestamp(log.created_at)}</span>
                <span className="font-semibold text-stone-950">{log.action.replaceAll('_', ' ')}</span>
                <span className="text-stone-600">{log.target_type}</span>
                <span className="break-all font-mono text-xs text-stone-500">{log.target_id}</span>
                <span className="text-stone-600">{log.detail || '-'}</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
