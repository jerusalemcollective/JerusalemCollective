-- 072_rls_write_coverage_fixes.sql
--
-- Fixes every gap found by the RLS write-coverage sweep: application code
-- writes a table, but no policy permits it for the actual actor. UPDATE and
-- DELETE fail SILENTLY (zero rows, no error); INSERT raises 42501, which the
-- app then swallows. Either way the UI reports success.
--
-- Written to be idempotent and self-healing. Migrations 043 and 062 exist in
-- the repo but were never applied to production, so nothing here assumes any
-- earlier migration ran. Every policy is dropped and recreated.
--
-- NOT included, deliberately: a host UPDATE policy on public.bookings.
-- Migration 063 froze bookings.payment_status on purpose ("only server/Stripe
-- flows change them") while the host dashboard ships a control that changes it.
-- That contradiction is a product decision, not a bug fix.


-- ---------------------------------------------------------------------------
-- 1. admin_audit_log INSERT — the audit trail has never recorded anything.
--    RLS is on (023) with a SELECT-only policy. Every insert from lib/audit.ts
--    was rejected with 42501 and swallowed by a console.error.
--    performed_by was also never populated, so add a default.
-- ---------------------------------------------------------------------------
alter table public.admin_audit_log
  alter column performed_by set default auth.uid();

drop policy if exists "Admins can write audit log" on public.admin_audit_log;
create policy "Admins can write audit log"
on public.admin_audit_log
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);


