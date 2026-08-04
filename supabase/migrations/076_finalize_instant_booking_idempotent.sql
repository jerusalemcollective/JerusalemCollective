-- 076_finalize_instant_booking_idempotent.sql
--
-- Audit M4 + adversarial F1. finalize_instant_booking (059:363-459) did an
-- UNCONDITIONAL INSERT into bookings, guarded only by bookings_no_overlap_confirmed
-- (067:22-29). A webhook retry — or the new two finalize triggers for one session
-- (completed-paid AND async_payment_succeeded) — re-ran it, tripped the exclusion
-- constraint, and the webhook then falsely flagged the ALREADY-VALID booking
-- needs_manual_review (073) and emailed an admin.
--
-- Fix: make the function idempotent AND concurrency-safe, keyed by the checkout
-- session (the same key it already uses to stamp booking_payments):
--   * pg_advisory_xact_lock serializes concurrent finalizers for the SAME session
--     so the loser blocks until the winner commits, then short-circuits instead of
--     racing into the exclusion constraint. (finalize_paid_booking_request already
--     gets this via SELECT ... FOR UPDATE on booking_requests, 059:256-260.)
--   * a session-scoped short-circuit returns the existing booking unchanged.
--   * the calendar-block insert is made collision-proof (mirrors 059:342-349).
--
-- This does NOT weaken the F1 double-booking guard: the lock keys on the checkout
-- session, so two DIFFERENT sessions on overlapping dates still collide on
-- bookings_no_overlap_confirmed as intended. finalize_paid_booking_request is
-- already idempotent + serialized and is left untouched.

create or replace function public.finalize_instant_booking(
  listing_uuid uuid,
  guest_uuid uuid,
  host_uuid uuid,
  check_in_date date,
  check_out_date date,
  guest_count integer,
  checkout_session_id text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.bookings%rowtype;
  existing_booking_id uuid;
  listing_price_usd numeric;
  listing_price_ils numeric;
  booking_nights integer;
begin
  if listing_uuid is null or guest_uuid is null or host_uuid is null then
    raise exception 'Missing booking parties.';
  end if;

  if check_in_date is null or check_out_date is null or check_out_date <= check_in_date then
    raise exception 'Valid booking dates are required.';
  end if;

  -- F1: serialize concurrent finalizers for THIS checkout session. The loser
  -- blocks here until the winner commits, then sees existing_booking_id below
  -- and short-circuits. Transaction-scoped; auto-released at commit/rollback.
  perform pg_advisory_xact_lock(hashtext(checkout_session_id));

  -- M4 idempotency: if this session already finalized a booking, return it.
  select bp.booking_id
  into existing_booking_id
  from public.booking_payments bp
  where bp.stripe_checkout_session_id = checkout_session_id
    and bp.booking_id is not null
  limit 1;

  if existing_booking_id is not null then
    select * into booking_record from public.bookings where id = existing_booking_id;
    if booking_record.id is not null then
      return booking_record;
    end if;
  end if;

  select price_usd, price_ils
  into listing_price_usd, listing_price_ils
  from public.listings
  where id = listing_uuid;

  booking_nights := greatest((check_out_date - check_in_date), 1);

  insert into public.bookings (
    user_id, listing_id, host_id, check_in, check_out, guests,
    total_amount_usd, total_amount_ils, deposit_amount_usd, deposit_amount_ils,
    commission_percent, status, payment_status, payment_updated_at
  )
  values (
    guest_uuid, listing_uuid, host_uuid, check_in_date, check_out_date,
    greatest(coalesce(guest_count, 1), 1),
    case when listing_price_usd is not null then round(listing_price_usd * booking_nights)::integer else null end,
    case when listing_price_ils is not null then round(listing_price_ils * booking_nights)::integer else null end,
    case when listing_price_usd is not null then greatest(round(listing_price_usd * booking_nights * 0.1)::integer, 1) else null end,
    case when listing_price_ils is not null then greatest(round(listing_price_ils * booking_nights * 0.1)::integer, 1) else null end,
    public.current_platform_commission_percent(),
    'confirmed', 'deposit_received', now()
  )
  returning * into booking_record;

  -- Collision-proof calendar block (mirror the paid-request path, 059:342-349),
  -- so a partial re-run cannot duplicate the range.
  insert into public.listing_unavailable_ranges (
    listing_id, host_id, start_date, end_date, reason, source
  )
  select listing_uuid, host_uuid, check_in_date, check_out_date, 'Booking confirmed', 'booking'
  where not exists (
    select 1 from public.listing_unavailable_ranges
    where listing_id = listing_uuid
      and start_date = check_in_date
      and end_date = check_out_date
      and source = 'booking'
  );

  update public.booking_payments
  set booking_id = booking_record.id,
      status = 'paid',
      paid_at = now(),
      payout_status = 'ready',
      updated_at = now()
  where stripe_checkout_session_id = checkout_session_id;

  return booking_record;
end;
$$;

revoke all on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) from public;
grant execute on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) to service_role;
