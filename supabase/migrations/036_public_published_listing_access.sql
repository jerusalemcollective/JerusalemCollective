alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.reviews enable row level security;

update public.hosts
set is_verified = true
where exists (
  select 1
  from public.host_applications
  where host_applications.host_id = hosts.id
    and host_applications.status = 'approved'
);

drop policy if exists "Public can view published listings" on public.listings;
create policy "Public can view published listings"
on public.listings
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Public can view photos for published listings" on public.listing_photos;
create policy "Public can view photos for published listings"
on public.listing_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_photos.listing_id
      and listings.is_published = true
  )
);

drop policy if exists "Public can view approved reviews" on public.reviews;
create policy "Public can view approved reviews"
on public.reviews
for select
to anon, authenticated
using (is_approved = true);
