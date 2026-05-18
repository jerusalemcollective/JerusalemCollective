-- Role-based admin access and people directory helpers.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_role_check
  CHECK (
    admin_role IS NULL
    OR admin_role IN ('owner', 'operations', 'support', 'content', 'analyst')
  );

UPDATE public.profiles
SET admin_role = 'owner'
WHERE is_admin = TRUE
  AND admin_role IS NULL;

CREATE OR REPLACE FUNCTION public.current_user_admin_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.admin_role
  FROM public.profiles
  WHERE profiles.id = auth.uid()
    AND profiles.is_admin = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_admin_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_user_admin_role()
    WHEN 'owner' THEN TRUE
    WHEN 'operations' THEN required_permission IN (
      'overview',
      'applications',
      'listings',
      'hosts',
      'guests',
      'reviews',
      'analytics'
    )
    WHEN 'support' THEN required_permission IN (
      'overview',
      'hosts',
      'guests',
      'cases',
      'messages'
    )
    WHEN 'content' THEN required_permission IN (
      'overview',
      'applications',
      'listings',
      'reviews',
      'analytics'
    )
    WHEN 'analyst' THEN required_permission IN (
      'overview',
      'analytics',
      'hosts',
      'guests'
    )
    ELSE FALSE
  END;
$$;

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

  INSERT INTO public.profiles (
    id,
    full_name,
    is_admin,
    admin_role
  )
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

CREATE OR REPLACE FUNCTION public.grant_admin_by_email(target_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.current_user_admin_role() <> 'owner' THEN
    RAISE EXCEPTION 'Only owner admins can grant admin access';
  END IF;

  RETURN QUERY
  SELECT role_result.user_id, role_result.email, role_result.full_name
  FROM public.set_admin_role_by_email(target_email, 'operations') AS role_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  admin_role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.current_user_has_admin_permission('overview') THEN
    RAISE EXCEPTION 'Only admins can list admins';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id,
    users.email,
    profiles.full_name,
    profiles.admin_role,
    users.created_at,
    users.last_sign_in_at
  FROM public.profiles AS profiles
  LEFT JOIN auth.users AS users
    ON users.id = profiles.id
  WHERE profiles.is_admin = TRUE
  ORDER BY
    CASE profiles.admin_role
      WHEN 'owner' THEN 1
      WHEN 'operations' THEN 2
      WHEN 'support' THEN 3
      WHEN 'content' THEN 4
      WHEN 'analyst' THEN 5
      ELSE 9
    END,
    lower(users.email);
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

REVOKE ALL ON FUNCTION public.current_user_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_admin_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_platform_people() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_admin_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_platform_people() TO authenticated;
