-- 089_balance_payment_hardening.sql
--
-- Fixes money-safety defects found in a pre-go-live adversarial review of the
-- host-deposit / on-site balance-payment feature (086-088):
--
--  1. CRITICAL — one cheap balance session could settle many bookings:
--     mark_balance_paid was a bulk UPDATE keyed only on the (mutable) session id,
--     and attach could point one session at many rows. Now settlement is scoped
--     to a single payment id AND the paid amount+currency must match the row.
--  2. HIGH — a vestigial RLS INSERT policy let any authenticated user forge a
--     booking_payments row (balance_status='paid', arbitrary payout/host). The
--     only real writer is the SECURITY DEFINER create_pending_booking_payment,
--     so drop the policy and revoke client INSERT.
--  3. HIGH — cancelling a booking left balance_status='due', so the guest kept a
--     Pay-balance button + reminder emails and could pay for a cancelled stay.
--     cancel_guest_booking now waives the balance.
--  4. HIGH — the balance could be paid before the deposit settled, and a stale
--     session could orphan a real payment. attach + settle now require the
--     deposit to be settled (status='paid') and never overwrite a session id.

-- ---------------------------------------------------------------------------
-- 1. Lock down direct writes to booking_payments (defect 2)
-- ---------------------------------------------------------------------------
drop policy if exists "Guests can create own pending booking payments" on public.booking_payments;
-- The booking/deposit path only ever inserts via the SECURITY DEFINER
-- create_pending_booking_payment RPC (086), which runs as owner and bypasses
-- RLS, so no client INSERT is needed. UPDATE grants are left intact for the
-- existing host/admin RLS update paths.
revoke insert on public.booking_payments from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. One Stripe balance session can bind to at most one row (defect 1)
-- ---------------------------------------------------------------------------
create unique index if not exists booking_payments_balance_session_uniq
  on public.booking_payments (balance_checkout_session_id)
  where balance_checkout_session_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Harden attach: only a settled deposit, never overwrite a session (defects 1,4)
-- ---------------------------------------------------------------------------
create or replace function public.attach_balance_checkout_session(
  payment_uuid uuid,
  checkout_session_id text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  payment_record public.booking_payments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in.';
  end if;
  if coalesce(trim(checkout_session_id), '') = '' then
    raise exception 'A checkout session id is required.';
  end if;

  update public.booking_payments
  set balance_checkout_session_id = checkout_session_id,
      updated_at = now()
  where id = payment_uuid
    and guest_id = current_user_id
    and status = 'paid'                        -- deposit settled + booking finalised
    and balance_status = 'due'
    and balance_amount > 0
    and balance_checkout_session_id is null    -- never overwrite an existing session
  returning * into payment_record;

  if payment_record.id is null then
    raise exception 'That balance could not be linked to a checkout session.';
  end if;

  return payment_record;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Settle exactly one row, amount-verified, deposit-settled, not cancelled
--    (defects 1,3,4). New signature; drop the old single-arg version.
-- ---------------------------------------------------------------------------
drop function if exists public.mark_balance_paid(text);

create or replace function public.mark_balance_paid(
  p_payment_id uuid,
  p_session_id text,
  p_amount_minor bigint,
  p_currency text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments%rowtype;
begin
  if p_payment_id is null then
    return null;
  end if;

  update public.booking_payments bp
  set balance_status = 'paid',
      balance_paid_at = now(),
      host_payout_amount = coalesce(bp.host_payout_amount, 0) + coalesce(bp.balance_amount, 0),
      updated_at = now()
  where bp.id = p_payment_id
    and bp.balance_checkout_session_id = p_session_id
    and bp.balance_status = 'due'
    and bp.status = 'paid'                                       -- deposit settled
    and round(coalesce(bp.balance_amount, 0) * 100)::bigint = p_amount_minor
    and lower(coalesce(bp.currency, '')) = lower(coalesce(p_currency, ''))
    and (bp.booking_id is null or not exists (
      select 1 from public.bookings b
      where b.id = bp.booking_id and b.status = 'cancelled'
    ))
  returning bp.* into payment_record;

  -- Null => nothing matched (already paid / amount mismatch / cancelled /
  -- unsettled deposit / stale session). The webhook escalates that to manual
  -- review rather than acknowledging captured money it did not record.
  if payment_record.id is null then
    return null;
  end if;

  return payment_record;
end;
$$;

revoke all on function public.mark_balance_paid(uuid, text, bigint, text) from public;
grant execute on function public.mark_balance_paid(uuid, text, bigint, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Waive the balance when a booking is cancelled (defect 3)
--    Verbatim 067 cancel_guest_booking + one balance-waive statement.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_guest_booking(booking_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = booking_uuid;

  if b.id is null then
    raise exception 'Booking not found';
  end if;
  if b.user_id <> auth.uid() then
    raise exception 'You can only cancel your own bookings';
  end if;
  if b.status = 'cancelled' then
    return;
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = booking_uuid;

  delete from public.listing_unavailable_ranges
  where listing_id = b.listing_id
    and start_date = b.check_in
    and end_date = b.check_out
    and source = 'booking';

  -- An unpaid balance is no longer owed once the stay is cancelled. This stops
  -- the Pay-balance button, the /api/pay-balance route, and the reminder cron
  -- (all gate on balance_status='due').
  update public.booking_payments
  set balance_status = 'waived', updated_at = now()
  where booking_id = booking_uuid and balance_status = 'due';
end;
$$;
