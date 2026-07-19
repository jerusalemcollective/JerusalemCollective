-- 070_restore_missing_admin_functions.sql
--
-- Migration 019 was only PARTIALLY applied to production. Two of its functions
-- never made it into the live database:
--
--   * public.list_platform_people()      -> breaks /admin/guests
--   * public.set_admin_role_by_email()   -> breaks admin role assignment
--
-- Do NOT re-run all of 019 to fix this: later migrations (021, 054, 061)
-- recreated other functions from that file with newer definitions, and
-- re-running 019 would clobber current_user_has_admin_permission() with its
-- older version. This migration restores ONLY the two missing functions,
-- verbatim from 019, plus their grants.

CREATE OR REPLACE FUNCTION public.set_admin_role_by_email(
  target_email text,
  target_role text
)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  admin_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user auth.users%ROWTYPE;
  normalized_role text := nullif(trim(target_role), '');
BEGIN
  IF public.current_user_admin_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only owner admins can change admin roles';
  END IF;

  IF normalized_role IS NOT NULL
    AND normalized_role NOT IN ('owner', 'operations', 'support', 'content', 'analyst')
  THEN
    RAISE EXCEPTION 'Invalid admin role';
  END IF;

  SELECT *
  INTO target_user
  FROM auth.users
  WHERE lower(auth.users.email) = lower(trim(target_email))
  LIMIT 1;

  IF target_user.id IS NULL THEN
    RAISE EXCEPTION 'No account found for that email';
  END IF;

  INSERT INTO public.profiles (id, full_name, is_admin, admin_role)
  VALUES (
    target_user.id,
    COALESCE(
      target_user.raw_user_meta_data ->> 'full_name',
      target_user.raw_user_meta_data ->> 'name',
      split_part(target_user.email, '@', 1),
      'User'
    ),
    normalized_role IS NOT NULL,
    normalized_role
  )
  ON CONFLICT (id) DO UPDATE
  SET is_admin = normalized_role IS NOT NULL,
      admin_role = normalized_role,
      full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  RETURN QUERY
  SELECT
    target_user.id,
    target_user.email,
    profiles.full_name,
    profiles.admin_role
  FROM public.profiles
  WHERE profiles.id = target_user.id;
END;
$$;


CREATE OR REPLACE FUNCTION public.list_platform_people()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  is_host boolean,
  is_admin boolean,
  admin_role text,
  host_id uuid,
  host_name text,
  host_type text,
  host_is_verified boolean,
  listing_count bigint,
  application_count bigint,
  booking_count bigint,
  saved_count bigint,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.current_user_has_admin_permission('guests') THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  RETURN QUERY
  SELECT
    users.id,
    users.email,
    profiles.full_name,
    profiles.phone,
    profiles.avatar_url,
    COALESCE(profiles.is_host, FALSE) OR hosts.id IS NOT NULL,
    COALESCE(profiles.is_admin, FALSE),
    profiles.admin_role,
    hosts.id,
    hosts.name,
    hosts.host_type,
    hosts.is_verified,
    (
      SELECT count(*)
      FROM public.listings
      WHERE listings.host_id = hosts.id
    ) AS listing_count,
    (
      SELECT count(*)
      FROM public.host_applications
      WHERE host_applications.host_id = hosts.id
    ) AS application_count,
    (
      SELECT count(*)
      FROM public.bookings
      WHERE bookings.user_id = users.id
    ) AS booking_count,
    (
      SELECT count(*)
      FROM public.saved_listings
      WHERE saved_listings.user_id = users.id
    ) AS saved_count,
    users.created_at,
    users.last_sign_in_at
  FROM auth.users AS users
  LEFT JOIN public.profiles AS profiles
    ON profiles.id = users.id
  LEFT JOIN public.hosts AS hosts
    ON hosts.user_id = users.id
       OR hosts.id = users.id
  ORDER BY users.created_at DESC;
END;
$$;


REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_platform_people() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_people() TO authenticated;
