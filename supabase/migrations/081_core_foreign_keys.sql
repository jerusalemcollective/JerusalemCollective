-- 081_core_foreign_keys.sql
--
-- Audit H4. saved_listings.listing_id, bookings.listing_id, bookings.host_id,
-- and conversations.listing_id were plain uuid columns with NO foreign key, so
-- deleting a listing (now enabled for admins/hosts in 068/069) left dangling
-- bookings and wishlist rows pointing at a listing that no longer exists.
-- Verified zero orphaned rows before applying (see the pre-check).
--
-- Delete behaviour is chosen per relationship:
--   * bookings -> listings / hosts : RESTRICT. A listing or host with bookings
--     cannot be deleted (protects upcoming stays and money records). Archive
--     the listing instead (admin/host archive already exists).
--   * saved_listings -> listings : CASCADE. Deleting a listing removes it from
--     everyone's wishlist -- the natural behaviour.
--   * conversations -> listings : SET NULL. Keep the message thread/history;
--     just drop the (now meaningless) listing link.

alter table public.bookings drop constraint if exists bookings_listing_id_fkey;
alter table public.bookings
  add constraint bookings_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete restrict;

alter table public.bookings drop constraint if exists bookings_host_id_fkey;
alter table public.bookings
  add constraint bookings_host_id_fkey
  foreign key (host_id) references public.hosts(id) on delete restrict;

alter table public.saved_listings drop constraint if exists saved_listings_listing_id_fkey;
alter table public.saved_listings
  add constraint saved_listings_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete cascade;

alter table public.conversations drop constraint if exists conversations_listing_id_fkey;
alter table public.conversations
  add constraint conversations_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete set null;
