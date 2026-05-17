-- Prevent ordinary users from promoting themselves to admin through profile edits.

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = TRUE
    ) THEN
      RAISE EXCEPTION 'Only admins can change admin access';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_flag ON public.profiles;

CREATE TRIGGER protect_profile_admin_flag
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_admin_escalation();
