-- 106_host_payout_method_and_details.sql
--
-- Promote the host payout account (bank/Zelle) to real host-level columns and
-- record the host's chosen payout method (automatic Stripe vs manual bank/Zelle),
-- so the same payout account serves BOTH manual JLM payouts and guest-direct
-- display, and the admin can see how to pay each host.
--
-- Additive + backward compatible. The deposit SCHEDULE stays in
-- direct_payment_instructions; only the nested `payout` object moves to a real
-- column. Readers fall back to the legacy JSON payout until backfill runs. The old
-- 5-arg update_host_payment_preferences is KEPT (a 7-arg overload is added beside
-- it) so nothing breaks between pasting this and deploying the new code.
-- Idempotent / re-runnable; paste into the Supabase SQL editor as the owner role.

-- 1. New columns.
alter table public.host_payment_profiles
  add column if not exists payout_method text,
  add column if not exists payout_details jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'host_payment_profiles_payout_method_check'
  ) then
    alter table public.host_payment_profiles
      add constraint host_payment_profiles_payout_method_check
      check (payout_method is null or payout_method in ('stripe','manual'));
  end if;
end $$;

-- 2. One-time backfill. direct_payment_instructions may be legacy free text (not
--    JSON), so parse defensively row-by-row.
do $$
declare
  r record;
  j jsonb;
begin
  for r in
    select host_id, direct_payment_instructions
    from public.host_payment_profiles
    where payout_details is null and direct_payment_instructions is not null
  loop
    begin
      j := r.direct_payment_instructions::jsonb;
    exception when others then
      j := null;
    end;
    if j is not null and jsonb_typeof(j -> 'payout') = 'object' then
      update public.host_payment_profiles
        set payout_details = j -> 'payout'
        where host_id = r.host_id;
    end if;
  end loop;
end $$;

-- Conservative payout_method backfill (advisory only; nothing in the money path
-- reads it — automatic-transfer readiness stays gated on stripe_payouts_enabled).
update public.host_payment_profiles
  set payout_method = 'stripe'
  where payout_method is null and stripe_payouts_enabled = true;
update public.host_payment_profiles
  set payout_method = 'manual'
  where payout_method is null and payout_details is not null;

-- 3. 7-arg overload of the preferences RPC. The 5-arg (059) is intentionally kept
--    so old code calling it during the paste-then-deploy window still works.
create or replace function public.update_host_payment_preferences(
  accepts_direct boolean,
  instructions text,
  currency_code text,
  accepts_jlm boolean,
  supported_currencies text[],
  payout_method_in text,
  payout_details_in jsonb
)
returns public.host_payment_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  cleaned_currencies text[];
  cleaned_method text;
  updated_profile public.host_payment_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select hosts.id
  into current_host_id
  from public.hosts
  where hosts.id = current_user_id
     or hosts.user_id = current_user_id
  order by case when hosts.id = current_user_id then 0 else 1 end
  limit 1;

  if current_host_id is null then
    raise exception 'Host profile not found';
  end if;

  -- A host accepting direct payment must give guests either a schedule OR a payout
  -- account to pay into. The payout that used to live in the instructions JSON now
  -- arrives separately in payout_details_in, so accept either.
  if accepts_direct
     and trim(coalesce(instructions, '')) = ''
     and payout_details_in is null then
    raise exception 'Direct payment instructions are required';
  end if;

  cleaned_method := nullif(lower(trim(coalesce(payout_method_in, ''))), '');
  if cleaned_method is not null and cleaned_method not in ('stripe','manual') then
    raise exception 'Invalid payout method';
  end if;

  select coalesce(array_agg(distinct normalized.currency), array[]::text[])
  into cleaned_currencies
  from (
    select upper(trim(raw.currency)) as currency
    from unnest(coalesce(supported_currencies, array[]::text[])) as raw(currency)
  ) normalized
  where normalized.currency in ('GBP', 'USD', 'EUR', 'ILS');

  insert into public.host_payment_profiles (
    host_id,
    accepts_direct_payment,
    direct_payment_instructions,
    preferred_currency,
    accepts_jlm_payment,
    same_currency_payout,
    payout_currencies,
    payout_method,
    payout_details
  )
  values (
    current_host_id,
    accepts_direct,
    nullif(trim(coalesce(instructions, '')), ''),
    nullif(upper(trim(coalesce(currency_code, ''))), ''),
    accepts_jlm,
    true,
    cleaned_currencies,
    cleaned_method,
    payout_details_in
  )
  on conflict (host_id) do update
  set accepts_direct_payment = excluded.accepts_direct_payment,
      direct_payment_instructions = excluded.direct_payment_instructions,
      preferred_currency = excluded.preferred_currency,
      accepts_jlm_payment = excluded.accepts_jlm_payment,
      same_currency_payout = true,
      payout_currencies = excluded.payout_currencies,
      payout_method = excluded.payout_method,
      payout_details = excluded.payout_details,
      updated_at = now()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

grant execute on function public.update_host_payment_preferences(
  boolean, text, text, boolean, text[], text, jsonb
) to authenticated;

-- 4. Guest booking-schedule RPC (101) now also returns the host-level payout.
--    Return-type change => drop + recreate (create-or-replace rejects it). Ship the
--    app change to /account/bookings together with this migration.
drop function if exists public.get_my_booking_payment_schedules();
create function public.get_my_booking_payment_schedules()
returns table (
  booking_id uuid,
  accepts_direct boolean,
  instructions text,
  payout_details jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    b.id,
    coalesce(hpp.accepts_direct_payment, false),
    hpp.direct_payment_instructions,
    hpp.payout_details
  from public.bookings b
  left join public.host_payment_profiles hpp on hpp.host_id = b.host_id
  where b.user_id = auth.uid();
$$;
revoke all on function public.get_my_booking_payment_schedules() from public;
grant execute on function public.get_my_booking_payment_schedules() to authenticated;

-- Nudge PostgREST to reload its schema cache so the new 7-arg overload + the
-- recreated guest RPC are callable immediately after the paste.
notify pgrst, 'reload schema';
