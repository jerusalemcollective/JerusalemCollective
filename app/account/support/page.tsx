import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import {
  SupportCaseClientForm,
  type AccountSupportCase,
  type SupportBooking,
} from '@/components/support-case-client-form'

export default async function AccountSupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/support')
  }

  const [{ data: bookingRows }, { data: caseRows }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, listing_id, host_id, check_in, check_out, listings(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('support_cases')
      .select('id, case_type, status, reason, requested_amount, approved_refund_amount, currency, created_at, listings(title)')
      .eq('guest_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-5xl">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Support' }]} />

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Support</h1>
          <p className="mt-2 text-stone-600">
            Ask for help with a booking, dispute, or refund request and keep the history in one place.
          </p>
        </div>

        <Suspense fallback={<SupportFormSkeleton />}>
          <SupportCaseClientForm
            userId={user.id}
            initialBookings={(bookingRows || []) as SupportBooking[]}
            initialCases={(caseRows || []) as AccountSupportCase[]}
          />
        </Suspense>
      </section>
    </main>
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