-- ---------------------------------------------------------------------------
-- 2. hosts UPDATE — two separate problems.
--    (a) No admin policy exists anywhere, so admin verify-host and block-host
--        silently no-op.
--    (b) The self-service policy (from the unnumbered host-profile-trigger.sql)
--        checks only `id = auth.uid()`, so a host linked via hosts.user_id
--        cannot update their own row — notification preferences silently fail.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can update hosts" on public.hosts;
create policy "Admins can update hosts"
on public.hosts
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Hosts can update their own profile" on public.hosts;
create policy "Hosts can update their own profile"
on public.hosts
for update
to authenticated
using (id = auth.uid() or user_id = auth.uid())
with check (id = auth.uid() or user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 3. platform_settings INSERT — there is an UPDATE policy but no INSERT one.
--    updatePaymentRouteSettings uses .upsert(), which Postgres evaluates as
--    INSERT ... ON CONFLICT: the INSERT WITH CHECK is tested BEFORE the
--    conflict resolves, so the whole statement is denied even though the rows
--    already exist. This is why jlm_payments_enabled could never be turned on.
-- ---------------------------------------------------------------------------
-- An admin whose admin_role is NULL passes lib/admin.ts (which defaults a null
-- role to 'owner') but fails current_user_admin_role() = 'owner' inside RLS, so
-- their settings writes silently no-op. Backfill so app and database agree.
update public.profiles
set admin_role = 'owner'
where is_admin = true
  and admin_role is null;

drop policy if exists "Owners can insert platform settings" on public.platform_settings;
create policy "Owners can insert platform settings"
on public.platform_settings
for insert
to authenticated
with check (public.current_user_admin_role() = 'owner');


-- ---------------------------------------------------------------------------
-- 4. conversations UPDATE — migration 062 was never applied, so no UPDATE
--    policy exists live. lib/messaging.ts bumps updated_at on every new
--    message; it silently fails, so inbox ordering is frozen at creation time.
--
--    Conversations exist in two shapes: participant_2 is sometimes hosts.id
--    (listing-detail flow) and sometimes the auth user id (enquiry flow), so
--    the policy must bridge both.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update own conversations" on public.conversations;
create policy "Users can update own conversations"
on public.conversations
for update
to authenticated
using (
  participant_1 = auth.uid()
  or participant_2 = auth.uid()
  or exists (
    select 1 from public.hosts h
    where (h.id = conversations.participant_1 or h.id = conversations.participant_2)
      and h.user_id = auth.uid()
  )
)
with check (
  participant_1 = auth.uid()
  or participant_2 = auth.uid()
  or exists (
    select 1 from public.hosts h
    where (h.id = conversations.participant_1 or h.id = conversations.participant_2)
      and h.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------------------------
-- 5. messages UPDATE — migration 043 was never applied, so read receipts have
--    never persisted for anyone. Unread badges reappear on every reload.
--    Helper keeps the participant test in one place.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_in_conversation(conversation_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conversation_uuid
      and (
        c.participant_1 = auth.uid()
        or c.participant_2 = auth.uid()
        or exists (
          select 1 from public.hosts h
          where (h.id = c.participant_1 or h.id = c.participant_2)
            and h.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.current_user_in_conversation(uuid) from public;
grant execute on function public.current_user_in_conversation(uuid) to authenticated;

drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
on public.messages
for update
to authenticated
using (
  sender_id is distinct from auth.uid()
  and public.current_user_in_conversation(conversation_id)
)
with check (
  sender_id is distinct from auth.uid()
  and public.current_user_in_conversation(conversation_id)
);


-- ---------------------------------------------------------------------------
-- 6. booking_requests.host_notified_at — the only UPDATE policy covers hosts
--    and admins, but the actor in notify-host-enquiry is the GUEST. The write
--    silently affected zero rows, so the "already notified" guard never fired
--    and the host enquiry email was re-sent on every call.
--
--    A guest-scoped UPDATE policy would let guests edit dates and status too,
--    so this is a function that touches exactly one column instead.
-- ---------------------------------------------------------------------------
create or replace function public.mark_booking_request_host_notified(request_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.booking_requests
  set host_notified_at = now()
  where id = request_uuid
    and guest_id = auth.uid()
    and host_notified_at is null
  returning id into updated_id;

  return updated_id is not null;
end;
$$;

revoke all on function public.mark_booking_request_host_notified(uuid) from public;
grant execute on function public.mark_booking_request_host_notified(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. listing_shul_distances INSERT/UPDATE — migration 047 gave the write
--    policy to service_role, assuming a background job. Both real callers
--    (host listing edit, admin application approval) are user-scoped, so
--    walking distances have never been saved.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners and admins can insert shul distances" on public.listing_shul_distances;
create policy "Owners and admins can insert shul distances"
on public.listing_shul_distances
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
  or exists (
    select 1 from public.listings l
    where l.id = listing_shul_distances.listing_id
      and (
        l.host_id = auth.uid()
        or exists (
          select 1 from public.hosts h
          where h.id = l.host_id and h.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Owners and admins can update shul distances" on public.listing_shul_distances;
create policy "Owners and admins can update shul distances"
on public.listing_shul_distances
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
  or exists (
    select 1 from public.listings l
    where l.id = listing_shul_distances.listing_id
      and (
        l.host_id = auth.uid()
        or exists (
          select 1 from public.hosts h
          where h.id = l.host_id and h.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
  or exists (
    select 1 from public.listings l
    where l.id = listing_shul_distances.listing_id
      and (
        l.host_id = auth.uid()
        or exists (
          select 1 from public.hosts h
          where h.id = l.host_id and h.user_id = auth.uid()
        )
      )
  )
);


-- ---------------------------------------------------------------------------
-- 8. host_applications — two gaps.
--    (a) No INSERT policy exists in version control. If onboarding currently
--        works, one was created by hand in the dashboard; recreating it here
--        captures it in the migration history either way.
--    (b) No host UPDATE policy. become-a-host writes verification_doc_path and
--        id_doc_path after upload; those writes silently affect zero rows, so
--        documents land in storage but the application row shows none and the
--        admin reviewer sees an application with no ID attached.
--
--    (b) is a function rather than a policy so a host cannot also edit their
--        own status or verification_status.
-- ---------------------------------------------------------------------------
drop policy if exists "Hosts can create own applications" on public.host_applications;
create policy "Hosts can create own applications"
on public.host_applications
for insert
to authenticated
with check (
  host_id = auth.uid()
  or exists (
    select 1 from public.hosts h
    where h.id = host_applications.host_id
      and h.user_id = auth.uid()
  )
);

create or replace function public.set_host_application_document_path(
  application_uuid uuid,
  document_kind text,
  document_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if document_kind not in ('verification_doc', 'id_doc') then
    raise exception 'Unknown document kind';
  end if;

  update public.host_applications a
  set verification_doc_path = case
        when document_kind = 'verification_doc' then document_path
        else a.verification_doc_path
      end,
      id_doc_path = case
        when document_kind = 'id_doc' then document_path
        else a.id_doc_path
      end
  where a.id = application_uuid
    and (
      a.host_id = auth.uid()
      or exists (
        select 1 from public.hosts h
        where h.id = a.host_id and h.user_id = auth.uid()
      )
    )
  returning a.id into updated_id;

  return updated_id is not null;
end;
$$;

revoke all on function public.set_host_application_document_path(uuid, text, text) from public;
grant execute on function public.set_host_application_document_path(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 9. bookings SELECT for hosts — hosts have no SELECT policy on bookings at
--    all, so the host payments page renders an empty list regardless of how
--    many bookings they have. Read-only; does not touch 063's payment_status
--    freeze.
-- ---------------------------------------------------------------------------
drop policy if exists "Hosts can view own bookings" on public.bookings;
create policy "Hosts can view own bookings"
on public.bookings
for select
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1 from public.hosts h
    where h.id = bookings.host_id and h.user_id = auth.uid()
  )
);


-- ---------------------------------------------------------------------------
-- 10. listing_unavailable_ranges INSERT — the existing policy's second clause
--     requires listings.host_id to equal the new row's host_id exactly, which
--     rejects split-identity hosts whose listing is keyed to their auth id.
--     Fails loudly rather than silently, but still blocks a legitimate host.
-- ---------------------------------------------------------------------------
drop policy if exists "Hosts can insert own unavailable ranges" on public.listing_unavailable_ranges;
create policy "Hosts can insert own unavailable ranges"
on public.listing_unavailable_ranges
for insert
to authenticated
with check (
  (
    host_id = auth.uid()
    or exists (
      select 1 from public.hosts h
      where h.id = listing_unavailable_ranges.host_id
        and h.user_id = auth.uid()
    )
  )
  and exists (
    select 1 from public.listings l
    where l.id = listing_unavailable_ranges.listing_id
      and (
        l.host_id = listing_unavailable_ranges.host_id
        or l.host_id = auth.uid()
        or exists (
          select 1 from public.hosts h
          where h.id = l.host_id and h.user_id = auth.uid()
        )
      )
  )
);
