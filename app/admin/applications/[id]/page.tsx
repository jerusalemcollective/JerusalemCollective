import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { StatusBadge } from '@/components/status-badge'
import {
  approveAndPublishApplication,
} from '@/app/admin/application-actions'
import { AdminRequestChangesForm } from '@/components/admin-request-changes-form'
import { AdminApplicationStatusForm } from '@/components/admin-application-status-form'

type AdminApplication = {
  id: string
  apartment_title: string
  area: string
  host_name: string
  email: string
  phone: string | null
  whatsapp_number: string | null
  host_type: string | null
  exact_address: string | null
  bedrooms: number | null
  bathrooms: number | null
  sleeps: number | null
  price_ils: number | null
  price_usd: number | null
  amenities: string[] | null
  description: string | null
  status: string
  verification_doc_type?: string | null
  id_doc_type?: string | null
  verification_status?: string | null
  id_verified?: boolean | null
}

export default async function AdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdminPermission('applications')
  const [{ data: application }, { data: photos }] = await Promise.all([
    supabase.from('host_applications').select('*').eq('id', id).single(),
    supabase
      .from('listing_photos')
      .select('*')
      .eq('application_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (!application) notFound()
  const adminApplication = application as AdminApplication

  return (
    <div>
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/admin" className="hover:text-[#c76f55]">Applications</Link>
          <span>/</span>
          <span className="text-stone-900">{adminApplication.apartment_title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Application</p>
                  <h1 className="mt-2 text-3xl font-bold text-stone-950">{adminApplication.apartment_title}</h1>
                  <p className="mt-2 text-stone-600">{adminApplication.area}</p>
                </div>
                <StatusBadge status={adminApplication.status} scheme="application" />
              </div>
            </section>

            <InfoSection title="Host">
              <InfoRow label="Name" value={adminApplication.host_name} />
              <InfoRow label="Email" value={adminApplication.email} />
              <InfoRow label="Phone" value={adminApplication.phone || 'Not provided'} />
              <InfoRow label="WhatsApp" value={adminApplication.whatsapp_number || 'Not provided'} />
              <InfoRow label="Host type" value={adminApplication.host_type || 'Not provided'} />
            </InfoSection>

            <InfoSection title="Stay details">
              <InfoRow label="Address" value={adminApplication.exact_address || 'Not provided'} />
              <InfoRow label="Rooms" value={`${adminApplication.bedrooms || '-'} bedrooms, ${adminApplication.bathrooms || '-'} bathrooms`} />
              <InfoRow label="Sleeps" value={String(adminApplication.sleeps || '-')} />
              <InfoRow label="Pricing" value={`ILS ${adminApplication.price_ils || '-'} / USD ${adminApplication.price_usd || '-'}`} />
              <InfoRow label="Amenities" value={(adminApplication.amenities || []).join(', ') || 'None selected'} />
              <InfoRow label="Description" value={adminApplication.description || 'Not provided'} />
            </InfoSection>

            <InfoSection title="Photos">
              {photos?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-2xl bg-[#F8F5F2]">
                      <div className="relative">
                        <img
                          src={photo.photo_url}
                          alt={photo.label || ''}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        {photo.is_cover && (
                          <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm">
                            Cover
                          </span>
                        )}
                      </div>
                      {photo.label && (
                        <p className="px-3 py-2 text-xs font-semibold text-stone-700">{photo.label}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No photos uploaded.</p>
              )}
            </InfoSection>

            <InfoSection title="Verification">
              <InfoRow label="Property document" value={adminApplication.verification_doc_type || 'Not provided'} />
              <InfoRow label="Identity document" value={adminApplication.id_doc_type || 'Not provided'} />
              <InfoRow label="Verification status" value={adminApplication.verification_status || 'pending'} />
              <InfoRow label="ID verified" value={adminApplication.id_verified ? 'Yes' : 'No'} />
            </InfoSection>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Actions</h2>
              <div className="mt-4 space-y-3">
                <form action={approveAndPublishApplication}>
                  <input type="hidden" name="applicationId" value={adminApplication.id} />
                  <button className="w-full rounded-2xl bg-[#c76f55] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b55f47]">
                    Approve and publish
                  </button>
                </form>

                <AdminApplicationStatusForm
                  applicationId={adminApplication.id}
                  status="in_review"
                  label="Start review"
                  description="Use this when JLM Collective has started checking the submitted stay. It does not publish the listing."
                  tone="neutral"
                />

                <AdminRequestChangesForm applicationId={adminApplication.id} />

                <AdminApplicationStatusForm
                  applicationId={adminApplication.id}
                  status="rejected"
                  label="Reject"
                  tone="danger"
                />
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
