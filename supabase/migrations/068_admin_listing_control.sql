-- 068_admin_listing_control.sql
--
-- Two problems this fixes:
--
-- 1. Admins could never delete a listing. Migration 004 created admin
--    policies for INSERT, SELECT and UPDATE on public.listings, but never
--    one for DELETE, and RLS is enabled on the table (009, 036). Postgres
--    therefore deleted zero rows and returned NO error, so the admin UI
--    reported success while the listing stayed put.
--
-- 2. There was no way to take a listing down permanently without deleting
--    it. A listing with bookings or reviews often cannot be hard-deleted at
--    all, so admins need an archive that always works.

-- ---------------------------------------------------------------------------
-- 1. Archive support
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists archived_at timestamptz;

comment on column public.listings.archived_at is
  'When set, the listing is archived: hidden from the public site and from the default admin list, but retained with its booking history. Archiving also sets is_published = false.';

-- Public pages all filter on is_published = true, and archiving forces that
-- to false, so archived listings disappear from the public site without any
-- change to the public queries. This index keeps the admin list fast.
create index if not exists listings_archived_at_idx
  on public.listings (archived_at)
  where archived_at is not null;

-- ---------------------------------------------------------------------------
-- 2. The missing admin DELETE policies
-- ---------------------------------------------------------------------------
-- Same EXISTS(profiles.is_admin) shape as the other listings policies in 004,
-- so the whole table stays consistent.

drop policy if exists "Admins can delete listings" on public.listings;
create policy "Admins can delete listings"
on public.listings
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

-- deleteListing() also clears these child tables first. Without their own
-- DELETE policies those cleanups silently removed nothing, which then left
-- foreign-key rows behind and blocked the parent delete.

drop policy if exists "Admins can delete listing photos" on public.listing_photos;
create policy "Admins can delete listing photos"
on public.listing_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can delete listing unavailable ranges" on public.listing_unavailable_ranges;
create policy "Admins can delete listing unavailable ranges"
on public.listing_unavailable_ranges
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can delete listing admin messages" on public.listing_admin_messages;
create policy "Admins can delete listing admin messages"
on public.listing_admin_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

-- ---------------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------------
-- Expect four rows, one DELETE policy per table:
--
--   select tablename, policyname, cmd
--   from pg_policies
--   where cmd = 'DELETE'
--     and tablename in (
--       'listings', 'listing_photos',
--       'listing_unavailable_ranges', 'listing_admin_messages'
--     )
--   order by tablename;
--
-- And the new column:
--
--   select column_name from information_schema.columns
--   where table_name = 'listings' and column_name = 'archived_at';
