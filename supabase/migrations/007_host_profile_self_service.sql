-- Let signed-in users safely create or recover their own host profile.

CREATE OR REPLACE FUNCTION public.ensure_current_user_host_profile()
RETURNS public.hosts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  account auth.users%ROWTYPE;
  host_record public.hosts%ROWTYPE;
  full_name text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO account
  FROM auth.users
  WHERE id = current_user_id;

  IF account.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  full_name := COALESCE(
    account.raw_user_meta_data ->> 'full_name',
    account.raw_user_meta_data ->> 'name',
    split_part(account.email, '@', 1),
    'Host'
  );

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    is_host
  )
  VALUES (
    account.id,
    full_name,
    account.raw_user_meta_data ->> 'avatar_url',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
      is_host = TRUE;

  SELECT *
  INTO host_record
  FROM public.hosts
  WHERE id = current_user_id
     OR user_id = current_user_id
  ORDER BY CASE WHEN id = current_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF host_record.id IS NULL THEN
    INSERT INTO public.hosts (
      id,
      user_id,
      name,
      display_name,
      email,
      host_type,
      show_full_name,
      is_verified
    )
    VALUES (
      account.id,
      account.id,
      full_name,
      split_part(full_name, ' ', 1),
      account.email,
      'owner',
      FALSE,
      FALSE
    )
    RETURNING * INTO host_record;
  ELSE
    UPDATE public.hosts
    SET user_id = COALESCE(user_id, account.id),
        name = COALESCE(name, full_name),
        display_name = COALESCE(display_name, split_part(full_name, ' ', 1)),
        email = COALESCE(email, account.email)
    WHERE id = host_record.id
    RETURNING * INTO host_record;
  END IF;

  RETURN host_record;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_current_user_host_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_host_profile() TO authenticated;
