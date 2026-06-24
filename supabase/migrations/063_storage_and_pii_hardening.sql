-- 063_storage_and_pii_hardening.sql
--
-- Security hardening (Audit Session 1, items #1-#4):
--   #1  Verification (KYC) documents: only the owning host or an admin may
--       write/delete their files (was: any authenticated user).
--   #2  Listing photos: only the owning host or an admin may write/delete
--       a listing's photos (was: any authenticated user).
--   #3  Profiles: phone + personal guest-context fields were world-readable
--       (incl. anonymous). Restrict reads to self, admins, and the person
--       you share a conversation with. (Public pages read host display info
--       from `hosts` and reviewer names from `reviews`, NOT from `profiles`,
--       so this does not affect public pages.)
--   #4  Bookings: guests could set their own `payment_status` (payment
--       bypass). Lock the privileged columns so guests can't change them.
--
-- NOTE: host_email exposure on the public `hosts` table (#3b) is intentionally
--       NOT changed here, because app/hosts/[id]/page.tsx does `select('*')`
--       on hosts for anonymous visitors; restricting the email column requires
--       a small code change to that page first. Tracked for a follow-up.

-- ---------------------------------------------------------------------------
-- Helper: does the current user own the host application referenced by a
-- storage path segment?  Storage paths are:
--   verification-docs : applications/<applicationId>/<file>
--   listing-photos    : listings/<applicationId>/<file>
-- so the applicationId is the 2nd folder segment. host_applications.host_id
-- is the owning user's auth.uid().
--
-- SECURITY DEFINER so the ownership lookup is not itself blocked by RLS, and
-- so a malformed (non-uuid) path segment fails closed instead of erroring.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_owns_application_path(path_segment text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app_id uuid;
begin
  begin
    app_id := path_segment::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.host_applications a
    where a.id = app_id
      and a.host_id = auth.uid()
  );
end;
$$;

revoke all on function public.current_user_owns_application_path(text) from public;
grant execute on function public.current_user_owns_application_path(text) to authenticated;


-- ---------------------------------------------------------------------------
-- #1  verification-docs bucket: scope writes to owner-or-admin.
--     (The private bucket flag and the admin-only SELECT policy from
--      034 are left untouched.)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can upload verification documents" on storage.objects;
drop policy if exists "Owners or admins can upload verification documents" on storage.objects;
create policy "Owners or admins can upload verification documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-docs'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);

drop policy if exists "Authenticated users can update verification documents" on storage.objects;
drop policy if exists "Owners or admins can update verification documents" on storage.objects;
create policy "Owners or admins can update verification documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'verification-docs'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
)
with check (
  bucket_id = 'verification-docs'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);

drop policy if exists "Authenticated users can delete verification documents" on storage.objects;
drop policy if exists "Owners or admins can delete verification documents" on storage.objects;
create policy "Owners or admins can delete verification documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-docs'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);


-- ---------------------------------------------------------------------------
-- #2  listing-photos bucket: scope writes to owner-or-admin.
--     Public READ is unchanged (public bucket; served via public URL).
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can upload listing photos" on storage.objects;
drop policy if exists "Owners or admins can upload listing photos" on storage.objects;
create policy "Owners or admins can upload listing photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);

drop policy if exists "Authenticated users can update listing photos" on storage.objects;
drop policy if exists "Owners or admins can update listing photos" on storage.objects;
create policy "Owners or admins can update listing photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-photos'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
)
with check (
  bucket_id = 'listing-photos'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);

drop policy if exists "Authenticated users can manage listing photos" on storage.objects;
drop policy if exists "Owners or admins can delete listing photos" on storage.objects;
create policy "Owners or admins can delete listing photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-photos'
  and (
    public.current_user_is_admin()
    or public.current_user_owns_application_path((storage.foldername(name))[2])
  )
);


-- ---------------------------------------------------------------------------
-- #3  profiles: stop world-readable phone / personal fields.
--     Allowed readers: the user themselves, admins, and anyone who shares a
--     conversation with them (needed so messaging shows the other party's
--     name / avatar / guest context). current_user_is_admin() is
--     SECURITY DEFINER, so this does NOT recurse into profiles RLS.
-- ---------------------------------------------------------------------------
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Profiles are viewable by self, admins, and conversation partners" on profiles;
create policy "Profiles are viewable by self, admins, and conversation partners"
on profiles
for select
using (
  auth.uid() = id
  or public.current_user_is_admin()
  or exists (
    select 1
    from public.conversations c
    where (c.participant_1 = auth.uid() and c.participant_2 = profiles.id)
       or (c.participant_2 = auth.uid() and c.participant_1 = profiles.id)
  )
);


-- ---------------------------------------------------------------------------
-- #4  bookings: keep "update your own booking", but forbid changing the
--     privileged columns. payment_status and host_id must stay equal to the
--     value already stored (only server/Stripe flows change them).
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update own bookings" on bookings;
create policy "Users can update own bookings"
on bookings
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and payment_status is not distinct from (
    select b.payment_status from public.bookings b where b.id = bookings.id
  )
  and host_id is not distinct from (
    select b.host_id from public.bookings b where b.id = bookings.id
  )
);
