-- 082_avatars_bucket_owner_write.sql
--
-- Audit security (medium). The avatars bucket's write policy lived only in the
-- Supabase dashboard (unversioned), and the upload paths didn't put the user id
-- in a folder segment, so an owner-scoped rule wasn't possible. The app now
-- uploads to '<uid>/avatar-...'; add versioned owner-scoped write policies so a
-- user can only create/replace/delete files under their own folder.
--
-- Public read is unchanged (the avatars bucket is public). These policies are
-- additive/idempotent.
--
-- IMPORTANT: if a broad write policy still exists in the dashboard (e.g.
-- bucket_id = 'avatars' for authenticated with no owner check), it must be
-- REMOVED for this to actually restrict writes — permissive policies OR
-- together. Find it with:
--   select policyname, cmd from pg_policies
--   where schemaname='storage' and tablename='objects'
--     and (qual ilike '%avatars%' or with_check ilike '%avatars%');
-- and drop any policy other than the three below.

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
