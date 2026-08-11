-- Guests can pick a preferred display currency; prices across the site are
-- converted into it with live FX. Stored on the profile, self-updatable under
-- the existing "users manage own profile" policies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD';
