alter table public.profiles
  add column if not exists admin_role text,
  add column if not exists admin_notes text;

alter table public.profiles
  drop constraint if exists profiles_admin_role_check;

alter table public.profiles
  add constraint profiles_admin_role_check
  check (
    admin_role is null
    or admin_role in ('owner', 'operations', 'support', 'content', 'analyst')
  );

update public.profiles
set admin_role = 'owner'
where is_admin = true
  and admin_role is null;

create or replace function public.current_user_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profiles.admin_role
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.is_admin = true
  limit 1;
$$;

revoke all on function public.current_user_admin_role() from public;
grant execute on function public.current_user_admin_role() to authenticated;
grant execute on function public.current_user_admin_role() to service_role;

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value, description)
values
  (
    'commission_percent',
    '0',
    'Platform commission percentage applied to new bookings. Manually managed by owner admins. Existing bookings are unaffected.'
  ),
  (
    'services_bar_enabled',
    'true',
    'Controls whether the Services navigation and service pages are visible before launch.'
  ),
  (
    'jlm_payments_enabled',
    'false',
    'Controls whether hosts can enable JLM-collected online payments and whether guests can use Book now.'
  ),
  (
    'direct_payments_enabled',
    'true',
    'Controls whether hosts can offer direct-to-host payment instructions.'
  )
on conflict (key) do nothing;

drop policy if exists "Owners can read platform settings" on public.platform_settings;
create policy "Owners can read platform settings"
on public.platform_settings
for select
to authenticated
using (public.current_user_admin_role() = 'owner');

drop policy if exists "Owners can update platform settings" on public.platform_settings;
create policy "Owners can update platform settings"
on public.platform_settings
for update
to authenticated
using (public.current_user_admin_role() = 'owner')
with check (public.current_user_admin_role() = 'owner');

drop policy if exists "Service role manages platform settings" on public.platform_settings;
create policy "Service role manages platform settings"
on public.platform_settings
for all
to service_role
using (true)
with check (true);

drop policy if exists "Public can read services visibility setting" on public.platform_settings;
create policy "Public can read services visibility setting"
on public.platform_settings
for select
to anon, authenticated
using (key = 'services_bar_enabled');

drop policy if exists "Public can read payment route settings" on public.platform_settings;
create policy "Public can read payment route settings"
on public.platform_settings
for select
to anon, authenticated
using (key in ('jlm_payments_enabled', 'direct_payments_enabled'));

alter table public.bookings
  add column if not exists total_amount_usd integer,
  add column if not exists total_amount_ils integer,
  add column if not exists deposit_amount_usd integer,
  add column if not exists deposit_amount_ils integer,
  add column if not exists commission_percent numeric not null default 0;

alter table public.host_payment_profiles
  add column if not exists accepts_jlm_payment boolean not null default false,
  add column if not exists same_currency_payout boolean not null default true,
  add column if not exists payout_currencies text[] not null default array[]::text[];

alter table public.listings
  add column if not exists online_payment_enabled boolean not null default false;

alter table public.booking_payments
  add column if not exists stripe_checkout_session_id text,
  add column if not exists host_payout_currency text,
  add column if not exists fx_rate_used numeric;

create index if not exists booking_payments_checkout_session_idx
  on public.booking_payments (stripe_checkout_session_id);

create or replace function public.current_platform_commission_percent()
returns numeric
language sql
security definer
set search_path = public
as $$
  select greatest(
    coalesce(
      (
        select nullif(value, '')::numeric
        from public.platform_settings
        where key = 'commission_percent'
      ),
      0
    ),
    0
  );
$$;

revoke all on function public.current_platform_commission_percent() from public;
grant execute on function public.current_platform_commission_percent() to authenticated;
grant execute on function public.current_platform_commission_percent() to service_role;

create or replace function public.update_host_payment_preferences(
  accepts_direct boolean,
  instructions text,
  currency_code text,
  accepts_jlm boolean,
  supported_currencies text[]
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

  if accepts_direct and trim(coalesce(instructions, '')) = '' then
    raise exception 'Direct payment instructions are required';
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
    payout_currencies
  )
  values (
    current_host_id,
    accepts_direct,
    nullif(trim(coalesce(instructions, '')), ''),
    nullif(upper(trim(coalesce(currency_code, ''))), ''),
    accepts_jlm,
    true,
    cleaned_currencies
  )
  on conflict (host_id) do update
  set accepts_direct_payment = excluded.accepts_direct_payment,
      direct_payment_instructions = excluded.direct_payment_instructions,
      preferred_currency = excluded.preferred_currency,
      accepts_jlm_payment = excluded.accepts_jlm_payment,
      same_currency_payout = true,
      payout_currencies = excluded.payout_currencies,
      updated_at = now()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

grant execute on function public.update_host_payment_preferences(
  boolean,
  text,
  text,
  boolean,
  text[]
) to authenticated;

