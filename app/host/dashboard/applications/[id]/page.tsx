import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { updateHostApplication } from '../../listings/actions'

type HostApplication = {
  id: string
  apartment_title: string
  area: string
  exact_address: string | null
  latitude?: number | null
  longitude?: number | null
  bedrooms: number | null
  bathrooms: number | null
  sleeps: number | null
  price_ils: number | null
  price_usd: number | null
  amenities: string[] | null
  description: string | null
  status: string
  admin_feedback?: string | null
}

const amenityOptions = [
  'WiFi',
  'Air conditioning',
  'Washer',
  'Dryer',
  'Parking',
  'Elevator',
  'Balcony',
  'Garden',
  'Kosher kitchen',
  'Shabbat-friendly',
  'Sukkah balcony',
  'Near synagogues',
  'Family friendly',
  'Crib / high chair available',
]

export default async function HostApplicationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const { data: application } = await supabase
    .from('host_applications')
    .select('*')
    .eq('id', id)
    .in('host_id', hostIds)
    .single()

  if (!application) notFound()
  const hostApplication = application as HostApplication

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/host/dashboard/listings" className="hover:text-[#c76f55]">
            Listings
          </Link>
          <span>/</span>
          <span className="text-stone-900">{hostApplication.apartment_title}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form action={updateHostApplication} className="space-y-6">
            <input type="hidden" name="applicationId" value={hostApplication.id} />
            <input type="hidden" name="latitude" value={hostApplication.latitude ?? ''} />
            <input type="hidden" name="longitude" value={hostApplication.longitude ?? ''} />

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                    Submitted stay editor
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-stone-950">Edit and resubmit</h1>
                </div>
                <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  {hostStatusLabel(hostApplication.status)}
                </span>
              </div>
            </section>

            {hostApplication.admin_feedback && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Message from JLM Collective
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-amber-900">
                  {hostApplication.admin_feedback}
                </p>
              </section>
            )}

            <EditorSection title="Basics">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input name="title" defaultValue={hostApplication.apartment_title} required className={inputClass} />
                </Field>
                <Field label="Neighbourhood">
                  <input name="area" defaultValue={hostApplication.area} required className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Location">
              <Field label="Exact address">
                <input name="exactAddress" defaultValue={hostApplication.exact_address || ''} required className={inputClass} />
              </Field>
            </EditorSection>

            <EditorSection title="Capacity">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Bedrooms">
                  <input name="bedrooms" type="number" min="0" defaultValue={hostApplication.bedrooms ?? ''} className={inputClass} />
                </Field>
                <Field label="Bathrooms">
                  <input name="bathrooms" type="number" min="0" step="0.5" defaultValue={hostApplication.bathrooms ?? ''} className={inputClass} />
                </Field>
                <Field label="Sleeps">
                  <input name="sleeps" type="number" min="1" defaultValue={hostApplication.sleeps ?? ''} className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Pricing">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Price ILS">
                  <input name="priceIls" type="number" min="0" defaultValue={hostApplication.price_ils ?? ''} className={inputClass} />
                </Field>
                <Field label="Price USD">
                  <input name="priceUsd" type="number" min="0" defaultValue={hostApplication.price_usd ?? ''} className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Amenities">
              <div className="grid gap-3 sm:grid-cols-2">
                {amenityOptions.map((amenity) => (
                  <label key={amenity} className="flex items-center gap-3 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={amenity}
                      defaultChecked={(hostApplication.amenities || []).includes(amenity)}
                    />
                    <span>{amenity}</span>
                  </label>
                ))}
              </div>
            </EditorSection>

            <EditorSection title="Description">
              <textarea
                name="description"
                defaultValue={hostApplication.description || ''}
                rows={8}
                required
                className={`${inputClass} resize-y`}
              />
            </EditorSection>

            <div className="flex justify-end">
              <button className="rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]">
                Save and resubmit
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-950">What happens next</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                After you save, this stay returns to the JLM Collective review queue.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function EditorSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-800">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c76f55]'

function hostStatusLabel(status: string) {
  if (status === 'new') return 'In review'
  if (status === 'changes_requested') return 'Changes requested'
  return status.replaceAll('_', ' ')
}
