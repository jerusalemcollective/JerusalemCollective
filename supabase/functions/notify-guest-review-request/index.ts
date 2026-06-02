import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.jlmcollective.co'

type BookingRow = {
  id: string
  profiles:
    | {
        full_name: string | null
        email: string | null
      }
    | {
        full_name: string | null
        email: string | null
      }[]
    | null
  listings:
    | {
        title: string | null
        area: string | null
      }
    | {
        title: string | null
        area: string | null
      }[]
    | null
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const reviewDate = new Date()
  reviewDate.setDate(reviewDate.getDate() - 2)
  const reviewDateISO = reviewDate.toISOString().slice(0, 10)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      'id, user_id, check_in, check_out, listings(title, area), profiles!bookings_user_id_fkey(full_name, email)',
    )
    .eq('check_out', reviewDateISO)
    .is('review_request_sent_at', null)
    .eq('status', 'confirmed')
    .returns<BookingRow[]>()

  if (error) {
    return jsonResponse({ sent: 0, errors: [error.message] }, 500)
  }

  let sent = 0
  const errors: string[] = []

  for (const booking of bookings || []) {
    const guest = normalizeRelation(booking.profiles)
    const listing = normalizeRelation(booking.listings)

    if (!guest?.email) continue

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'JLM Collective <no-reply@jlmcollective.co>',
          to: [guest.email],
          reply_to: 'info@jlmcollective.co',
          subject: `How was your JLM Collective stay?`,
          html: reviewRequestEmailHtml({
            bookingId: booking.id,
            guestName: guest.full_name?.split(' ')[0] || 'there',
            listingTitle: listing?.title || 'your Jerusalem stay',
            listingArea: listing?.area || null,
          }),
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
      } else {
        errors.push(`booking ${booking.id}: ${await res.text()}`)
      }
    } catch (err) {
      errors.push(`booking ${booking.id}: ${err}`)
    }
  }

  return jsonResponse({ sent, errors })
})

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value
}

function reviewRequestEmailHtml({
  bookingId,
  guestName,
  listingTitle,
  listingArea,
}: {
  bookingId: string
  guestName: string
  listingTitle: string
  listingArea: string | null
}) {
  const reviewUrl = `${SITE_URL}/account/reviews?booking=${encodeURIComponent(bookingId)}`
  const starLinks = [1, 2, 3, 4, 5]
    .map((rating) => {
      const href = `${reviewUrl}&rating=${rating}`
      return `
        <a href="${href}"
          style="display:inline-block;margin:0 3px;padding:10px 11px;border:1px solid #ead8cf;border-radius:999px;background:#fff7f3;color:#c76f55;text-decoration:none;font-size:20px;line-height:1;"
          aria-label="${rating} star${rating === 1 ? '' : 's'}">
          ${'★'.repeat(rating)}
        </a>
      `
    })
    .join('')

  return `
    <div style="margin:0;padding:0;background:#F8F5F2;font-family:Arial,sans-serif;color:#292524;">
      <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
        <div style="margin-bottom:18px;text-align:center;">
          <p style="margin:0;color:#c76f55;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">
            JLM Collective
          </p>
        </div>

        <div style="background:#ffffff;border:1px solid #eee7e1;border-radius:24px;padding:30px;box-shadow:0 14px 40px rgba(41,37,36,0.08);">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#57534e;">
            Hi ${escapeHtml(guestName)},
          </p>
          <h1 style="margin:0;color:#1c1917;font-size:26px;line-height:1.25;">
            How was your stay?
          </h1>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#57534e;">
            We hope your time in Jerusalem was comfortable and memorable. Your feedback helps us keep every represented property clear, trustworthy, and ready for future guests.
          </p>

          <div style="margin:24px 0;padding:16px 18px;border-radius:18px;background:#F8F5F2;">
            <p style="margin:0;color:#1c1917;font-size:15px;font-weight:700;">
              ${escapeHtml(listingTitle)}
            </p>
            ${
              listingArea
                ? `<p style="margin:4px 0 0;color:#78716c;font-size:13px;">${escapeHtml(listingArea)}</p>`
                : ''
            }
          </div>

          <p style="margin:0 0 12px;color:#1c1917;font-size:15px;font-weight:700;">
            Tap a rating to start:
          </p>
          <div style="margin:0 0 24px;text-align:center;">
            ${starLinks}
          </div>

          <p style="margin:26px 0;text-align:center;">
            <a href="${reviewUrl}"
              style="display:inline-block;background:#c76f55;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 24px;font-weight:700;font-size:14px;">
              Leave a review
            </a>
          </p>

          <p style="margin:0;color:#78716c;font-size:13px;line-height:1.6;text-align:center;">
            Reviews are checked by JLM Collective before appearing publicly. If you need help with anything from your stay, you can reply directly to this email.
          </p>
        </div>

        <p style="margin:18px auto 0;max-width:500px;color:#a8a29e;font-size:11px;line-height:1.6;text-align:center;">
          JLM Collective is a specialist Jerusalem letting agency. We market and let verified Jerusalem properties on behalf of property owners.
        </p>
      </div>
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function jsonResponse(body: { sent: number; errors: string[] }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
