import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { approveAndPublishApplication, updateApplicationStatus } from '@/app/admin/actions'

export default async function AdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const [{ data: application }, { data: photos }] = await Promise.all([
    supabase.from('host_applications').select('*').eq('id', id).single(),
    supabase
      .from('listing_photos')
      .select('*')
      .eq('application_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (!application) notFound()

  return (
    <div>
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/admin" className="hover:text-[#c76f55]">Applications</Link>
          <span>/</span>
          <span className="text-stone-900">{application.apartment_title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Application</p>
                  <h1 className="mt-2 text-3xl font-bold text-stone-950">{application.apartment_title}</h1>
                  <p className="mt-2 text-stone-600">{application.area}</p>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </section>

            <InfoSection title="Host">
              <InfoRow label="Name" value={application.host_name} />
              <InfoRow label="Email" value={application.email} />
              <InfoRow label="Phone" value={application.phone || 'Not provided'} />
              <InfoRow label="WhatsApp" value={application.whatsapp_number || 'Not provided'} />
              <InfoRow label="Host type" value={application.host_type} />
            </InfoSection>

            <InfoSection title="Stay details">
              <InfoRow label="Address" value={application.exact_address || 'Not provided'} />
              <InfoRow label="Rooms" value={`${application.bedrooms || '-'} bedrooms, ${application.bathrooms || '-'} bathrooms`} />
              <InfoRow label="Sleeps" value={String(application.sleeps || '-')} />
              <InfoRow label="Pricing" value={`ILS ${application.price_ils || '-'} / USD ${application.price_usd || '-'}`} />
              <InfoRow label="Amenities" value={(application.amenities || []).join(', ') || 'None selected'} />
              <InfoRow label="Description" value={application.description || 'Not provided'} />
            </InfoSection>

            <InfoSection title="Photos">
              {photos?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.photo_url}
                      alt=""
                      className="aspect-[4/3] w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No photos uploaded.</p>
              )}
            </InfoSection>

            <InfoSection title="Verification">
              <InfoRow label="Property document" value={application.verification_doc_type || 'Not provided'} />
              <InfoRow label="Identity document" value={application.id_doc_type || 'Not provided'} />
              <InfoRow label="Verification status" value={application.verification_status} />
              <InfoRow label="ID verified" value={application.id_verified ? 'Yes' : 'No'} />
            </InfoSection>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Actions</h2>
              <div className="mt-4 space-y-3">
                <form action={approveAndPublishApplication}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <button className="w-full rounded-2xl bg-[#c76f55] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b55f47]">
                    Approve and publish
                  </button>
                </form>

                <form action={updateApplicationStatus}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <input type="hidden" name="status" value="in_review" />
                  <button className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-300">
                    Mark in review
                  </button>
                </form>

                <form action={updateApplicationStatus}>
                  <input type="hidden" name="applicationId" value={application.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <button className="w-full rounded-2xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
    </div>
  )
}

function InfoSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'approved'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : status === 'in_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-stone-100 text-stone-700'

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
