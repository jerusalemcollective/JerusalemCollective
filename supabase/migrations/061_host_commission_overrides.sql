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

create or replace function public.current_user_has_admin_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_admin_role()
    when 'owner' then true
    when 'operations' then required_permission in (
      'overview',
      'applications',
      'listings',
      'hosts',
      'guests',
      'reviews',
      'analytics'
    )
    when 'support' then required_permission in (
      'overview',
      'hosts',
      'guests',
      'cases',
      'messages'
    )
    when 'content' then required_permission in (
      'overview',
      'applications',
      'listings',
      'reviews',
      'analytics'
    )
    when 'analyst' then required_permission in (
      'overview',
      'analytics',
      'hosts',
      'guests'
    )
    else false
  end;
$$;

revoke all on function public.current_user_admin_role() from public;
revoke all on function public.current_user_has_admin_permission(text) from public;
grant execute on function public.current_user_admin_role() to authenticated;
grant execute on function public.current_user_admin_role() to service_role;
grant execute on function public.current_user_has_admin_permission(text) to authenticated;
grant execute on function public.current_user_has_admin_permission(text) to service_role;

alter table public.host_payment_profiles
  add column if not exists commission_percent_override numeric;

alter table public.host_payment_profiles
  drop constraint if exists host_payment_profiles_commission_override_check;

alter table public.host_payment_profiles
  add constraint host_payment_profiles_commission_override_check
  check (
    commission_percent_override is null
    or commission_percent_override >= 0
  );

drop policy if exists "Public can read payment route settings" on public.platform_settings;
create policy "Public can read payment route settings"
on public.platform_settings
for select
to anon, authenticated
using (key in ('jlm_payments_enabled', 'direct_payments_enabled', 'commission_percent'));

drop policy if exists "Admins can view host payment profiles" on public.host_payment_profiles;
create policy "Admins can view host payment profiles"
on public.host_payment_profiles
for select
to authenticated
using (public.current_user_has_admin_permission('hosts'));

create or replace function public.current_host_commission_percent(host_uuid uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select greatest(
    coalesce(
      (
        select host_payment_profiles.commission_percent_override
        from public.host_payment_profiles
        where host_payment_profiles.host_id = host_uuid
      ),
      public.current_platform_commission_percent(),
      0
    ),
    0
  );
$$;

revoke all on function public.current_host_commission_percent(uuid) from public;
grant execute on function public.current_host_commission_percent(uuid) to authenticated;
grant execute on function public.current_host_commission_percent(uuid) to service_role;

create or replace function public.admin_update_host_commission_override(
  target_host_id uuid,
  override_percent numeric
)
returns public.host_payment_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.host_payment_profiles%rowtype;
begin
  if not public.current_user_has_admin_permission('hosts') then
    raise exception 'Not allowed';
  end if;

  if target_host_id is null then
    raise exception 'Missing host id';
  end if;

  if override_percent is not null and override_percent < 0 then
    raise exception 'Commission override must be 0 or higher';
  end if;

  if not exists (
    select 1
    from public.hosts
    where hosts.id = target_host_id
  ) then
    raise exception 'Host not found';
  end if;

  insert into public.host_payment_profiles (
    host_id,
    commission_percent_override
  )
  values (
    target_host_id,
    override_percent
  )
  on conflict (host_id) do update
  set commission_percent_override = excluded.commission_percent_override,
      updated_at = now()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_host_commission_override(uuid, numeric) from public;
grant execute on function public.admin_update_host_commission_override(uuid, numeric) to authenticated;

create or replace function public.prevent_host_commission_override_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.commission_percent_override is distinct from old.commission_percent_override
    and not public.current_user_has_admin_permission('hosts') then
    raise exception 'Only platform admins can change host commission overrides';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_host_commission_override on public.host_payment_profiles;
create trigger protect_host_commission_override
before update on public.host_payment_profiles
for each row
execute function public.prevent_host_commission_override_change();

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
        public.current_host_commission_percent(updated_request.host_id),
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
      public.current_host_commission_percent(request_record.host_id),
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
    public.current_host_commission_percent(host_uuid),
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
