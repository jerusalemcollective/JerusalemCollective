-- Track listing popularity signals for future featured-stay ranking.

CREATE TABLE IF NOT EXISTS public.listing_engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('view', 'save', 'enquiry', 'booking_request')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_engagement_events_listing_idx
  ON public.listing_engagement_events (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_engagement_events_type_idx
  ON public.listing_engagement_events (event_type, created_at DESC);

ALTER TABLE public.listing_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_listing_engagement(
  target_listing_id uuid,
  engagement_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF engagement_type NOT IN ('view', 'save', 'enquiry', 'booking_request') THEN
    RAISE EXCEPTION 'Invalid engagement type';
  END IF;

  INSERT INTO public.listing_engagement_events (
    listing_id,
    user_id,
    event_type
  )
  VALUES (
    target_listing_id,
    auth.uid(),
    engagement_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_popularity_summary(
  result_limit integer DEFAULT 20,
  lookback_days integer DEFAULT 30
)
RETURNS TABLE (
  listing_id uuid,
  views bigint,
  saves bigint,
  enquiries bigint,
  booking_requests bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    events.listing_id,
    count(*) FILTER (WHERE events.event_type = 'view') AS views,
    count(*) FILTER (WHERE events.event_type = 'save') AS saves,
    count(*) FILTER (WHERE events.event_type = 'enquiry') AS enquiries,
    count(*) FILTER (WHERE events.event_type = 'booking_request') AS booking_requests
  FROM public.listing_engagement_events AS events
  WHERE events.created_at >= now() - make_interval(days => greatest(lookback_days, 1))
  GROUP BY events.listing_id
  ORDER BY
    count(*) FILTER (WHERE events.event_type = 'booking_request') DESC,
    count(*) FILTER (WHERE events.event_type = 'enquiry') DESC,
    count(*) FILTER (WHERE events.event_type = 'save') DESC,
    count(*) FILTER (WHERE events.event_type = 'view') DESC
  LIMIT greatest(result_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.record_listing_engagement(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listing_popularity_summary(integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_listing_engagement(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listing_popularity_summary(integer, integer) TO authenticated;
