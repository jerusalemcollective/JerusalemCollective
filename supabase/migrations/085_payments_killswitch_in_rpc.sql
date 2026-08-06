-- 085_payments_killswitch_in_rpc.sql
--
-- Audit L-pay4 (defense in depth, dormant while payments are off).
-- The global payments kill-switch (platform_settings.jlm_payments_enabled) is
-- enforced only in the app route (app/api/book-now/route.ts). But
-- create_pending_booking_payment is SECURITY DEFINER and granted to
-- `authenticated`, so a direct RPC call could still create a pending
-- booking_payment while payments are globally disabled. Add the same guard
-- inside the RPC.
--
-- This is a verbatim re-creation of the 071 function with ONE added guard
-- (right after the sign-in check). Nothing else changes; grants are preserved
-- by CREATE OR REPLACE and re-asserted at the end for safety.
--
-- Kill-switch semantics mirror the app: enabled ONLY when a platform_settings
-- row exists with key='jlm_payments_enabled' and value <> 'false' (absent key =
-- disabled, matching lib/platform-settings.ts getPaymentRouteSettings default).

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
  commission_pct numeric;
  commission_amount numeric;
  host_amount numeric;
  payment_record public.booking_payments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in before booking.';
  end if;

  -- Defense in depth: refuse to create a pending payment when online booking is
  -- globally disabled, even for a direct RPC call that bypasses the app route.
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

  -- Stripe rejects charges below roughly 0.50 in most currencies.
  deposit_amount := greatest(round(booking_total * 0.10, 2), 0.50);

  commission_pct := greatest(
    coalesce(
      profile_record.commission_percent_override,
      public.current_platform_commission_percent(),
      0
    ),
    0
  );

  -- Commission is charged on the whole booking, but only the deposit is
  -- collected here. Once the rate exceeds the deposit percentage there is no
  -- money to take it from, so fail loudly instead of silently under-collecting.
  commission_amount := round(booking_total * commission_pct / 100, 2);

  if commission_amount > deposit_amount then
    raise exception
      'Commission of % percent on this booking (%) exceeds the deposit collected (%). Raise the deposit percentage or lower the commission rate.',
      commission_pct, commission_amount, deposit_amount;
  end if;

  host_amount := greatest(deposit_amount - commission_amount, 0);

  insert into public.booking_payments (
    host_id,
    guest_id,
    payment_mode,
    currency,
    amount,
    booking_total_amount,
    commission_percent,
    platform_fee_amount,
    processor_fee_amount,
    host_payout_amount,
    host_payout_currency,
    fx_rate_used,
    status,
    payout_status
  )
  values (
    listing_record.host_id,
    current_user_id,
    'platform_checkout',
    currency_code,
    deposit_amount,
    booking_total,
    commission_pct,
    commission_amount,
    0,
    host_amount,
    currency_code,
    null,
    'pending',
    'not_ready'
  )
  returning * into payment_record;

  return payment_record;
end;
$$;

revoke all on function public.create_pending_booking_payment(uuid, date, date, integer) from public;
grant execute on function public.create_pending_booking_payment(uuid, date, date, integer) to authenticated;
