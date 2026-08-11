-- 107_grant_preferred_currency_select.sql
--
-- Migration 083 revoked table-level SELECT on public.profiles from the
-- authenticated role and re-granted every column except phone. profiles.
-- preferred_currency was added afterwards (migration 103) and so never received
-- a column grant — every client read of it returns 403 Forbidden, breaking the
-- preferred-currency features.
--
-- Grant SELECT on just that column (it is the user's own display preference, not
-- sensitive). phone and address stay ungranted on purpose (read via SECURITY
-- DEFINER RPCs).

grant select (preferred_currency) on public.profiles to authenticated;
