alter table public.listing_photos
add column if not exists label text;

drop policy if exists "Hosts can update own application photos" on public.listing_photos;

create policy "Hosts can update own application photos"
on public.listing_photos
for update
using (
  exists (
    select 1
    from public.host_applications
    left join public.hosts on hosts.id = host_applications.host_id
    where host_applications.id = listing_photos.application_id
      and (
        host_applications.host_id = auth.uid()
        or hosts.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.host_applications
    left join public.hosts on hosts.id = host_applications.host_id
    where host_applications.id = listing_photos.application_id
      and (
        host_applications.host_id = auth.uid()
        or hosts.user_id = auth.uid()
      )
  )
);

drop policy if exists "Hosts can update own listing photos" on public.listing_photos;

create policy "Hosts can update own listing photos"
on public.listing_photos
for update
using (
  exists (
    select 1
    from public.listings
    left join public.hosts on hosts.id = listings.host_id
    where listings.id = listing_photos.listing_id
      and (
        listings.host_id = auth.uid()
        or hosts.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.listings
    left join public.hosts on hosts.id = listings.host_id
    where listings.id = listing_photos.listing_id
      and (
        listings.host_id = auth.uid()
        or hosts.user_id = auth.uid()
      )
  )
);
