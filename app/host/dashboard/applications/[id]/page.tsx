import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HostDashboardNav } from '@/components/host-dashboard-nav'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { updateHostApplication } from '../../listings/actions'
import { ApplicationPhotoManager } from '@/components/application-photo-manager'
import { ListingAiAssistant } from '@/components/listing-ai-assistant'
import { GoogleAddressField } from '@/components/google-address-field'
import { AmenitySelector } from '@/components/amenity-selector'

type HostApplication = {
  id: string
  host_name: string
  display_name?: string | null
  show_full_name?: boolean | null
  email: string
  phone: string | null
  whatsapp_number: string | null
  host_type: string | null
  apartment_title: string
  area: string
  exact_address: string | null
  latitude?: number | null
  longitude?: number | null
  bedrooms: number | null
  bathrooms: number | null
  sleeps: number | null
  sleeping_setup?: string | null
  currency_preference?: string | null
  price_ils: number | null
  price_usd: number | null
  amenities: string[] | null
  description: string | null
  photo_link: string | null
  verification_doc_type?: string | null
  id_doc_type?: string | null
  status: string
  admin_feedback?: string | null
  admin_feedback_sections?: string[] | null
}

type ApplicationPhoto = {
  id: string
  photo_url: string
  storage_path: string | null
  is_cover: boolean
  sort_order: number
  label?: string | null
}

const feedbackSectionLabels: Record<string, string> = {
  host_details: 'Host details',
  ownership: 'Ownership / permission',
  stay_basics: 'Stay basics',
  location: 'Location',
  capacity: 'Capacity',
  pricing: 'Pricing',
  amenities: 'Amenities',
  description: 'Description',
  photos: 'Photos',
  verification: 'Verification',
}

