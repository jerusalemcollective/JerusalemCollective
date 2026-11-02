-- 122_listing_drafts.sql
--
-- Unfinished /become-a-host listings follow a signed-in host to any device.
--
--   1. public.listing_drafts: one draft per user (the form fields as jsonb,
--      plus step/title/area for the header, banner and dashboard card).
--      A user can only see and change their own row; anon has no access.
--   2. listing-photos storage: a user may manage objects under
--      drafts/<their uid>/ only, so draft photos can be shown on another
--      device. Existing listings/<applicationId>/ policies are untouched.
--   3. host_applications.received_email_sent_at: guards the "We've received
--      your listing" email against double sends.
--
-- Idempotent: safe to run more than once. The app keeps working (drafts stay
-- in the browser only) until this has been run.

-- ---------------------------------------------------------------------------
-- 1. listing_drafts
-- ---------------------------------------------------------------------------
create table if not exists public.listing_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  step int,
  title text,
  area text,
  updated_at timestamptz default now()
);

alter table public.listing_drafts enable row level security;

revoke all on table public.listing_drafts from anon;
grant select, insert, update, delete on table public.listing_drafts to authenticated;

drop policy if exists "Users can read their own listing draft" on public.listing_drafts;
create policy "Users can read their own listing draft"
on public.listing_drafts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own listing draft" on public.listing_drafts;
create policy "Users can create their own listing draft"
on public.listing_drafts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own listing draft" on public.listing_drafts;
create policy "Users can update their own listing draft"
on public.listing_drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own listing draft" on public.listing_drafts;
create policy "Users can delete their own listing draft"
on public.listing_drafts
for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. listing-photos: drafts/<uid>/<file>, owner only.
--    (storage.foldername(name))[1] = 'drafts', [2] = the user's id.
--    SELECT is needed for the owner to list/download/remove their own draft
--    photos; it grants nothing outside their own folder. The bucket stays
--    public as before (objects are served by unguessable public URL).
-- ---------------------------------------------------------------------------
drop policy if exists "Users can read their own draft listing photos" on storage.objects;
create policy "Users can read their own draft listing photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can upload their own draft listing photos" on storage.objects;
create policy "Users can upload their own draft listing photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can update their own draft listing photos" on storage.objects;
create policy "Users can update their own draft listing photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can delete their own draft listing photos" on storage.objects;
create policy "Users can delete their own draft listing photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = 'drafts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 3. "We've received your listing" email: sent at most once per application.
--    Only written by the server (service role) in
--    app/api/notify-host-application-received.
-- ---------------------------------------------------------------------------
alter table if exists public.host_applications
  add column if not exists received_email_sent_at timestamptz;

notify pgrst, 'reload schema';
