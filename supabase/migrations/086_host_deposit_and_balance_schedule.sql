-- 086_host_deposit_and_balance_schedule.sql
--
-- Host-configurable deposit + payment schedule (per listing).
--
-- Until now the deposit was hardcoded at 10% of the booking total and the rest
-- was assumed to be arranged off-platform. Hosts now choose, per listing:
--   * deposit_type = 'percent'  -> deposit_value is a percentage (e.g. 20 = 20%)
--     deposit_type = 'fixed'    -> deposit_value is a fixed amount in the
--                                  listing's booking currency
--   * balance_due_days_before_checkin -> when the remaining balance is due,
--     counted back from check-in (0 = due at check-in).
--
-- The guest pays the deposit at booking; the balance is paid later THROUGH THE
-- SITE (a separate Stripe payment, see later migrations/routes), tracked on
-- booking_payments. Defaults (percent / 10 / 0) reproduce today's behaviour for
-- existing listings, so this migration is behaviour-preserving until a host
-- changes their settings.

-- ---------------------------------------------------------------------------
-- 1. Per-listing deposit + schedule config
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists deposit_type text not null default 'percent',
  add column if not exists deposit_value numeric not null default 10,
  add column if not exists balance_due_days_before_checkin integer not null default 0;

comment on column public.listings.deposit_type is
  'percent | fixed. percent -> deposit_value is a %; fixed -> deposit_value is an amount in the booking currency.';
comment on column public.listings.deposit_value is
  'Deposit size. A percentage (0-100) when deposit_type=percent, else a fixed amount in the listing booking currency.';
comment on column public.listings.balance_due_days_before_checkin is
  'When the remaining balance is due, counted back from check-in. 0 = due at check-in.';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'listings_deposit_type_check') then
    alter table public.listings drop constraint listings_deposit_type_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'listings_deposit_value_check') then
    alter table public.listings drop constraint listings_deposit_value_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'listings_balance_due_days_check') then
    alter table public.listings drop constraint listings_balance_due_days_check;
  end if;
end $$;

alter table public.listings
  add constraint listings_deposit_type_check
    check (deposit_type in ('percent', 'fixed'));
alter table public.listings
  add constraint listings_deposit_value_check
    check (
      deposit_value > 0
      and (deposit_type <> 'percent' or deposit_value <= 100)
    );
alter table public.listings
  add constraint listings_balance_due_days_check
    check (balance_due_days_before_checkin >= 0 and balance_due_days_before_checkin <= 365);

-- ---------------------------------------------------------------------------
-- 2. Balance tracking on booking_payments
-- ---------------------------------------------------------------------------
alter table public.booking_payments
  add column if not exists balance_amount numeric(10,2) not null default 0,
  add column if not exists balance_due_date date,
  add column if not exists balance_status text not null default 'none',
  add column if not exists balance_checkout_session_id text,
  add column if not exists balance_paid_at timestamptz;

comment on column public.booking_payments.balance_amount is
  'Remaining amount owed after the deposit (booking_total_amount - amount). 0 when the deposit covers the whole booking.';
comment on column public.booking_payments.balance_status is
  'none (no balance) | due | paid | waived.';

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'booking_payments_balance_status_check') then
    alter table public.booking_payments drop constraint booking_payments_balance_status_check;
  end if;
end $$;

alter table public.booking_payments
  add constraint booking_payments_balance_status_check
    check (balance_status in ('none', 'due', 'paid', 'waived'));

-- ---------------------------------------------------------------------------
-- 3. create_pending_booking_payment: use the host's deposit config + balance
--    (verbatim re-creation of 085 with the deposit math swapped and the
--     balance fields populated; kill-switch guard from 085 retained).
-- ---------------------------------------------------------------------------
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

  -- Host-set deposit (per listing): a percentage of the total OR a fixed amount
  -- in the booking currency. Clamped to Stripe's ~0.50 floor and the total.
  if coalesce(listing_record.deposit_type, 'percent') = 'fixed' then
    deposit_amount := round(coalesce(listing_record.deposit_value, 0), 2);
  else
    deposit_amount := round(booking_total * (coalesce(listing_record.deposit_value, 10) / 100.0), 2);
  end if;

  deposit_amount := greatest(deposit_amount, 0.50);
  if deposit_amount > booking_total then
    deposit_amount := booking_total;
  end if;

  balance_amount := round(booking_total - deposit_amount, 2);
  if balance_amount < 0 then
    balance_amount := 0;
  end if;

  balance_due_dt := check_in_date - coalesce(listing_record.balance_due_days_before_checkin, 0);
  balance_stat := case when balance_amount > 0 then 'due' else 'none' end;

  commission_pct := greatest(
    coalesce(
      profile_record.commission_percent_override,
      public.current_platform_commission_percent(),
      0
    ),
    0
  );

  -- Commission is charged on the whole booking but taken from the deposit
  -- collected now. If the host's deposit is smaller than the commission there
  -- is nothing to take it from, so fail loudly rather than under-collect.
  commission_amount := round(booking_total * commission_pct / 100, 2);

  if commission_amount > deposit_amount then
    raise exception
      'The deposit for this stay (%) is smaller than the commission due (%). Raise the deposit or lower the commission rate.',
      deposit_amount, commission_amount;
  end if;

  -- Host receives the deposit minus commission now; the full balance later.
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
    payout_status,
    balance_amount,
    balance_due_date,
    balance_status
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
    'not_ready',
    balance_amount,
    balance_due_dt,
    balance_stat
  )
  returning * into payment_record;

  return payment_record;
end;
$$;

revoke all on function public.create_pending_booking_payment(uuid, date, date, integer) from public;
grant execute on function public.create_pending_booking_payment(uuid, date, date, integer) to authenticated;
