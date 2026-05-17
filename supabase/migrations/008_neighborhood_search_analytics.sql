-- Track neighbourhood searches and expose the most searched locations.

CREATE TABLE IF NOT EXISTS public.neighborhood_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood text NOT NULL,
  source text NOT NULL DEFAULT 'search',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS neighborhood_searches_created_at_idx
  ON public.neighborhood_searches (created_at DESC);

CREATE INDEX IF NOT EXISTS neighborhood_searches_neighborhood_idx
  ON public.neighborhood_searches (lower(neighborhood));

ALTER TABLE public.neighborhood_searches ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_neighborhood_search(
  searched_neighborhood text,
  search_source text DEFAULT 'search'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_neighborhood text := trim(searched_neighborhood);
  cleaned_source text := trim(COALESCE(search_source, 'search'));
BEGIN
  IF cleaned_neighborhood = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.neighborhood_searches (
    neighborhood,
    source
  )
  VALUES (
    cleaned_neighborhood,
    CASE
      WHEN cleaned_source = '' THEN 'search'
      ELSE left(cleaned_source, 40)
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.popular_neighborhoods(
  result_limit integer DEFAULT 6,
  lookback_days integer DEFAULT 30
)
RETURNS TABLE (
  neighborhood text,
  search_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    neighborhood_searches.neighborhood,
    count(*) AS search_count
  FROM public.neighborhood_searches
  WHERE created_at >= now() - make_interval(days => greatest(lookback_days, 1))
  GROUP BY neighborhood_searches.neighborhood
  ORDER BY count(*) DESC, min(created_at) DESC, lower(neighborhood_searches.neighborhood)
  LIMIT greatest(result_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.record_neighborhood_search(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.popular_neighborhoods(integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_neighborhood_search(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.popular_neighborhoods(integer, integer) TO anon, authenticated;
