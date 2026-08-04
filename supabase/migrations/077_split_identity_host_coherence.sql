-- 077_split_identity_host_coherence.sql
--
-- Split-identity hosts (linked by hosts.user_id = auth.uid() with a DISTINCT
-- hosts.id, e.g. admin-created) were missed by the standard bridge
-- "id = auth.uid() OR EXISTS(hosts.user_id = auth.uid())" on several RLS
-- surfaces. Restore the bridge on all of them, idempotently, as one change.
--
-- Repo != live DB: migrations 043/062 were never applied, so nothing here
-- assumes an earlier migration ran; every policy is dropped and recreated and
-- every helper is create-or-replace. Bridges reference only hosts.id /
-- hosts.user_id, both still granted to `authenticated` after 074's per-column
-- lockdown (never email / calendar_token). No policy can recurse: hosts SELECT
-- is USING(true); the conversation self-lookup is inside a SECURITY DEFINER
-- helper that bypasses conversations' own RLS.

-- ===========================================================================
-- FIX 1 (audit M-onboard): become-a-host uploads denied for split-identity hosts
-- 063's helper checked only host_applications.host_id = auth.uid(). For a
-- split-identity host host_applications.host_id = hosts.id <> auth.uid(), so the
-- storage RLS on verification-docs and listing-photos denied every upload in
-- app/become-a-host/page.tsx. Teach the helper the hosts.user_id bridge. Keep
-- SECURITY DEFINER (lookup not blocked by RLS; non-uuid segment fails closed).
-- Signature unchanged, so 063's storage policies keep calling it transparently.
-- ===========================================================================
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
      and (
        a.host_id = auth.uid()
        or exists (
          select 1 from public.hosts h
          where h.id = a.host_id
            and h.user_id = auth.uid()
        )
      )
  );
end;
$$;

revoke all on function public.current_user_owns_application_path(text) from public;
grant execute on function public.current_user_owns_application_path(text) to authenticated;


-- ===========================================================================
-- FIX 2 (audit H5): read + write visibility of conversations + messages
-- Live SELECT/INSERT policies are 001's un-bridged versions (062 never applied;
-- 072 restored only the UPDATE side). Restore the SELECT bridge AND the INSERT
-- bridge so a split-identity host can both READ and REPLY on legacy threads
-- where participant_2 = hosts.id.
-- ===========================================================================

-- Recreate 072's helper idempotently so both the messages SELECT and INSERT
-- policies can reuse it whether or not 072 is live. SECURITY DEFINER => the
-- inner read of conversations does not recurse into conversations' RLS.
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

