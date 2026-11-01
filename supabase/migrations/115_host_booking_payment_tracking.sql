-- 115_host_booking_payment_tracking.sql
--
-- Hosts can SELECT their bookings (072) but have no UPDATE policy on
-- public.bookings, so the host Payments page's "payment tracking" update
-- matched zero rows and nothing was saved. This ownership-checked setter lets a
-- host (or an admin) record off-platform payment progress on a booking. It only
-- touches payment_status, payment_notes and payment_updated_at.

create or replace function public.set_booking_payment_tracking(
  booking_uuid uuid,
  new_payment_status text,
  new_payment_notes text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  updated_booking public.bookings;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  -- Same values as the bookings.payment_status check constraint (038).
  if new_payment_status is null
     or new_payment_status not in ('unpaid', 'deposit_received', 'paid_in_full', 'refunded') then
    raise exception 'Invalid payment status';
  end if;

  update public.bookings b
  set payment_status = new_payment_status,
      payment_notes = nullif(btrim(coalesce(new_payment_notes, '')), ''),
      payment_updated_at = now()
  where b.id = booking_uuid
    and (
      b.host_id = caller
      or exists (
        select 1 from public.hosts h
        where h.id = b.host_id and h.user_id = caller
      )
      or exists (
        select 1 from public.profiles p
        where p.id = caller and p.is_admin = true
      )
    )
  returning b.* into updated_booking;

  if not found then
    raise exception 'Booking not found';
  end if;

  return updated_booking;
end;
$$;

revoke all on function public.set_booking_payment_tracking(uuid, text, text) from public;
grant execute on function public.set_booking_payment_tracking(uuid, text, text) to authenticated;
