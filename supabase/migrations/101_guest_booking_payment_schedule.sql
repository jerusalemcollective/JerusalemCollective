-- 101_guest_booking_payment_schedule.sql
--
-- Lets a guest read the direct-payment schedule for their OWN bookings only.
-- host_payment_profiles is otherwise not readable by guests (it holds Stripe ids
-- etc.), so this definer returns just the two fields the guest needs, and only
-- for bookings they own.

create or replace function public.get_my_booking_payment_schedules()
returns table (
  booking_id uuid,
  accepts_direct boolean,
  instructions text
)
language sql
security definer
set search_path = public
as $$
  select
    b.id,
    coalesce(hpp.accepts_direct_payment, false),
    hpp.direct_payment_instructions
  from public.bookings b
  left join public.host_payment_profiles hpp on hpp.host_id = b.host_id
  where b.user_id = auth.uid();
$$;

revoke all on function public.get_my_booking_payment_schedules() from public;
grant execute on function public.get_my_booking_payment_schedules() to authenticated;
