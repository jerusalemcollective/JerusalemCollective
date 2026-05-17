-- Ensure every live listing can be tied back to a host.

ALTER TABLE IF EXISTS public.listings
  ADD COLUMN IF NOT EXISTS host_id UUID;

ALTER TABLE IF EXISTS public.host_applications
  ADD COLUMN IF NOT EXISTS host_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'listings'
  ) THEN
    ALTER TABLE public.listings
      DROP CONSTRAINT IF EXISTS listings_host_id_fkey;

    ALTER TABLE public.listings
      ADD CONSTRAINT listings_host_id_fkey
      FOREIGN KEY (host_id)
      REFERENCES public.hosts(id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'host_applications'
  ) THEN
    ALTER TABLE public.host_applications
      DROP CONSTRAINT IF EXISTS host_applications_host_id_fkey;

    ALTER TABLE public.host_applications
      ADD CONSTRAINT host_applications_host_id_fkey
      FOREIGN KEY (host_id)
      REFERENCES public.hosts(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'listings'
  ) THEN
    CREATE INDEX IF NOT EXISTS listings_host_id_idx
      ON public.listings (host_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'host_applications'
  ) THEN
    CREATE INDEX IF NOT EXISTS host_applications_host_id_idx
      ON public.host_applications (host_id);
  END IF;
END $$;

-- Optional one-time backfill helper:
-- update public.listings l
-- set host_id = h.id
-- from public.hosts h
-- where l.host_id is null
--   and l.host_email = h.email;
--
-- After you have backfilled existing rows, you can enforce:
-- alter table public.listings alter column host_id set not null;