create or replace function public.finalize_paid_booking_request(
  request_uuid uuid,
  checkout_session_id text
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.booking_requests%rowtype;
  confirmed_booking_id uuid;
  listing_price_usd numeric;
  listing_price_ils numeric;
  booking_nights integer;
begin
  select *
  into request_record
  from public.booking_requests
  where id = request_uuid
  for update;

  if request_record.id is null then
    raise exception 'Request not found';
  end if;

  if request_record.check_in is null or request_record.check_out is null then
    raise exception 'Booking dates are required.';
  end if;

  select price_usd, price_ils
  into listing_price_usd, listing_price_ils
  from public.listings
  where id = request_record.listing_id;

  booking_nights := greatest((request_record.check_out - request_record.check_in), 1);
  confirmed_booking_id := request_record.booking_id;

  if confirmed_booking_id is null then
    insert into public.bookings (
      user_id,
      listing_id,
      host_id,
      check_in,
      check_out,
      guests,
      total_amount_usd,
      total_amount_ils,
      deposit_amount_usd,
      deposit_amount_ils,
      commission_percent,
      status,
      payment_status,
      payment_updated_at
    )
    values (
      request_record.guest_id,
      request_record.listing_id,
      request_record.host_id,
      request_record.check_in,
      request_record.check_out,
      request_record.guests,
      case when listing_price_usd is not null then round(listing_price_usd * booking_nights)::integer else null end,
      case when listing_price_ils is not null then round(listing_price_ils * booking_nights)::integer else null end,
      case when listing_price_usd is not null then greatest(round(listing_price_usd * booking_nights * 0.1)::integer, 1) else null end,
      case when listing_price_ils is not null then greatest(round(listing_price_ils * booking_nights * 0.1)::integer, 1) else null end,
      public.current_platform_commission_percent(),
      'confirmed',
      'deposit_received',
      now()
    )
    returning id into confirmed_booking_id;
  else
    update public.bookings
    set payment_status = 'deposit_received',
        payment_updated_at = now(),
        updated_at = now()
    where id = confirmed_booking_id;
  end if;

  update public.booking_requests
  set status = 'accepted',
      booking_id = confirmed_booking_id,
      updated_at = now()
  where id = request_record.id
  returning * into request_record;

  insert into public.listing_unavailable_ranges (
    listing_id,
    host_id,
    start_date,
    end_date,
    reason,
    source
  )
  select
    request_record.listing_id,
    request_record.host_id,
    request_record.check_in,
    request_record.check_out,
    'Booking confirmed',
    'booking'
  where not exists (
    select 1
    from public.listing_unavailable_ranges
    where listing_id = request_record.listing_id
      and start_date = request_record.check_in
      and end_date = request_record.check_out
      and source = 'booking'
  );

  update public.booking_payments
  set booking_id = confirmed_booking_id,
      status = 'paid',
      paid_at = now(),
      payout_status = 'ready',
      updated_at = now()
  where stripe_checkout_session_id = checkout_session_id;

  return request_record;
end;
$$;

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

  select price_usd, price_ils
  into listing_price_usd, listing_price_ils
  from public.listings
  where id = listing_uuid;

  booking_nights := greatest((check_out_date - check_in_date), 1);

  insert into public.bookings (
    user_id,
    listing_id,
    host_id,
    check_in,
    check_out,
    guests,
    total_amount_usd,
    total_amount_ils,
    deposit_amount_usd,
    deposit_amount_ils,
    commission_percent,
    status,
    payment_status,
    payment_updated_at
  )
  values (
    guest_uuid,
    listing_uuid,
    host_uuid,
    check_in_date,
    check_out_date,
    greatest(coalesce(guest_count, 1), 1),
    case when listing_price_usd is not null then round(listing_price_usd * booking_nights)::integer else null end,
    case when listing_price_ils is not null then round(listing_price_ils * booking_nights)::integer else null end,
    case when listing_price_usd is not null then greatest(round(listing_price_usd * booking_nights * 0.1)::integer, 1) else null end,
    case when listing_price_ils is not null then greatest(round(listing_price_ils * booking_nights * 0.1)::integer, 1) else null end,
    public.current_platform_commission_percent(),
    'confirmed',
    'deposit_received',
    now()
  )
  returning * into booking_record;

  insert into public.listing_unavailable_ranges (
    listing_id,
    host_id,
    start_date,
    end_date,
    reason,
    source
  )
  values (
    listing_uuid,
    host_uuid,
    check_in_date,
    check_out_date,
    'Booking confirmed',
    'booking'
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

revoke all on function public.finalize_paid_booking_request(uuid, text) from public;
revoke all on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) from public;

grant execute on function public.finalize_paid_booking_request(uuid, text) to service_role;
grant execute on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) to service_role;
