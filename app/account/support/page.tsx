import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { SupportCaseClientForm } from '@/components/support-case-client-form'
import { ContactJlmButton } from '@/components/contact-jlm-button'
import { getReportWindowDays, reportWindowCutoffISO } from '@/lib/report-window'

const supportBookingSchema = z.object({
  id: z.string(),
  listing_id: z.string().nullable().transform((value) => value ?? ''),
  host_id: z.string().nullable(),
  check_in: z.string().nullable().transform((value) => value ?? ''),
  check_out: z.string().nullable().transform((value) => value ?? ''),
  listings: z
    .object({
      title: z.string(),
    })
    .nullable(),
})

const accountSupportCaseSchema = z.object({
  id: z.string(),
  case_type: z.string(),
  status: z.string(),
  reason: z.string().nullable().transform((value) => value ?? ''),
  requested_amount: z.number().nullable(),
  approved_refund_amount: z.number().nullable().transform((value) => value ?? 0),
  currency: z.string().nullable(),
  created_at: z.string().nullable().transform((value) => value ?? ''),
  guest_response: z.string().nullable(),
  host_response: z.string().nullable(),
  listings: z
    .object({
      title: z.string(),
    })
    .nullable(),
})

export default async function AccountSupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/support')
  }

  const reportWindowDays = await getReportWindowDays(supabase)
  const reportCutoff = reportWindowCutoffISO(reportWindowDays)

  const [{ data: bookingRows }, { data: caseRows }] = await Promise.all([
    // Only stays still inside the admin-set reporting window are reportable.
    supabase
      .from('bookings')
      .select('id, listing_id, host_id, check_in, check_out, listings(title)')
      .eq('user_id', user.id)
      .gte('check_out', reportCutoff)
      .order('created_at', { ascending: false }),
    supabase
      .from('support_cases')
      .select('id, case_type, status, reason, requested_amount, approved_refund_amount, currency, created_at, guest_response, host_response, listings(title)')
      .eq('guest_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Support' }]} />

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Support</h1>
          <ContactJlmButton />
        </div>

        <Suspense fallback={<SupportFormSkeleton />}>
          <SupportCaseClientForm
            userId={user.id}
            initialBookings={z.array(supportBookingSchema).parse(bookingRows ?? [])}
            initialCases={z.array(accountSupportCaseSchema).parse(caseRows ?? [])}
          />
        </Suspense>
      </section>
    </div>
  )
}

function SupportFormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-5">
          <div className="h-5 w-40 rounded bg-stone-200" />
          <div className="h-12 rounded-2xl bg-stone-200" />
          <div className="h-12 rounded-2xl bg-stone-200" />
          <div className="h-32 rounded-2xl bg-stone-200" />
          <div className="h-11 w-36 rounded-full bg-stone-200" />
        </div>
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-36 rounded bg-stone-200" />
          <div className="h-20 rounded-2xl bg-stone-200" />
          <div className="h-20 rounded-2xl bg-stone-200" />
        </div>
      </div>
    </div>
  )
}
