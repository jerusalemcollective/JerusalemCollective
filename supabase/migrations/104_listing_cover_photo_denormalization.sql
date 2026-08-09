-- 104_listing_cover_photo_denormalization.sql
--
-- Denormalizes each listing's cover photo onto listings.cover_photo_url so card
-- grids (/stays, homepage, /map, SEO pages, /account/saved, host profiles) stop
-- firing a second batched listing_photos query per render. The column stores the
-- SAME full public Storage URL currently held in listing_photos.photo_url (never a
-- storage key), so next/image renders it with no config change.
--
-- Correctness contract: after ANY listing_photos mutation the column must equal the
-- true cover (or null if the listing has no photos). Maintained by a single
-- AFTER INSERT/UPDATE/DELETE trigger on listing_photos. security definer + owner
-- (postgres) => the inner UPDATE on listings is RLS-exempt, so it lands no matter
-- which role (browser session, service role, admin/host server action, raw SQL)
-- wrote the photo.
--
-- Cover-selection rule mirrors today's hottest read path exactly:
--   the row with is_cover=true, else the lowest sort_order, else null.
--
-- Idempotent / re-runnable: safe to paste top-to-bottom into the Supabase SQL editor
-- more than once. MUST be applied by an owner/superuser (the SQL editor's postgres
-- role) so the security-definer RLS exemption holds.
--
-- ROLLOUT: run this migration BEFORE deploying the read-path code that selects
-- cover_photo_url. It is backwards-compatible with the currently deployed app (old
-- code writes photos -> trigger maintains the column; old code never reads it), so
-- it is safe to apply at any time ahead of the deploy.

-- 1. Column (nullable, no default; mirrors listing_photos.photo_url, a full URL).
alter table public.listings
  add column if not exists cover_photo_url text;

comment on column public.listings.cover_photo_url is
  'Denormalized full public Storage URL of this listing''s cover photo (is_cover, '
  'else lowest sort_order, else null). Maintained by trigger sync_listing_cover_photo '
  'on public.listing_photos - do not write directly.';

-- 2. Sync function: recompute the cover for one or two affected listings.
create or replace function public.sync_listing_cover_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ids uuid[];
  target uuid;
  new_cover text;
begin
  if tg_op = 'INSERT' then
    target_ids := array[new.listing_id];
  elsif tg_op = 'DELETE' then
    target_ids := array[old.listing_id];
  elsif old.listing_id is distinct from new.listing_id then
    -- Approval relink moves rows from application-only (listing_id null) to a
    -- listing; recompute both the old and the new listing.
    target_ids := array[old.listing_id, new.listing_id];
  else
    target_ids := array[new.listing_id];
  end if;

  foreach target in array target_ids loop
    if target is not null then
      select p.photo_url
        into new_cover
        from public.listing_photos p
       where p.listing_id = target
         and p.photo_url is not null
       order by p.is_cover desc nulls last,
                p.sort_order asc nulls last,
                p.id asc
       limit 1;
      -- select-into leaves new_cover NULL when the listing has no photos.

      update public.listings
         set cover_photo_url = new_cover
       where id = target
         and cover_photo_url is distinct from new_cover;
    end if;
  end loop;

  return null; -- AFTER trigger: return value ignored.
end;
$$;

-- 3. Trigger: fires on every write to listing_photos.
drop trigger if exists sync_listing_cover_photo on public.listing_photos;
create trigger sync_listing_cover_photo
after insert or update or delete on public.listing_photos
for each row
execute function public.sync_listing_cover_photo();

-- 4. One-time backfill (unconditional recompute -> re-runnable). Nulls listings
--    that have no photos. Uses the identical cover-selection rule as the trigger,
--    so backfilled values never disagree with future trigger values.
update public.listings l
   set cover_photo_url = (
     select p.photo_url
       from public.listing_photos p
      where p.listing_id = l.id
        and p.photo_url is not null
      order by p.is_cover desc nulls last,
               p.sort_order asc nulls last,
               p.id asc
      limit 1
   )
 where l.cover_photo_url is distinct from (
     select p.photo_url
       from public.listing_photos p
      where p.listing_id = l.id
        and p.photo_url is not null
      order by p.is_cover desc nulls last,
               p.sort_order asc nulls last,
               p.id asc
      limit 1
   );

-- 5. Atomic reorder RPC. The photo manager used to persist a drag-reorder as N
--    separate UPDATE round-trips (Promise.all): N independent READ COMMITTED
--    transactions, so the AFTER-row trigger could recompute the cover before a
--    sibling transaction's is_cover flip was visible and leave cover_photo_url on
--    the PREVIOUS cover (the drag-to-front "set cover" gesture would appear not to
--    take until the next write). Reordering in ONE statement makes every AFTER-row
--    recompute observe the final ordering, so the column is always correct — and it
--    is one round-trip instead of N. SECURITY INVOKER: the UPDATE runs under the
--    caller's RLS, exactly the same ownership protection as the old direct updates.
create or replace function public.reorder_listing_photos(
  p_listing_id uuid,
  p_ordered_ids uuid[]
)
returns void
language sql
as $$
  update public.listing_photos p
     set sort_order = arr.ord - 1,
         is_cover = (arr.ord = 1)
    from unnest(p_ordered_ids) with ordinality as arr(id, ord)
   where p.id = arr.id
     and p.listing_id = p_listing_id;
$$;

revoke all on function public.reorder_listing_photos(uuid, uuid[]) from public;
grant execute on function public.reorder_listing_photos(uuid, uuid[]) to authenticated;
