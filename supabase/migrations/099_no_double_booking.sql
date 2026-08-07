-- 099_no_double_booking.sql
--
-- Absolute no-double-booking guarantee. Every hold on a listing (a confirmed
-- booking, a manual booking, a manual block, or an imported calendar range)
-- lives in listing_unavailable_ranges. A GiST exclusion constraint here makes it
-- physically impossible for two holds on the same listing to overlap — no code
-- path can override it, not even an admin. Cancelling a booking removes its range
-- and frees the dates.
--
-- Ranges are half-open [start_date, end_date): a checkout on the same day as the
-- next check-in does NOT count as an overlap.
--
-- IMPORTANT: run AFTER clearing any overlapping test data, or the ALTER will
-- fail. To find overlaps first:
--   select a.listing_id, a.start_date, a.end_date, b.start_date, b.end_date
--   from listing_unavailable_ranges a
--   join listing_unavailable_ranges b
--     on a.listing_id = b.listing_id and a.id < b.id
--    and daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)');

create extension if not exists btree_gist;

alter table public.listing_unavailable_ranges
  drop constraint if exists listing_unavailable_no_overlap;

alter table public.listing_unavailable_ranges
  add constraint listing_unavailable_no_overlap
  exclude using gist (
    listing_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

-- Friendly guards so the common paths raise a clear message instead of a raw
-- constraint error. These redefine the 098 functions with an overlap pre-check.

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
  listing_confirm_requirement text;
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

    select price_usd, price_ils, confirm_requirement
    into listing_price_usd, listing_price_ils, listing_confirm_requirement
    from public.listings
    where id = updated_request.listing_id;

    booking_nights := greatest((updated_request.check_out - updated_request.check_in), 1);

    if confirmed_booking_id is null then
      -- No-double-booking: refuse if the dates already overlap another hold.
      if exists (
        select 1
        from public.listing_unavailable_ranges r
        where r.listing_id = updated_request.listing_id
          and r.start_date < updated_request.check_out
          and r.end_date > updated_request.check_in
      ) then
        raise exception 'Those dates are no longer available';
      end if;

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
        case when listing_confirm_requirement = 'deposit' then 'pending' else 'confirmed' end
      )
      returning id into confirmed_booking_id;

      update public.booking_requests
      set booking_id = confirmed_booking_id,
          updated_at = now()
      where id = updated_request.id
      returning * into updated_request;
    end if;

    if listing_confirm_requirement is distinct from 'deposit' then
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
  end if;

  return updated_request;
end;
$$;

create or replace function public.confirm_booking_deposit_received(
  booking_uuid uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  booking_record public.bookings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into booking_record
  from public.bookings
  where id = booking_uuid
  for update;

  if booking_record.id is null then
    raise exception 'Booking not found';
  end if;

  if not (
    booking_record.host_id = current_user_id
    or exists (
      select 1
      from public.hosts
      where hosts.id = booking_record.host_id
        and hosts.user_id = current_user_id
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = current_user_id
        and profiles.is_admin = true
    )
  ) then
    raise exception 'Not allowed';
  end if;

  -- No-double-booking: refuse to confirm if the dates were taken meanwhile
  -- (ignore this booking's own block so re-confirming stays idempotent).
  if exists (
    select 1
    from public.listing_unavailable_ranges r
    where r.listing_id = booking_record.listing_id
      and r.start_date < booking_record.check_out
      and r.end_date > booking_record.check_in
      and not (
        r.source = 'booking'
        and r.start_date = booking_record.check_in
        and r.end_date = booking_record.check_out
      )
  ) then
    raise exception 'Those dates are no longer available';
  end if;

  update public.bookings
  set status = 'confirmed',
      payment_status = 'deposit_received',
      payment_updated_at = now(),
      updated_at = now()
  where id = booking_uuid
  returning * into booking_record;

  insert into public.listing_unavailable_ranges (
    listing_id,
    host_id,
    start_date,
    end_date,
    reason,
    source
  )
  select
    booking_record.listing_id,
    booking_record.host_id,
    booking_record.check_in,
    booking_record.check_out,
    'Booking confirmed',
    'booking'
  where not exists (
    select 1
    from public.listing_unavailable_ranges
    where listing_id = booking_record.listing_id
      and start_date = booking_record.check_in
      and end_date = booking_record.check_out
      and source = 'booking'
  );

  return booking_record;
end;
$$;

revoke all on function public.update_booking_request_status(uuid, text) from public;
revoke all on function public.confirm_booking_deposit_received(uuid) from public;
grant execute on function public.update_booking_request_status(uuid, text) to authenticated;
grant execute on function public.confirm_booking_deposit_received(uuid) to authenticated;
