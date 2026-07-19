-- 071_booking_payment_creation.sql
--
-- Fixes a latent bug that breaks "Book now" the moment jlm_payments_enabled
-- is switched on.
--
-- public.booking_payments has RLS enabled (010) with SELECT-only policies for
-- hosts (010, 020) and guests (010). No INSERT policy has ever existed, but
-- app/api/book-now/route.ts inserts into it with the user-scoped SSR client.
-- That insert is denied by RLS, so checkout returns 400 after a Stripe session
-- has already been created.
--
-- The fix is deliberately NOT an INSERT policy for guests: that would let a
-- guest choose their own amount, platform_fee_amount, host_payout_amount and
-- even status = 'paid'. Instead these SECURITY DEFINER functions recompute
-- every monetary value server-side from the listing and platform settings.
-- The caller supplies only the listing and the dates.
--
-- Commission base change: commission is now calculated on the FULL booking
-- total, not on the 10% deposit. The platform rate is currently 0, so this is
-- a no-op today and becomes correct automatically when the rate is raised.

alter table public.booking_payments
  add column if not exists booking_total_amount numeric(10,2),
  add column if not exists commission_percent numeric;

comment on column public.booking_payments.booking_total_amount is
  'Full value of the stay (nightly rate x nights). The commission base. The amount column holds only the deposit actually collected.';
comment on column public.booking_payments.commission_percent is
  'Commission rate applied at the time this payment was created, for audit. Rates are not retroactive.';


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


create or replace function public.attach_checkout_session_to_payment(
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
    raise exception 'Please sign in before booking.';
  end if;

  if coalesce(trim(checkout_session_id), '') = '' then
    raise exception 'A checkout session id is required.';
  end if;

  update public.booking_payments
  set stripe_checkout_session_id = checkout_session_id,
      updated_at = now()
  where id = payment_uuid
    and guest_id = current_user_id
    and status = 'pending'
    and stripe_checkout_session_id is null
  returning * into payment_record;

  if payment_record.id is null then
    raise exception 'That payment could not be linked to a checkout session.';
  end if;

  return payment_record;
end;
$$;


revoke all on function public.create_pending_booking_payment(uuid, date, date, integer) from public;
revoke all on function public.attach_checkout_session_to_payment(uuid, text) from public;

grant execute on function public.create_pending_booking_payment(uuid, date, date, integer) to authenticated;
grant execute on function public.attach_checkout_session_to_payment(uuid, text) to authenticated;
