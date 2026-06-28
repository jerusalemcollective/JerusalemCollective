-- 066_hosts_email_column_privacy.sql
--
-- P1-A (DB side): hide host `email` from the anonymous (public) API role while
-- keeping public host info readable. Applied manually in the Supabase SQL editor
-- and recorded here for reproducibility / audit trail.
--
-- Why this shape:
--   * `anon` has NO table-level SELECT on hosts (only column-level grants), so we
--     control its access per-column.
--   * `authenticated` and `service_role` DO have table-level SELECT, so they keep
--     full access (incl. email) for the host dashboard, admin, and server email
--     flows — these statements do not affect them.
--
-- Verify after running:
--   select has_column_privilege('anon','public.hosts'::regclass,'name','SELECT')  as anon_name,   -- expect true
--          has_column_privilege('anon','public.hosts'::regclass,'email','SELECT') as anon_email;  -- expect false

-- Ensure anon has no table-wide SELECT (would otherwise expose every column).
revoke select on public.hosts from anon;

-- Remove the email column from the shared public role (anon inherits public).
revoke select (email) on public.hosts from public;
revoke select (email) on public.hosts from anon;

-- Grant anon ONLY the columns public pages render (no email, phone, tokens, etc.).
grant select (
  id,
  name,
  display_name,
  show_full_name,
  profile_photo_url,
  is_verified,
  host_type,
  bio,
  updated_at
) on public.hosts to anon;
