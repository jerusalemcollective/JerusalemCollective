-- 091_finalize_records_real_deposit.sql
--
-- Low/latent audit fix. finalize_instant_booking wrote bookings.deposit_amount_*
-- as a flat 10% of the stay, which no longer matches the host-configured deposit
-- actually collected (booking_payments.amount). The field isn't rendered today,
-- but any future report reading it would misstate what the guest paid.
--
-- This is a verbatim re-creation of 076 with ONE change: read the real deposit +
-- currency from the session's booking_payments row and record that (in the paid
-- currency) instead of a flat 10%. All idempotency / advisory-lock / calendar /
-- payment-update logic from 076 is byte-for-byte unchanged. If the row can't be
-- read for any reason, it falls back to the old 10% estimate (never null/zero).

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
  v_deposit numeric;
  v_currency text;
begin
  if listing_uuid is null or guest_uuid is null or host_uuid is null then
    raise exception 'Missing booking parties.';
  end if;

  if check_in_date is null or check_out_date is null or check_out_date <= check_in_date then
    raise exception 'Valid booking dates are required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(checkout_session_id));

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

  -- The real deposit actually charged for this session (host-configured), and
  -- the currency it was charged in.
  select amount, currency
  into v_deposit, v_currency
  from public.booking_payments
  where stripe_checkout_session_id = checkout_session_id
  limit 1;

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
    case
      when v_currency = 'USD' and v_deposit is not null then greatest(round(v_deposit)::integer, 1)
      when listing_price_usd is not null then greatest(round(listing_price_usd * booking_nights * 0.1)::integer, 1)
      else null
    end,
    case
      when v_currency = 'ILS' and v_deposit is not null then greatest(round(v_deposit)::integer, 1)
      when listing_price_ils is not null then greatest(round(listing_price_ils * booking_nights * 0.1)::integer, 1)
      else null
    end,
    public.current_platform_commission_percent(),
    'confirmed', 'deposit_received', now()
  )
  returning * into booking_record;

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
