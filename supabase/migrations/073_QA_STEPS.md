# Batch A — manual QA steps

This repo has no test runner wired, so these are the manual checks for the
booking/money edge cases fixed in migration 073 and the accompanying code.

Run migration `073_payment_exception_handling.sql` **before** deploying the code
(the code selects the new columns).

Optional: set `ADMIN_ALERT_EMAIL` in Vercel to control where failure alerts go.
If unset, alerts fall back to the email of every owner admin.

## 1. Same-day checkout / check-in availability

- Block a listing for dates [Jul 10 → Jul 15] (a booking whose `end_date` is the
  15th).
- On `/stays`, search check-in **Jul 15**, check-out Jul 18.
- Expected: the listing **still appears** (a stay ending the 15th does not
  conflict with one starting the 15th).
- Before this fix it was hidden. Book-now already allowed it, so search and
  booking now agree.

## 2. Overlapping unavailable dates

- Same block [Jul 10 → Jul 15].
- Search check-in Jul 12, check-out Jul 14 (fully inside the block).
- Expected: the listing is **hidden** in `/stays`, and Book now on the listing
  returns "These dates are no longer available."

## 3. Stripe paid-but-booking-failed recovery

Simulate a finalize failure (e.g. temporarily point `finalize_instant_booking`
at a bad value in a test DB, or use the Stripe CLI to deliver an event whose
metadata references a listing that will fail the RPC).

- Complete a test-mode checkout (`4242 4242 4242 4242`).
- Expected:
  - The webhook returns 500 (so Stripe will retry).
  - `booking_payments` row for that session has `needs_manual_review = true`,
    `failure_reason` set, `stripe_payment_intent_id` populated.
  - Exactly **one** admin alert email is sent, even across Stripe's retries.
  - `/account/bookings?payment=success` shows the amber "we're confirming this
    manually" banner — **not** the green confirmed banner.
  - `/admin/payments` shows the payment under "Payments needing manual review"
    and the "Needs review" metric is non-zero.
- Then remove the simulated failure and let Stripe retry (or resend the event):
  the retry succeeds, `needs_manual_review` clears, and the payment drops off
  the exceptions list.

## 4. Duplicate webhook event handling (idempotency preserved)

- Using the Stripe CLI, deliver the same `checkout.session.completed` event id
  twice.
- Expected: the second delivery returns `{ ok: true, duplicate: true }`, no
  second booking is created, and no second charge/refund occurs.

## 5. Admin can see exceptions at all (RLS)

- As an **owner** admin, open `/admin/payments`.
- Expected: you see platform-wide payments, not just your own. (Before migration
  073 there was no admin SELECT policy on `booking_payments`, so the list was
  effectively empty for admins who weren't themselves the host/guest.)

## Known limitation (follow-up)

Resolving an exception is currently manual: either a Stripe retry succeeds and
auto-clears it, or you clear `needs_manual_review` in Supabase after handling it.
A one-click "mark resolved / record refund" admin action (using the new
`stripe_refund_id` / `refunded_at` columns) is a small follow-up if wanted — it
needs an admin UPDATE policy on `booking_payments` plus a server action.
