-- Host-managed unavailable date ranges for live listings.

CREATE TABLE IF NOT EXISTS public.listing_unavailable_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_unavailable_ranges_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS listing_unavailable_ranges_listing_idx
  ON public.listing_unavailable_ranges (listing_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS listing_unavailable_ranges_host_idx
  ON public.listing_unavailable_ranges (host_id, start_date, end_date);

ALTER TABLE public.listing_unavailable_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own unavailable ranges" ON public.listing_unavailable_ranges;
DROP POLICY IF EXISTS "Hosts can insert own unavailable ranges" ON public.listing_unavailable_ranges;
DROP POLICY IF EXISTS "Hosts can delete own unavailable ranges" ON public.listing_unavailable_ranges;

CREATE POLICY "Hosts can view own unavailable ranges"
ON public.listing_unavailable_ranges
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

DROP POLICY IF EXISTS "Public can view unavailable ranges for published listings" ON public.listing_unavailable_ranges;

CREATE POLICY "Public can view unavailable ranges for published listings"
ON public.listing_unavailable_ranges
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.listings
    WHERE listings.id = listing_unavailable_ranges.listing_id
      AND listings.is_published = true
  )
);

CREATE POLICY "Hosts can insert own unavailable ranges"
ON public.listing_unavailable_ranges
FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.listings
    WHERE listings.id = listing_unavailable_ranges.listing_id
      AND listings.host_id = auth.uid()
  )
);

CREATE POLICY "Hosts can delete own unavailable ranges"
ON public.listing_unavailable_ranges
FOR DELETE
TO authenticated
USING (host_id = auth.uid());

DROP TRIGGER IF EXISTS update_listing_unavailable_ranges_updated_at ON public.listing_unavailable_ranges;
CREATE TRIGGER update_listing_unavailable_ranges_updated_at
  BEFORE UPDATE ON public.listing_unavailable_ranges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
