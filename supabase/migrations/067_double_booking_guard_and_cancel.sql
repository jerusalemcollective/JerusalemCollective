-- 067_double_booking_guard_and_cancel.sql
--
-- F1: prevent two CONFIRMED bookings from overlapping on the same listing
--     (a real race today: book-now checks availability before checkout, but the
--      booking is only written by the Stripe webhook with no overlap re-check).
-- F5: a guest-initiated cancel that also frees the calendar block.
--
-- If the exclusion constraint fails to create, you already have overlapping
-- confirmed bookings. Find them, cancel the duplicates, then re-run:
--   select b1.listing_id, b1.id, b1.check_in, b1.check_out
--   from public.bookings b1
--   where b1.status = 'confirmed' and exists (
--     select 1 from public.bookings b2
--     where b2.id <> b1.id and b2.listing_id = b1.listing_id and b2.status = 'confirmed'
--       and daterange(b2.check_in, b2.check_out, '[)') && daterange(b1.check_in, b1.check_out, '[)')
--   );

-- btree_gist lets the exclusion constraint use `=` on listing_id alongside the
-- range-overlap operator.
create extension if not exists btree_gist;

alter table public.bookings drop constraint if exists bookings_no_overlap_confirmed;
alter table public.bookings
  add constraint bookings_no_overlap_confirmed
  exclude using gist (
    listing_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status = 'confirmed');

-- F5: guest cancellation. SECURITY DEFINER so it can free the host-owned
-- calendar range; ownership is enforced against auth.uid().
create or replace function public.cancel_guest_booking(booking_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = booking_uuid;

  if b.id is null then
    raise exception 'Booking not found';
  end if;
  if b.user_id <> auth.uid() then
    raise exception 'You can only cancel your own bookings';
  end if;
  if b.status = 'cancelled' then
    return;
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = booking_uuid;

  -- Free the calendar block that finalize_instant_booking created for this stay.
  delete from public.listing_unavailable_ranges
  where listing_id = b.listing_id
    and start_date = b.check_in
    and end_date = b.check_out
    and source = 'booking';
end;
$$;

revoke all on function public.cancel_guest_booking(uuid) from public;
grant execute on function public.cancel_guest_booking(uuid) to authenticated;
