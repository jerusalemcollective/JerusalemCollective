-- 114_admin_read_bookings.sql
--
-- Admins had no SELECT policy on public.bookings: only guests (own rows) and
-- hosts (072, own listings) could read them. Every admin read of bookings
-- (/admin/bookings, /admin/users/[id], booking status on /admin/enquiries)
-- therefore silently returned zero rows.
--
-- booking_requests already has "Admins can view all booking requests" (060,
-- restored by 108) and booking_payments has "Admins can view all booking
-- payments" (073), so only bookings needs a policy here.
--
-- Read-only; touches no write policies. Idempotent / re-runnable; paste into the
-- Supabase SQL editor as the owner role.

drop policy if exists "Admins can view all bookings" on public.bookings;
create policy "Admins can view all bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