export default async function HostApplicationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const [{ data: application }, { data: photos }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('*')
      .eq('id', id)
      .in('host_id', hostIds)
      .single(),
    supabase
      .from('listing_photos')
      .select('id, photo_url, storage_path, is_cover, sort_order, label')
      .eq('application_id', id)
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true }),
  ])

  if (!application) notFound()
  const hostApplication = application as HostApplication
  const applicationPhotos = (photos || []) as ApplicationPhoto[]
  const sectionsToFix = hostApplication.admin_feedback_sections || []

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
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
          <form id="host-application-edit-form" action={updateHostApplication} className="space-y-6">
            <input type="hidden" name="applicationId" value={hostApplication.id} />
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                    Submitted stay editor
                  </p>
                  <h1 className="font-display mt-2 text-3xl font-bold text-stone-950">Edit and resubmit</h1>
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
                {sectionsToFix.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sectionsToFix.map((section) => (
                      <span
                        key={section}
                        className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800"
                      >
                        {feedbackSectionLabels[section] || section.replaceAll('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-amber-900">
                  {hostApplication.admin_feedback}
                </p>
              </section>
            )}

            <EditorSection title="Host details">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name">
                  <input name="hostName" defaultValue={hostApplication.host_name} required className={inputClass} />
                </Field>
                <Field label="Display name">
                  <input name="displayName" defaultValue={hostApplication.display_name || ''} required className={inputClass} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={hostApplication.email} required className={inputClass} />
                </Field>
                <Field label="Phone">
                  <input name="phone" defaultValue={hostApplication.phone || ''} className={inputClass} />
                </Field>
                <Field label="WhatsApp">
                  <input name="whatsappNumber" defaultValue={hostApplication.whatsapp_number || ''} className={inputClass} />
                </Field>
                <Field label="Host type">
                  <select name="hostType" defaultValue={hostApplication.host_type || 'owner'} className={inputClass}>
                    <option value="owner">I own this stay</option>
                    <option value="representative">I manage this stay for someone else</option>
                  </select>
                </Field>
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  name="showFullName"
                  defaultChecked={Boolean(hostApplication.show_full_name)}
                />
                <span>Show my full name publicly</span>
              </label>
            </EditorSection>

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
                <GoogleAddressField
                  name="exactAddress"
                  latitudeName="latitude"
                  longitudeName="longitude"
                  defaultValue={hostApplication.exact_address || ''}
                  defaultLatitude={hostApplication.latitude ?? null}
                  defaultLongitude={hostApplication.longitude ?? null}
                  placeholder="Start typing an address in Jerusalem..."
                  required
                  className={inputClass}
                />
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
              <div className="mt-5">
                <Field label="Sleeping setup">
                  <textarea
                    name="sleepingSetup"
                    rows={5}
                    defaultValue={hostApplication.sleeping_setup || ''}
                    placeholder={`Example:\nBedroom 1: king bed\nBedroom 2: two single beds\nLiving room: sofa bed`}
                    className={`${inputClass} resize-y`}
                  />
                </Field>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Help guests understand exactly where everyone will sleep.
                </p>
              </div>
            </EditorSection>

            <EditorSection title="Pricing">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Preferred currency">
                  <select name="currencyPreference" defaultValue={hostApplication.currency_preference || 'ILS'} className={inputClass}>
                    <option value="ILS">ILS</option>
                    <option value="USD">USD</option>
                    <option value="Both">Both</option>
                  </select>
                </Field>
                <Field label="Price ILS">
                  <input name="priceIls" type="number" min="0" defaultValue={hostApplication.price_ils ?? ''} className={inputClass} />
                </Field>
                <Field label="Price USD">
                  <input name="priceUsd" type="number" min="0" defaultValue={hostApplication.price_usd ?? ''} className={inputClass} />
                </Field>
              </div>
            </EditorSection>

            <EditorSection title="Amenities">
              <AmenitySelector defaultSelectedAmenities={hostApplication.amenities || []} />
            </EditorSection>

            <EditorSection title="Description">
              <div className="mb-5">
                <ListingAiAssistant
                  formId="host-application-edit-form"
                  titleField="title"
                  areaField="area"
                  bedroomsField="bedrooms"
                  bathroomsField="bathrooms"
                  guestsField="sleeps"
                  amenitiesField="amenities"
                  descriptionField="description"
                />
              </div>
              <textarea
                name="description"
                defaultValue={hostApplication.description || ''}
                rows={8}
                required
                className={`${inputClass} resize-y`}
              />
            </EditorSection>

            <EditorSection title="Photos">
              <Field label="Photo link">
                <input
                  name="photoLink"
                  type="url"
                  defaultValue={hostApplication.photo_link || ''}
                  placeholder="https://..."
                  className={inputClass}
                />
              </Field>
              <div className="mt-5">
                <ApplicationPhotoManager applicationId={hostApplication.id} initialPhotos={applicationPhotos} />
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-500">
                The first photo is treated as the cover image. Add a photo link as backup if you are sharing a professional gallery.
              </p>
            </EditorSection>

            <EditorSection title="Verification">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Property document type">
                  <select name="verificationDocType" defaultValue={hostApplication.verification_doc_type || ''} required className={inputClass}>
                    <option value="">Choose document type</option>
                    <option value="arnona">Arnona / municipal bill</option>
                    <option value="mortgage_statement">Mortgage statement</option>
                    <option value="lease_agreement">Lease agreement</option>
                    <option value="authorisation_letter">Letter of authorisation</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Identity document type">
                  <select name="idDocType" defaultValue={hostApplication.id_doc_type || ''} required className={inputClass}>
                    <option value="">Choose ID type</option>
                    <option value="passport">Passport</option>
                    <option value="teudat_zehut">Teudat Zehut</option>
                    <option value="driving_license">Driving licence</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
            </EditorSection>

            <div className="flex justify-end">
              <button className="rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]">
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
    </div>
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
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

function hostStatusLabel(status: string) {
  if (status === 'new') return 'In review'
  if (status === 'changes_requested') return 'Changes requested'
  return status.replaceAll('_', ' ')
}
