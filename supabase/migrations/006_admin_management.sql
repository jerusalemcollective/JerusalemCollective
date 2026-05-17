-- Admin-only helpers for managing further admins from the dashboard.

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
  );
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
DECLARE
  target_user auth.users%ROWTYPE;
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can grant admin access';
  END IF;

  SELECT *
  INTO target_user
  FROM auth.users
  WHERE lower(auth.users.email) = lower(trim(target_email))
  LIMIT 1;

  IF target_user.id IS NULL THEN
    RAISE EXCEPTION 'No account found for that email';
  END IF;

  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (
    target_user.id,
    COALESCE(
      target_user.raw_user_meta_data ->> 'full_name',
      target_user.raw_user_meta_data ->> 'name',
      split_part(target_user.email, '@', 1),
      'User'
    ),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET is_admin = TRUE;

  RETURN QUERY
  SELECT
    target_user.id,
    target_user.email,
    profiles.full_name
  FROM public.profiles
  WHERE profiles.id = target_user.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_users()
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
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only admins can list admins';
  END IF;

  RETURN QUERY
  SELECT
    profiles.id,
    users.email,
    profiles.full_name
  FROM public.profiles AS profiles
  LEFT JOIN auth.users AS users
    ON users.id = profiles.id
  WHERE profiles.is_admin = TRUE
  ORDER BY lower(users.email);
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_admin_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