-- conversations SELECT: inline bridge (matches 072's conversations UPDATE shape)
drop policy if exists "Users can view own conversations" on public.conversations;
create policy "Users can view own conversations"
on public.conversations
for select
to authenticated
using (
  participant_1 = auth.uid()
  or participant_2 = auth.uid()
  or exists (
    select 1 from public.hosts h
    where (h.id = conversations.participant_1 or h.id = conversations.participant_2)
      and h.user_id = auth.uid()
  )
);

-- messages SELECT: reuse helper (matches 072's messages UPDATE shape)
drop policy if exists "Users can view messages in their conversations" on public.messages;
create policy "Users can view messages in their conversations"
on public.messages
for select
to authenticated
using (public.current_user_in_conversation(conversation_id));

-- messages INSERT: bridged so a split-identity host can reply on legacy threads.
-- sender_id must still equal auth.uid(), so no spoofing; security envelope
-- unchanged. (conversations INSERT is intentionally NOT bridged: the guest is
-- always participant_1 = auth.uid() on insert, and the enquiry path inserts via
-- SECURITY DEFINER create_listing_enquiry -- no INSERT gap exists there.)
drop policy if exists "Users can send messages in their conversations" on public.messages;
create policy "Users can send messages in their conversations"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and public.current_user_in_conversation(conversation_id)
);


-- ===========================================================================
-- FIX 2c (host-side companion, audit H5): guest name on legacy host-inbox rows
-- After the conversations SELECT bridge above, a split-identity host can see
-- legacy threads (participant_2 = hosts.id) in their inbox, but the guest's
-- profile (participant_1) is still unreadable: the live 063 profiles SELECT
-- policy only admits a LITERAL participant, and the host's auth.uid() is neither
-- participant. The host therefore sees the literal "Guest". Append one bridged
-- disjunct so a host can read the profile of the guest they share a
-- conversation with via their host identity. STRICTLY ADDITIVE: the existing
-- three disjuncts are reproduced verbatim; the 4th only widens, never narrows.
-- No recursion: this subquery hits conversations (-> hosts USING(true)) and
-- hosts; nothing routes back to profiles. current_user_is_admin() is unchanged
-- and SECURITY DEFINER. Role left unspecified to preserve 063's exact behavior.
-- ===========================================================================
drop policy if exists "Profiles are viewable by self, admins, and conversation partners" on public.profiles;
create policy "Profiles are viewable by self, admins, and conversation partners"
on public.profiles
for select
using (
  auth.uid() = id
  or public.current_user_is_admin()
  or exists (
    select 1 from public.conversations c
    where (c.participant_1 = auth.uid() and c.participant_2 = profiles.id)
       or (c.participant_2 = auth.uid() and c.participant_1 = profiles.id)
  )
  or exists (
    select 1
    from public.conversations c
    join public.hosts h
      on (h.id = c.participant_1 or h.id = c.participant_2)
    where h.user_id = auth.uid()
      and (
        (h.id = c.participant_1 and c.participant_2 = profiles.id)
        or (h.id = c.participant_2 and c.participant_1 = profiles.id)
      )
  )
);


-- ===========================================================================
-- FIX 5 (audit payments-LOW): host payout visibility
-- The booking_payments host SELECT policy must bridge hosts.user_id so a
-- split-identity host (booking_payments.host_id = hosts.id <> auth.uid()) sees
-- their own payouts on app/host/dashboard/payments/page.tsx. Read-only; guest
-- (010) and admin (073) SELECT policies (distinct names) untouched.
-- CAVEAT: migration 020 already recreated this SAME policy WITH the bridge. If
-- 020 is live this is a no-op; if only 010's un-bridged version is live this is
-- the fix. Either way it is harmless.
-- ===========================================================================
drop policy if exists "Hosts can view own booking payments" on public.booking_payments;
create policy "Hosts can view own booking payments"
on public.booking_payments
for select
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1 from public.hosts h
    where h.id = booking_payments.host_id
      and h.user_id = auth.uid()
  )
);


-- ===========================================================================
-- OPTIONAL de-fork backfill (Fix 3 companion) -- NOT required for correctness.
-- Fix 3 (lib/messaging.ts) routes NEW "message host" clicks to the host's auth
-- uid; existing legacy rows keep participant_2 = hosts.id, so a guest's next
-- click would otherwise create a SECOND thread. This conservatively repoints
-- each legacy row to the host's auth uid, but ONLY where no unified row already
-- occupies the target unique key (participant_1, participant_2, listing_id) --
-- so it can never raise a unique violation. It touches no messages rows (FKs
-- are on conversation_id) and no booking_requests. Idempotent: after it runs,
-- participant_2 = user_id (<> hosts.id) so rows are not re-selected. Comment out
-- this block if you prefer to leave legacy rows in place (C2/C3 keep them fully
-- readable, replyable, and named either way).
-- ---------------------------------------------------------------------------
update public.conversations c
set participant_2 = h.user_id
from public.hosts h
where c.participant_2 = h.id
  and h.user_id is not null
  and h.user_id <> h.id
  and not exists (
    select 1 from public.conversations existing
    where existing.participant_1 = c.participant_1
      and existing.participant_2 = h.user_id
      and existing.listing_id is not distinct from c.listing_id
      and existing.id <> c.id
  );
