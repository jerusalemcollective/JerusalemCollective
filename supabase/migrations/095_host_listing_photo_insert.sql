-- Hosts can add photos to their own LIVE listings from the manage-property page.
--
-- listing_photos already had UPDATE and DELETE policies keyed on listing_id
-- (reorder/cover + remove), and an INSERT policy keyed on application_id (used
-- by the application wizard). What was missing: an INSERT policy keyed on
-- listing_id, so uploading a new photo to an approved/live listing was blocked
-- by RLS. This adds it, mirroring the listing_id UPDATE/DELETE policies.

drop policy if exists "Hosts can add own listing photos" on public.listing_photos;

create policy "Hosts can add own listing photos"
on public.listing_photos
for insert
to authenticated
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
