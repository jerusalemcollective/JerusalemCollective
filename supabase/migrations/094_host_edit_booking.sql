-- 094_host_edit_booking.sql
--
-- Let a host/admin edit the details (dates, guests, status) of a confirmed
-- booking or a booking request for their own listing. RLS only lets the GUEST
-- update their own booking (001), so these are SECURITY DEFINER with an explicit
-- host-ownership check (direct host_id or the split-identity hosts.user_id
-- bridge). Editing a booking re-syncs its calendar block and is overlap-guarded
-- by the existing bookings_no_overlap_confirmed exclusion constraint.
--
-- NOTE: changing a paid booking's dates does NOT re-price the deposit/balance
-- (those were computed at booking time); the operator adjusts money via the
-- existing manual payment tracking. Cancelling waives any unpaid balance.

create or replace function public.host_update_booking(
  p_booking_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_status text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  updated public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null then
    raise exception 'Booking not found.';
  end if;

  if not (
    b.host_id = auth.uid()
    or exists (select 1 from public.hosts h where h.id = b.host_id and h.user_id = auth.uid())
  ) then
    raise exception 'You can only edit bookings for your own listings.';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in.';
  end if;
  if p_status not in ('pending', 'confirmed', 'cancelled', 'completed') then
    raise exception 'Invalid booking status.';
  end if;

  -- Overlap safety comes from the bookings_no_overlap_confirmed exclusion
  -- constraint, which rejects an update onto another confirmed booking's dates.
  update public.bookings
  set check_in = p_check_in,
      check_out = p_check_out,
      guests = greatest(coalesce(p_guests, 1), 1),
      status = p_status
  where id = p_booking_id
  returning * into updated;

  -- Re-sync the calendar block to the new dates (remove the old one first).
  delete from public.listing_unavailable_ranges
  where listing_id = b.listing_id
    and source = 'booking'
    and start_date = b.check_in
    and end_date = b.check_out;

  if p_status in ('confirmed', 'completed') then
    insert into public.listing_unavailable_ranges (listing_id, host_id, start_date, end_date, reason, source)
    select b.listing_id, b.host_id, p_check_in, p_check_out, 'Booking confirmed', 'booking'
    where not exists (
      select 1 from public.listing_unavailable_ranges
      where listing_id = b.listing_id and start_date = p_check_in and end_date = p_check_out and source = 'booking'
    );
  end if;

  -- Cancelling frees any unpaid balance (mirror cancel_guest_booking).
  if p_status = 'cancelled' then
    update public.booking_payments
    set balance_status = 'waived', updated_at = now()
    where booking_id = p_booking_id and balance_status = 'due';
  end if;

  return updated;
end;
$$;

create or replace function public.host_update_booking_request(
  p_request_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_status text
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.booking_requests%rowtype;
  updated public.booking_requests%rowtype;
begin
  select * into r from public.booking_requests where id = p_request_id;
  if r.id is null then
    raise exception 'Request not found.';
  end if;

  if not (
    r.host_id = auth.uid()
    or exists (select 1 from public.hosts h where h.id = r.host_id and h.user_id = auth.uid())
  ) then
    raise exception 'You can only edit requests for your own listings.';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'Check-out must be after check-in.';
  end if;
  if p_status not in ('new', 'host_replied', 'accepted', 'declined', 'closed') then
    raise exception 'Invalid request status.';
  end if;

  update public.booking_requests
  set check_in = p_check_in,
      check_out = p_check_out,
      guests = greatest(coalesce(p_guests, 1), 1),
      status = p_status
  where id = p_request_id
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.host_update_booking(uuid, date, date, integer, text) from public;
grant execute on function public.host_update_booking(uuid, date, date, integer, text) to authenticated;
revoke all on function public.host_update_booking_request(uuid, date, date, integer, text) from public;
grant execute on function public.host_update_booking_request(uuid, date, date, integer, text) to authenticated;
