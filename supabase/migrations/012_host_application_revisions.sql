-- Allow hosts to revise their own submitted applications after changes are requested.

CREATE OR REPLACE FUNCTION public.update_current_host_application(
  application_uuid uuid,
  new_title text,
  new_area text,
  new_exact_address text,
  new_latitude double precision,
  new_longitude double precision,
  new_bedrooms integer,
  new_bathrooms numeric,
  new_sleeps integer,
  new_price_ils integer,
  new_price_usd integer,
  new_amenities text[],
  new_description text
)
RETURNS public.host_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_application public.host_applications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.host_applications
  SET apartment_title = trim(new_title),
      area = trim(new_area),
      exact_address = trim(new_exact_address),
      latitude = new_latitude,
      longitude = new_longitude,
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      sleeps = new_sleeps,
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      amenities = COALESCE(new_amenities, ARRAY[]::text[]),
      description = trim(new_description),
      status = 'in_review',
      admin_feedback = NULL,
      changes_requested_at = NULL
  WHERE id = application_uuid
    AND host_id = auth.uid()
    AND status IN ('new', 'in_review', 'changes_requested', 'rejected')
  RETURNING * INTO updated_application;

  IF updated_application.id IS NULL THEN
    RAISE EXCEPTION 'Application not found or cannot be edited';
  END IF;

  RETURN updated_application;
END;
$$;

REVOKE ALL ON FUNCTION public.update_current_host_application(
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  numeric,
  integer,
  integer,
  integer,
  text[],
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_current_host_application(
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  numeric,
  integer,
  integer,
  integer,
  text[],
  text
) TO authenticated;
