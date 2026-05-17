-- Prevent incomplete listing applications from being submitted.

ALTER TABLE public.host_applications
  DROP CONSTRAINT IF EXISTS host_applications_main_data_check;

ALTER TABLE public.host_applications
  ADD CONSTRAINT host_applications_main_data_check
  CHECK (
    NULLIF(trim(apartment_title), '') IS NOT NULL
    AND NULLIF(trim(area), '') IS NOT NULL
    AND NULLIF(trim(exact_address), '') IS NOT NULL
    AND bedrooms IS NOT NULL
    AND bedrooms >= 0
    AND bathrooms IS NOT NULL
    AND bathrooms >= 0
    AND sleeps IS NOT NULL
    AND sleeps >= 1
    AND (
      (price_ils IS NOT NULL AND price_ils > 0)
      OR (price_usd IS NOT NULL AND price_usd > 0)
    )
    AND COALESCE(array_length(amenities, 1), 0) >= 1
    AND NULLIF(trim(description), '') IS NOT NULL
  );

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz;

ALTER TABLE public.host_applications
  DROP CONSTRAINT IF EXISTS host_applications_status_check;

ALTER TABLE public.host_applications
  ADD CONSTRAINT host_applications_status_check
  CHECK (status IN ('new', 'in_review', 'changes_requested', 'approved', 'rejected'));
