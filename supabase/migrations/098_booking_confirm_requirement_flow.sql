-- 098_booking_confirm_requirement_flow.sql
--
-- Make accepting a booking request respect the listing's confirm_requirement
-- (added in 097):
--   'on_accept' (default) -> accept confirms the booking + blocks the calendar
--                            immediately (unchanged behaviour).
--   'deposit'             -> accept creates a PENDING booking and does NOT block
--                            the calendar; the host confirms later by marking the
--                            deposit received (confirm_booking_deposit_received).
--
-- This redefines update_booking_request_status (last defined in 061) with the
-- branch, and adds confirm_booking_deposit_received(). Everything else in the
-- 061 function body is preserved exactly.

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

    -- Only block the calendar once the booking is really confirmed. For
    -- 'deposit' listings the booking is still pending here, so the block is
    -- deferred to confirm_booking_deposit_received().
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

-- Host (or admin) confirms a deposit-gated booking once the deposit has been
-- received off-platform: flips it to confirmed, records the deposit, and blocks
-- the calendar. Safe to call on an already-confirmed booking (idempotent block).
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
