-- Require hosts to accept current host terms before submitting their first stay.

ALTER TABLE public.hosts
  ADD COLUMN IF NOT EXISTS host_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS host_terms_version text;

CREATE OR REPLACE FUNCTION public.accept_current_host_terms(
  accepted_version text
)
RETURNS public.hosts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  updated_host public.hosts%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(COALESCE(accepted_version, '')) = '' THEN
    RAISE EXCEPTION 'Terms version is required';
  END IF;

  UPDATE public.hosts
  SET host_terms_accepted_at = COALESCE(host_terms_accepted_at, now()),
      host_terms_version = accepted_version,
      updated_at = now()
  WHERE id = current_user_id
     OR user_id = current_user_id
  RETURNING * INTO updated_host;

  IF updated_host.id IS NULL THEN
    RAISE EXCEPTION 'Host profile not found';
  END IF;

  RETURN updated_host;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_host_terms_before_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = NEW.host_id
      AND hosts.host_terms_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Host terms must be accepted before submitting a stay';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_host_terms_before_application ON public.host_applications;
CREATE TRIGGER require_host_terms_before_application
  BEFORE INSERT ON public.host_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.require_host_terms_before_application();

REVOKE ALL ON FUNCTION public.accept_current_host_terms(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_current_host_terms(text) TO authenticated;
