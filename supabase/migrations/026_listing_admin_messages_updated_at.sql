-- Repair listing admin messages for projects that already created the table
-- before updated_at was added.

ALTER TABLE public.listing_admin_messages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
