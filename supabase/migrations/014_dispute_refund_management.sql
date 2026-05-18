-- Operational dispute and refund workflow.
-- This is intentionally payment-provider agnostic so it works before live checkout is enabled.

CREATE TABLE IF NOT EXISTS public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_id uuid REFERENCES public.hosts(id) ON DELETE SET NULL,
  case_type text NOT NULL CHECK (case_type IN ('dispute', 'refund_request', 'damage', 'cancellation', 'other')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'waiting_on_guest', 'waiting_on_host', 'resolved', 'closed')),
  reason text NOT NULL,
  details text,
  requested_amount numeric(10,2),
  approved_refund_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text,
  resolution_notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS support_cases_status_idx
  ON public.support_cases (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_cases_booking_idx
  ON public.support_cases (booking_id);

CREATE INDEX IF NOT EXISTS support_cases_guest_idx
  ON public.support_cases (guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_cases_host_idx
  ON public.support_cases (host_id, created_at DESC);

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests can view own support cases" ON public.support_cases;
DROP POLICY IF EXISTS "Guests can create own support cases" ON public.support_cases;
DROP POLICY IF EXISTS "Hosts can view related support cases" ON public.support_cases;
DROP POLICY IF EXISTS "Admins can manage support cases" ON public.support_cases;

CREATE POLICY "Guests can view own support cases"
ON public.support_cases
FOR SELECT
TO authenticated
USING (guest_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Guests can create own support cases"
ON public.support_cases
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (guest_id IS NULL OR guest_id = auth.uid())
);

CREATE POLICY "Hosts can view related support cases"
ON public.support_cases
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Admins can manage support cases"
ON public.support_cases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

DROP TRIGGER IF EXISTS update_support_cases_updated_at ON public.support_cases;
CREATE TRIGGER update_support_cases_updated_at
  BEFORE UPDATE ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
