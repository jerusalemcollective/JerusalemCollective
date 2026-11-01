-- 121_drop_listings_exact_address.sql
--
-- RUN ONLY AFTER:
--   (a) 120_protect_exact_address.sql has been run, AND
--   (b) the code that reads/writes listing_private_details is deployed and
--       live (the commit that added lib/listing-private-details.ts).
--
-- Running it earlier breaks the still-deployed old code: the admin listing
-- editor, host application approval and calendar feeds select or write
-- listings.exact_address and would error with "column does not exist".
--
-- This step is optional tidying. After 120 the column is always NULL and the
-- trigger keeps it that way, so nothing is exposed while it waits.

begin;

-- Abort if anything is still stored on listings (120 not run, or bypassed).
do $$
begin
  if to_regclass('public.listing_private_details') is null then
    raise exception 'Run 120_protect_exact_address.sql first.';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'exact_address'
  ) then
    if exists (select 1 from public.listings where exact_address is not null) then
      raise exception 'listings.exact_address still has values; run 120_protect_exact_address.sql first.';
    end if;
  end if;
end;
$$;

drop trigger if exists listings_move_exact_address_private on public.listings;
drop function if exists public.listings_move_exact_address_private();

alter table public.listings drop column if exists exact_address;

commit;
