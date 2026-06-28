-- 064_security_followups.sql
--
-- Follow-up hardening (Audit Session 2). SAFE TO RUN AS-IS — every statement is
-- additive or idempotent and does not change existing public/anon read behaviour.
--
--   P2-A  Stripe webhook idempotency: a table to record processed event ids so a
--         replayed/retried webhook is a no-op (prevents double bookings/charges).
--   P2-G  profiles: add an explicit WITH CHECK to the self-update policy and
--         extend the admin-flag guard trigger to also freeze `admin_role`
--         (defense-in-depth; is_admin escalation was already blocked by 005).
--
-- NOTE: Two further items (restricting the public `hosts.email` column, and
--       de-duplicating booking_requests) need your LIVE schema confirmed first
--       because the base `hosts` table and the create_listing_enquiry() function
--       are not fully defined in this migration set. They live in the companion
--       file `REVIEW_FIRST_hosts_email_and_booking_dedup.sql` — do NOT run that
--       one blind; follow its checklist.

-- ---------------------------------------------------------------------------
-- P2-A  Stripe webhook idempotency ledger.
--   Only the service role (used by the webhook handler) can touch this table;
--   RLS is enabled with no policies, so anon/authenticated have no access.
-- ---------------------------------------------------------------------------
create table if not exists public.processed_stripe_events (
  event_id     text primary key,
  type         text,
  processed_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- P2-G  profiles self-update: explicit WITH CHECK + freeze admin columns.
--
--   The original policy (001) had only USING (auth.uid() = id). Postgres reuses
--   USING as the implicit WITH CHECK for UPDATE, so this adds no restriction for
--   ordinary edits — it just makes the intent explicit and robust.
--
--   The 005 trigger blocked changes to `is_admin` by non-admins. `admin_role`
--   (added in 019) was NOT covered. We recreate the guard to freeze both, so a
--   user can never set their own privilege columns even if a future policy
--   change loosens the row check.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.prevent_profile_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin)
     or (new.admin_role is distinct from old.admin_role) then
    if not exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    ) then
      raise exception 'Only admins can change admin access';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger definition is unchanged from 005; re-assert it so this migration is
-- self-contained and safe to run even if 005 was somehow not applied.
drop trigger if exists protect_profile_admin_flag on public.profiles;
create trigger protect_profile_admin_flag
before update on public.profiles
for each row
execute function public.prevent_profile_admin_escalation();
