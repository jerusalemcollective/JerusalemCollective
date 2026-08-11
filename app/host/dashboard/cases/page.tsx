import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { oneOrNull } from '@/lib/utils/one-or-null'
import { ContactJlmButton } from '@/components/contact-jlm-button'
import { HostSupportCaseForm, type HostCaseBooking } from '@/components/host-support-case-form'

type HostSupportCase = {
  id: string
  case_type: string
  status: string
  reason: string
  created_at: string
  requested_amount: number | null
  approved_refund_amount: number
  currency: string | null
  listings?: {
    title: string
  } | null
  guest?: {
    full_name: string | null
  } | null
}

type HostSupportCaseRow = Omit<HostSupportCase, 'listings' | 'guest'> & {
  listings?: HostSupportCase['listings'] | NonNullable<HostSupportCase['listings']>[] | null
  guest?: HostSupportCase['guest'] | NonNullable<HostSupportCase['guest']>[] | null
}

type BookingRow = {
  id: string
  check_in: string
  check_out: string
  listings?: { title: string } | { title: string }[] | null
}

export default async function HostSupportPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: caseData }, { data: bookingData }] = await Promise.all([
    supabase
      .from('support_cases')
      .select(`
        id,
        case_type,
        status,
        reason,
        created_at,
        requested_amount,
        approved_refund_amount,
        currency,
        listings(title),
        guest:profiles!support_cases_guest_id_fkey(full_name)
      `)
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('id, check_in, check_out, listings(title)')
      .in('host_id', hostIds)
      .order('check_in', { ascending: false })
      .limit(50),
  ])

  const cases: HostSupportCase[] = (caseData || []).map((supportCase: HostSupportCaseRow) => ({
    id: supportCase.id,
    case_type: supportCase.case_type,
    status: supportCase.status,
    reason: supportCase.reason,
    created_at: supportCase.created_at,
    requested_amount: supportCase.requested_amount,
    approved_refund_amount: supportCase.approved_refund_amount,
    currency: supportCase.currency,
    listings: oneOrNull(supportCase.listings),
    guest: oneOrNull(supportCase.guest),
  }))

  const bookings: HostCaseBooking[] = (bookingData || []).map((booking: BookingRow) => ({
    id: booking.id,
    check_in: booking.check_in,
    check_out: booking.check_out,
    title: oneOrNull(booking.listings)?.title || 'Stay',
  }))

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-stone-950">Support</h1>
          </div>
          <ContactJlmButton />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {user && <HostSupportCaseForm userId={user.id} bookings={bookings} />}

          <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="border-b border-stone-100 px-6 py-4">
              <h2 className="text-xl font-bold text-stone-950">Your cases</h2>
            </div>

            {cases.length === 0 ? (
              <div className="px-6 py-12 text-center text-stone-500">No cases yet.</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {cases.map((supportCase) => (
                  <article key={supportCase.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={supportCase.status} />
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
                        {supportCase.case_type.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold text-stone-950">{supportCase.reason}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      {supportCase.listings?.title || 'Stay'} · {supportCase.guest?.full_name || 'Guest'} · opened{' '}
                      {new Date(supportCase.created_at).toLocaleDateString('en-GB')}
                    </p>
                    {(supportCase.approved_refund_amount || supportCase.requested_amount) && (
                      <p className="mt-2 text-sm text-stone-700">
                        {supportCase.approved_refund_amount
                          ? `${supportCase.currency || ''} ${supportCase.approved_refund_amount.toLocaleString()} approved`
                          : `${supportCase.currency || ''} ${(supportCase.requested_amount || 0).toLocaleString()} requested`}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'resolved'
      ? 'bg-green-100 text-green-700'
      : status === 'closed'
        ? 'bg-stone-100 text-stone-700'
        : status === 'under_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-rose-100 text-rose-700'

  return (
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${styles}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
