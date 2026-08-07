-- 100_revert_deposit_gate.sql
--
-- Reverts the deposit-gated confirmation (097/098). Bookings now always confirm
-- as soon as the host accepts a request; the deposit/balance are collected
-- directly by the host afterwards on the schedule shown to the guest. The
-- no-double-booking overlap check (099) is kept.
--
-- Safe to run whether or not 097/098 were applied.

alter table public.listings drop constraint if exists listings_confirm_requirement_check;
alter table public.listings drop column if exists confirm_requirement;

drop function if exists public.confirm_booking_deposit_received(uuid);

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
  set status = new_status, updated_at = now()
  where id = request_uuid
    and (
      host_id = current_user_id
      or exists (select 1 from public.hosts where hosts.id = booking_requests.host_id and hosts.user_id = current_user_id)
      or exists (select 1 from public.profiles where profiles.id = current_user_id and profiles.is_admin = true)
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
      -- No-double-booking: refuse if the dates already overlap another hold.
      if exists (
        select 1 from public.listing_unavailable_ranges r
        where r.listing_id = updated_request.listing_id
          and r.start_date < updated_request.check_out
          and r.end_date > updated_request.check_in
      ) then
        raise exception 'Those dates are no longer available';
      end if;

      insert into public.bookings (
        user_id, listing_id, host_id, check_in, check_out, guests,
        total_amount_usd, total_amount_ils, commission_percent, status
      )
      values (
        updated_request.guest_id, updated_request.listing_id, updated_request.host_id,
        updated_request.check_in, updated_request.check_out, updated_request.guests,
        case when listing_price_usd is not null then round(listing_price_usd * booking_nights)::integer else null end,
        case when listing_price_ils is not null then round(listing_price_ils * booking_nights)::integer else null end,
        public.current_host_commission_percent(updated_request.host_id),
        'confirmed'
      )
      returning id into confirmed_booking_id;

      update public.booking_requests
      set booking_id = confirmed_booking_id, updated_at = now()
      where id = updated_request.id
      returning * into updated_request;
    end if;

    insert into public.listing_unavailable_ranges (listing_id, host_id, start_date, end_date, reason, source)
    select updated_request.listing_id, updated_request.host_id, updated_request.check_in, updated_request.check_out, 'Booking confirmed', 'booking'
    where not exists (
      select 1 from public.listing_unavailable_ranges
      where listing_id = updated_request.listing_id
        and start_date = updated_request.check_in
        and end_date = updated_request.check_out
        and source = 'booking'
    );
  end if;

  return updated_request;
end;
$$;

revoke all on function public.update_booking_request_status(uuid, text) from public;
grant execute on function public.update_booking_request_status(uuid, text) to authenticated;
