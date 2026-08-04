-- 078_review_excludes_cancelled_bookings.sql
--
-- Audit correctness (review eligibility). 024's review INSERT policy allowed a
-- review for any past-checkout booking of the guest's, including a CANCELLED
-- one (a stay that never happened). Add a status guard as defense-in-depth
-- alongside the app-query filter. Idempotent: drop + recreate.

drop policy if exists "Guests can insert own completed booking reviews" on public.reviews;
create policy "Guests can insert own completed booking reviews"
on public.reviews
for insert
to authenticated
with check (
  auth.uid() = reviewer_id
  and exists (
    select 1
    from public.bookings
    where bookings.id = reviews.booking_id
      and bookings.user_id = auth.uid()
      and bookings.listing_id = reviews.listing_id
      and bookings.check_out < current_date
      and bookings.status <> 'cancelled'
  )
);
