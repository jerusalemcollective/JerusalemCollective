-- 092_deposit_commission_floor_and_due_clamp.sql
--
-- Two robustness fixes to create_pending_booking_payment (from the final
-- pre-go-live sweep), both currently latent (platform commission is 0):
--
--  1. If a host's deposit is smaller than the platform commission (e.g. a low
--     fixed deposit once a commission is enabled), 086 RAISED a guest-facing
--     error and the listing became unbookable. Instead, floor the collected
--     deposit up to the commission so the commission is always covered and the
--     booking never hard-fails. (Commission is <= total, so the floor stays
--     within the total.)
--  2. balance_due_date could land in the past when a host sets a long lead and
--     the guest books a soon check-in. Clamp it to today so the guest never
--     sees "due by <past date>".
--
-- Verbatim re-creation of 086's create_pending_booking_payment with only the
-- deposit-floor, due-date clamp, and removal of the now-unreachable raise.

create or replace function public.create_pending_booking_payment(
  listing_uuid uuid,
  check_in_date date,
  check_out_date date,
  guest_count integer
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  listing_record public.listings%rowtype;
  profile_record public.host_payment_profiles%rowtype;
  nights integer;
  nightly numeric;
  currency_code text;
  booking_total numeric;
  deposit_amount numeric;
  balance_amount numeric;
  balance_due_dt date;
  balance_stat text;
  commission_pct numeric;
  commission_amount numeric;
  host_amount numeric;
  payment_record public.booking_payments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in before booking.';
  end if;

  if not exists (
    select 1 from public.platform_settings
    where key = 'jlm_payments_enabled' and value <> 'false'
  ) then
    raise exception 'Online booking is currently unavailable.';
  end if;

  if check_in_date is null or check_out_date is null or check_out_date <= check_in_date then
    raise exception 'Check-out must be after check-in.';
  end if;

  nights := (check_out_date - check_in_date);

  select * into listing_record
  from public.listings
  where id = listing_uuid;

  if listing_record.id is null
    or not coalesce(listing_record.is_published, false)
    or not coalesce(listing_record.online_payment_enabled, false)
  then
    raise exception 'This stay is not available for online booking.';
  end if;

  if listing_record.host_id is null then
    raise exception 'Host is not available for this listing.';
  end if;

  select * into profile_record
  from public.host_payment_profiles
  where host_id = listing_record.host_id;

  if not coalesce(profile_record.accepts_jlm_payment, false) then
    raise exception 'This host has not enabled JLM online payment yet.';
  end if;

  if listing_record.price_usd is not null then
    currency_code := 'USD';
    nightly := listing_record.price_usd;
  elsif listing_record.price_ils is not null then
    currency_code := 'ILS';
    nightly := listing_record.price_ils;
  else
    raise exception 'This stay does not have an online booking price yet.';
  end if;

  if not (currency_code = any(coalesce(profile_record.payout_currencies, array[]::text[]))) then
    raise exception 'This host has not enabled payouts in this listing currency yet.';
  end if;

  booking_total := round(nightly * nights, 2);

  -- Commission is charged on the whole booking (rate <= 100, so <= total).
  commission_pct := greatest(
    coalesce(
      profile_record.commission_percent_override,
      public.current_platform_commission_percent(),
      0
    ),
    0
  );
  commission_amount := round(booking_total * commission_pct / 100, 2);

  -- Host-set deposit: a percentage of the total OR a fixed amount in the booking
  -- currency.
  if coalesce(listing_record.deposit_type, 'percent') = 'fixed' then
    deposit_amount := round(coalesce(listing_record.deposit_value, 0), 2);
  else
    deposit_amount := round(booking_total * (coalesce(listing_record.deposit_value, 10) / 100.0), 2);
  end if;

  -- Clamp: at least Stripe's ~0.50 floor and at least the commission we must
  -- remit, and never more than the whole booking.
  deposit_amount := least(greatest(deposit_amount, 0.50, commission_amount), booking_total);

  balance_amount := round(booking_total - deposit_amount, 2);
  if balance_amount < 0 then
    balance_amount := 0;
  end if;

  -- Never a due date in the past.
  balance_due_dt := greatest(check_in_date - coalesce(listing_record.balance_due_days_before_checkin, 0), current_date);
  balance_stat := case when balance_amount > 0 then 'due' else 'none' end;

  -- Deposit now covers the commission, so the host share is never negative.
  host_amount := greatest(deposit_amount - commission_amount, 0);

  insert into public.booking_payments (
    host_id, guest_id, payment_mode, currency, amount,
    booking_total_amount, commission_percent, platform_fee_amount,
    processor_fee_amount, host_payout_amount, host_payout_currency,
    fx_rate_used, status, payout_status,
    balance_amount, balance_due_date, balance_status
  )
  values (
    listing_record.host_id, current_user_id, 'platform_checkout', currency_code, deposit_amount,
    booking_total, commission_pct, commission_amount,
    0, host_amount, currency_code,
    null, 'pending', 'not_ready',
    balance_amount, balance_due_dt, balance_stat
  )
  returning * into payment_record;

  return payment_record;
end;
$$;

revoke all on function public.create_pending_booking_payment(uuid, date, date, integer) from public;
grant execute on function public.create_pending_booking_payment(uuid, date, date, integer) to authenticated;
