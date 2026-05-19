alter table public.reviews
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null;

create unique index if not exists reviews_booking_reviewer_unique_idx
  on public.reviews (booking_id, reviewer_id)
  where booking_id is not null and reviewer_id is not null;

alter table public.reviews enable row level security;

drop policy if exists "Guests can insert own completed booking reviews" on public.reviews;
drop policy if exists "Guests can view own reviews" on public.reviews;

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
  )
);

create policy "Guests can view own reviews"
on public.reviews
for select
to authenticated
using (auth.uid() = reviewer_id);
