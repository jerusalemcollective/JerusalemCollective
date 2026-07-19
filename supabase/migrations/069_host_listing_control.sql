-- 069_host_listing_control.sql
--
-- Hosts could only ever SELECT their own listings. Migrations 009 and 020
-- created "Hosts can view own listings" and nothing else, so there is no
-- host UPDATE and no host DELETE policy on public.listings.
--
-- Because the host dashboard uses a normal RLS-bound client, that means
-- updateHostListing() has been updating zero rows and returning no error:
-- a host edits their listing, hits save, gets redirected, and nothing is
-- stored. This migration is what makes host editing, hiding and deleting
-- actually work.
--
-- Ownership expression matches "Hosts can view own listings" from 020.

-- ---------------------------------------------------------------------------
-- Listings: hosts may update and delete their own
-- ---------------------------------------------------------------------------

drop policy if exists "Hosts can update own listings" on public.listings;
create policy "Hosts can update own listings"
on public.listings
for update
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = listings.host_id
      and hosts.user_id = auth.uid()
  )
)
with check (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = listings.host_id
      and hosts.user_id = auth.uid()
  )
);

drop policy if exists "Hosts can delete own listings" on public.listings;
create policy "Hosts can delete own listings"
on public.listings
for delete
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = listings.host_id
      and hosts.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Child rows a host delete has to clear first
-- ---------------------------------------------------------------------------

drop policy if exists "Hosts can delete own listing photos" on public.listing_photos;
create policy "Hosts can delete own listing photos"
on public.listing_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_photos.listing_id
      and (
        listings.host_id = auth.uid()
        or exists (
          select 1
          from public.hosts
          where hosts.id = listings.host_id
            and hosts.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Hosts can delete own listing unavailable ranges" on public.listing_unavailable_ranges;
create policy "Hosts can delete own listing unavailable ranges"
on public.listing_unavailable_ranges
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings
    where listings.id = listing_unavailable_ranges.listing_id
      and (
        listings.host_id = auth.uid()
        or exists (
          select 1
          from public.hosts
          where hosts.id = listings.host_id
            and hosts.user_id = auth.uid()
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- Expect UPDATE and DELETE rows for hosts on listings:
--
--   select policyname, cmd from pg_policies
--   where tablename = 'listings' order by cmd, policyname;
--
-- After running this, a host editing a listing should actually persist the
-- change. That was silently failing before.
