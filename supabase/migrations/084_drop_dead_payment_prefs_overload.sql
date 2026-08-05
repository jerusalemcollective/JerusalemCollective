-- 084_drop_dead_payment_prefs_overload.sql
--
-- Audit data-integrity (low, cosmetic). CREATE OR REPLACE never drops old
-- overloads, so the original 3-arg update_host_payment_preferences (010) still
-- exists alongside the 5-arg version (057/059). The app only ever calls the
-- 5-arg version (it passes accepts_jlm + supported_currencies), so the 3-arg
-- overload is dead. Drop it. Signature-specific, so the live 5-arg version is
-- untouched.
--
-- The update_current_host_application / update_current_host_listing overloads
-- are intentionally left in place: the app calls them with a large named-arg
-- set that resolves unambiguously today, and dropping the wrong signature would
-- break working host editing for no user-facing gain.

drop function if exists public.update_host_payment_preferences(boolean, text, text);
