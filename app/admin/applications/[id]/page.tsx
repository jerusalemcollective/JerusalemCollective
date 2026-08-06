import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { StatusBadge } from '@/components/status-badge'
import {
  approveAndPublishApplication,
  rejectApplicationAndReturn,
  unrejectApplicationAndReturn,
  updateAdminApplicationDetails,
} from '@/app/admin/application-actions'
import { AdminRequestChangesForm } from '@/components/admin-request-changes-form'
import { AdminApplicationStatusForm } from '@/components/admin-application-status-form'
import { AmenitySelector } from '@/components/amenity-selector'

type ApplicationPhoto = {
  id: string
  photo_url: string
  is_cover: boolean | null
  label: string | null
}

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
  sleeping_setup?: string | null
  price_ils: number | null
  price_usd: number | null
  amenities: string[] | null
  description: string | null
  status: string
  verification_doc_type?: string | null
  id_doc_type?: string | null
  verification_status?: string | null
  id_verified?: boolean | null
  verification_doc_path?: string | null
  id_doc_path?: string | null
  rejected_at?: string | null
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
      .select('id, photo_url, is_cover, label')
      .eq('application_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (!application) notFound()
  const adminApplication = application as AdminApplication
  const applicationPhotos = (photos || []) as ApplicationPhoto[]
  const canUnrejectApplication =
    adminApplication.status === 'rejected' && isWithinRejectionWindow(adminApplication.rejected_at)
  const [propertyDocumentUrl, identityDocumentUrl] = await Promise.all([
    createDocumentUrl(supabase, adminApplication.verification_doc_path),
    createDocumentUrl(supabase, adminApplication.id_doc_path),
  ])

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
                  <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">{adminApplication.apartment_title}</h1>
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
              <InfoRow label="Sleeping setup" value={adminApplication.sleeping_setup || 'Not provided'} />
              <InfoRow label="Pricing" value={`ILS ${adminApplication.price_ils || '-'} / USD ${adminApplication.price_usd || '-'}`} />
              <InfoRow label="Amenities" value={(adminApplication.amenities || []).join(', ') || 'None selected'} />
              <InfoRow label="Description" value={adminApplication.description || 'Not provided'} />
            </InfoSection>

            <InfoSection title="Edit listing details">
              <form action={updateAdminApplicationDetails} className="grid gap-4">
                <input type="hidden" name="applicationId" value={adminApplication.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <EditField label="Title" name="apartment_title" defaultValue={adminApplication.apartment_title} required />
                  <EditField label="Neighbourhood" name="area" defaultValue={adminApplication.area} required />
                  <div className="md:col-span-2">
                    <EditField label="Exact address" name="exact_address" defaultValue={adminApplication.exact_address || ''} />
                  </div>
                  <EditField label="Bedrooms" name="bedrooms" type="number" defaultValue={String(adminApplication.bedrooms || '')} />
                  <EditField label="Bathrooms" name="bathrooms" type="number" step="0.5" defaultValue={String(adminApplication.bathrooms || '')} />
                  <EditField label="Sleeps" name="sleeps" type="number" defaultValue={String(adminApplication.sleeps || '')} />
                  <EditField label="Price ILS" name="price_ils" type="number" defaultValue={String(adminApplication.price_ils || '')} />
                  <EditField label="Price USD" name="price_usd" type="number" defaultValue={String(adminApplication.price_usd || '')} />
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Sleeping setup</span>
                  <textarea
                    name="sleeping_setup"
                    defaultValue={adminApplication.sleeping_setup || ''}
                    rows={5}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  />
                </label>
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Amenities</span>
                  <div className="mt-2">
                    <AmenitySelector defaultSelectedAmenities={adminApplication.amenities || []} />
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Description</span>
                  <textarea
                    name="description"
                    defaultValue={adminApplication.description || ''}
                    className="mt-2 min-h-36 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
                  />
                </label>
                <button className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-stone-800">
                  Save admin edits
                </button>
              </form>
            </InfoSection>

            <InfoSection title="Photos">
              {applicationPhotos.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {applicationPhotos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-2xl bg-[#F8F5F2]">
                      <div className="relative">
                        <a href={photo.photo_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={photo.photo_url}
                            alt={photo.label || ''}
                            className="aspect-[4/3] w-full object-cover transition hover:scale-[1.02]"
                          />
                        </a>
                        {photo.is_cover && (
                          <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-800 shadow-sm">
                            Cover
                          </span>
                        )}
                      </div>
                      {photo.label && (
                        <p className="px-3 py-2 text-xs font-semibold text-stone-700">{photo.label}</p>
                      )}
                      <a
                        href={photo.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border-t border-white px-3 py-2 text-xs font-bold text-[#c76f55] hover:underline"
                      >
                        Open full photo
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">No photos uploaded.</p>
              )}
            </InfoSection>

            <InfoSection title="Verification">
              <InfoRow label="Property document" value={adminApplication.verification_doc_type || 'Not provided'} />
              <DocumentLink href={propertyDocumentUrl} label="Open property document" fallback="No property document file available." />
              <InfoRow label="Identity document" value={adminApplication.id_doc_type || 'Not provided'} />
              <DocumentLink href={identityDocumentUrl} label="Open ID document" fallback="No ID document file available." />
              <InfoRow label="Verification status" value={adminApplication.verification_status || 'pending'} />
              <InfoRow label="ID verified" value={adminApplication.id_verified ? 'Yes' : 'No'} />
            </InfoSection>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">Actions</h2>
              <div className="mt-4 space-y-3">
                {canUnrejectApplication && (
                  <form action={unrejectApplicationAndReturn}>
                    <input type="hidden" name="applicationId" value={adminApplication.id} />
                    <button className="w-full rounded-2xl border border-green-200 px-4 py-3 text-sm font-bold text-green-700 transition hover:bg-green-50">
                      Unreject and continue review
                    </button>
                  </form>
                )}

                <form action={approveAndPublishApplication}>
                  <input type="hidden" name="applicationId" value={adminApplication.id} />
                  <button className="w-full rounded-2xl bg-[#252525] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#111111]">
                    Approve and publish
                  </button>
                </form>

                <AdminApplicationStatusForm
                  applicationId={adminApplication.id}
                  status="in_review"
                  label="Start review"
                  tone="neutral"
                />

                <AdminRequestChangesForm applicationId={adminApplication.id} />

                <form action={rejectApplicationAndReturn}>
                  <input type="hidden" name="applicationId" value={adminApplication.id} />
                  <button className="w-full rounded-2xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50">
                    Reject
                  </button>
                </form>
                {adminApplication.status === 'rejected' && (
                  <p className="rounded-2xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
                    Rejected applications stay in the admin queue for 25 hours. During that time you can edit the details or unreject it.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
    </div>
  )
}

function isWithinRejectionWindow(rejectedAt?: string | null) {
  if (!rejectedAt) return false
  const rejectedTime = new Date(rejectedAt).getTime()
  if (!Number.isFinite(rejectedTime)) return false
  return Date.now() - rejectedTime < 25 * 60 * 60 * 1000
}

async function createDocumentUrl(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>['supabase'],
  path?: string | null,
) {
  if (!path) return null

  const { data, error } = await supabase.storage
    .from('verification-docs')
    .createSignedUrl(path, 60 * 10)

  if (error) {
    console.error('Unable to create verification document URL', error)
    return null
  }

  return data.signedUrl
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
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{value}</p>
    </div>
  )
}

function EditField({
  label,
  name,
  defaultValue,
  type = 'text',
  step,
  required = false,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  step?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
      />
    </label>
  )
}

function DocumentLink({
  href,
  label,
  fallback,
}: {
  href: string | null
  label: string
  fallback: string
}) {
  if (!href) {
    return <p className="text-sm text-stone-500">{fallback}</p>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-[#c76f55] transition hover:border-[#c76f55]"
    >
      {label}
    </a>
  )
}
