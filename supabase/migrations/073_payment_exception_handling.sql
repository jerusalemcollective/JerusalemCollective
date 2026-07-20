-- 073_payment_exception_handling.sql
--
-- Batch A: booking/money edge cases. When a guest is charged but the booking
-- cannot be finalised (the finalize_* RPC fails after Stripe took the money),
-- the payment must not silently disappear. These columns let the webhook flag
-- the payment for manual review, store why, and let admins see and resolve it.
--
-- stripe_payment_intent_id already exists (migration 010) and is intentionally
-- NOT re-added here; the webhook now populates it.

alter table public.booking_payments
  add column if not exists needs_manual_review boolean not null default false,
  add column if not exists manual_review_reason text,
  add column if not exists failure_reason text,
  add column if not exists admin_alerted_at timestamptz,
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz;

comment on column public.booking_payments.needs_manual_review is
  'True when Stripe captured payment but the booking could not be finalised automatically. Cleared if a webhook retry later succeeds.';
comment on column public.booking_payments.manual_review_reason is
  'Human-readable reason the payment needs manual review.';
comment on column public.booking_payments.failure_reason is
  'Technical error from the finalize step, for debugging.';
comment on column public.booking_payments.stripe_refund_id is
  'Set by an admin when a refund is issued in Stripe; recorded here for reconciliation.';

-- Exceptions are queried on their own, most-recent-first. Partial index keeps
-- it tiny since the common case is zero rows.
create index if not exists booking_payments_manual_review_idx
  on public.booking_payments (created_at desc)
  where needs_manual_review;

-- booking_payments had SELECT policies only for the owning host and guest, so
-- /admin/payments (owner-gated in the app) could only ever see the admin's own
-- payments, never the platform's — and the new exceptions view would show
-- nothing. Add the missing admin read policy. The webhook writes via the
-- service-role client, which bypasses RLS, so no admin write policy is needed.
drop policy if exists "Admins can view all booking payments" on public.booking_payments;
create policy "Admins can view all booking payments"
on public.booking_payments
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
