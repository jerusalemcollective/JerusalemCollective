import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const reviewDate = new Date()
  reviewDate.setDate(reviewDate.getDate() - 2)
  const reviewDateISO = reviewDate.toISOString().slice(0, 10)

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, user_id, ' +
        'listings(title, area), ' +
        'profiles!bookings_user_id_fkey' +
        '(full_name, email: raw_email)',
    )
    .eq('check_out', reviewDateISO)
    .is('review_request_sent_at', null)
    .eq('status', 'confirmed')

  let sent = 0
  const errors: string[] = []

  for (const booking of bookings || []) {
    const guest = booking.profiles as {
      full_name: string | null
      email: string | null
    } | null

    const listing = booking.listings as {
      title: string | null
      area: string | null
    } | null

    if (!guest?.email) continue

    const guestName = guest.full_name?.split(' ')[0] || 'there'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'JLM Collective <hello@jlmcollective.co>',
          to: [guest.email],
          subject:
            `How was your stay at ` +
            `${listing?.title || 'your Jerusalem stay'}?`,
          html: `
            <div style="font-family:
              sans-serif; max-width: 520px;
              margin: 0 auto;
              color: #1c1917;">
              <p>Hi ${guestName},</p>
              <p>We hope you had a
                wonderful stay at
                <strong>
                  ${listing?.title || 'your Jerusalem apartment'}
                </strong>
                ${listing?.area ? `in ${listing.area}` : ''}.
              </p>
              <p>It would mean a lot
                to the host — and to
                future guests — if you
                could share a few words
                about your experience.
              </p>
              <p style="margin: 28px 0;">
                <a href="https://jlmcollective.co/account/reviews"
                  style="background: #c76f55;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 999px;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 14px;">
                  Leave a review
                </a>
              </p>
              <p style="color: #78716c;
                font-size: 13px;">
                Thank you for staying
                with JLM Collective.
              </p>
            </div>
          `,
        }),
      })

      if (res.ok) {
        await supabase
          .from('bookings')
          .update({
            review_request_sent_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
        sent++
      }
    } catch (err) {
      errors.push(`booking ${booking.id}: ${err}`)
    }
  }

  return new Response(JSON.stringify({ sent, errors }), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
})
