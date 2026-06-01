alter table public.bookings
add column if not exists total_amount_usd integer,
add column if not exists total_amount_ils integer,
add column if not exists deposit_amount_usd integer,
add column if not exists deposit_amount_ils integer,
add column if not exists commission_percent numeric not null default 0,
add column if not exists commission_amount_usd integer
  generated always as (
    case
      when total_amount_usd is not null
      then round(total_amount_usd * commission_percent / 100)::integer
      else null
    end
  ) stored,
add column if not exists commission_amount_ils integer
  generated always as (
    case
      when total_amount_ils is not null
      then round(total_amount_ils * commission_percent / 100)::integer
      else null
    end
  ) stored,
add column if not exists host_payout_usd integer
  generated always as (
    case
      when total_amount_usd is not null
      then total_amount_usd - round(total_amount_usd * commission_percent / 100)::integer
      else null
    end
  ) stored,
add column if not exists host_payout_ils integer
  generated always as (
    case
      when total_amount_ils is not null
      then total_amount_ils - round(total_amount_ils * commission_percent / 100)::integer
      else null
    end
  ) stored;

comment on column public.bookings.commission_percent
  is 'JLM Collective commission percentage locked at booking creation. Defaults to 0 while the platform is free for hosts. Manually managed by owner admins.';

create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value, description)
values (
  'commission_percent',
  '0',
  'Platform commission percentage applied to new bookings. Manually managed by owner admins. Existing bookings are unaffected.'
)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

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

create or replace function public.update_booking_request_status(
  request_uuid uuid,
  new_status text
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_request public.booking_requests%rowtype;
  confirmed_booking_id uuid;
  listing_price_usd numeric;
  listing_price_ils numeric;
  booking_nights integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if new_status not in ('host_replied', 'accepted', 'declined', 'closed') then
    raise exception 'Invalid request status';
  end if;

  update public.booking_requests
  set status = new_status,
      updated_at = now()
  where id = request_uuid
    and (
      host_id = current_user_id
      or exists (
        select 1
        from public.hosts
        where hosts.id = booking_requests.host_id
          and hosts.user_id = current_user_id
      )
      or exists (
        select 1
        from public.profiles
        where profiles.id = current_user_id
          and profiles.is_admin = true
      )
    )
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Request not found';
  end if;

  if new_status = 'accepted' then
    if updated_request.check_in is null or updated_request.check_out is null then
      raise exception 'Booking dates are required before accepting.';
    end if;

    confirmed_booking_id := updated_request.booking_id;

    select price_usd, price_ils
    into listing_price_usd, listing_price_ils
    from public.listings
    where id = updated_request.listing_id;

    booking_nights := greatest((updated_request.check_out - updated_request.check_in), 1);

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
        commission_percent,
        status
      )
      values (
        updated_request.guest_id,
        updated_request.listing_id,
        updated_request.host_id,
        updated_request.check_in,
        updated_request.check_out,
        updated_request.guests,
        case when listing_price_usd is not null then round(listing_price_usd * booking_nights)::integer else null end,
        case when listing_price_ils is not null then round(listing_price_ils * booking_nights)::integer else null end,
        public.current_platform_commission_percent(),
        'confirmed'
      )
      returning id into confirmed_booking_id;

      update public.booking_requests
      set booking_id = confirmed_booking_id,
          updated_at = now()
      where id = updated_request.id
      returning * into updated_request;
    end if;

    insert into public.listing_unavailable_ranges (
      listing_id,
      host_id,
      start_date,
      end_date,
      reason,
      source
    )
    select
      updated_request.listing_id,
      updated_request.host_id,
      updated_request.check_in,
      updated_request.check_out,
      'Booking confirmed',
      'booking'
    where not exists (
      select 1
      from public.listing_unavailable_ranges
      where listing_id = updated_request.listing_id
        and start_date = updated_request.check_in
        and end_date = updated_request.check_out
        and source = 'booking'
    );
  end if;

  return updated_request;
end;
$$;

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

revoke all on function public.update_booking_request_status(uuid, text) from public;
revoke all on function public.finalize_paid_booking_request(uuid, text) from public;
revoke all on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) from public;

grant execute on function public.update_booking_request_status(uuid, text) to authenticated;
grant execute on function public.finalize_paid_booking_request(uuid, text) to service_role;
grant execute on function public.finalize_instant_booking(uuid, uuid, uuid, date, date, integer, text) to service_role;
