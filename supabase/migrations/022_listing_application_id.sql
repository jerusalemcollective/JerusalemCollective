-- Link approved listings back to the host application that created them.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.host_applications(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listings_application_id_unique_idx
  ON public.listings (application_id)
  WHERE application_id IS NOT NULL;
