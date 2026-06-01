alter table public.hosts
add column if not exists listing_blocked boolean not null default false,
add column if not exists listing_blocked_at timestamptz,
add column if not exists listing_blocked_reason text;

comment on column public.hosts.listing_blocked
  is 'When true, this host cannot submit new listing applications or create new listings.';

drop policy if exists "Admins can delete listings" on public.listings;
create policy "Admins can delete listings"
on public.listings
for delete
to authenticated
using (public.current_user_has_admin_permission('listings'));

drop policy if exists "Admins can delete listing photos" on public.listing_photos;
create policy "Admins can delete listing photos"
on public.listing_photos
for delete
to authenticated
using (public.current_user_has_admin_permission('listings'));

drop policy if exists "Admins can delete listing unavailable ranges" on public.listing_unavailable_ranges;
create policy "Admins can delete listing unavailable ranges"
on public.listing_unavailable_ranges
for delete
to authenticated
using (public.current_user_has_admin_permission('listings'));

drop policy if exists "Admins can delete listing admin messages" on public.listing_admin_messages;
create policy "Admins can delete listing admin messages"
on public.listing_admin_messages
for delete
to authenticated
using (public.current_user_has_admin_permission('listings'));
