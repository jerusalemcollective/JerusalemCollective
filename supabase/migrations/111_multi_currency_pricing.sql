-- 111_multi_currency_pricing.sql
--
-- Phase 1 of multi-currency pricing: a host prices in ONE currency of their
-- choice (ILS, USD, GBP, EUR, CAD, CHF, AUD) with a single price, instead of the
-- old two fixed columns. `price` + `price_currency` become the source of truth.
--
-- The legacy price_ils / price_usd (and extra_guest_fee_ils/usd) columns are kept
-- and are populated by the app via FX at save time, so the existing booking,
-- deposit, display, and search code keeps working unchanged during this phase.
-- Charging online in non-USD/ILS currencies (Stripe) is a later phase.

alter table public.listings
  add column if not exists price numeric,
  add column if not exists price_currency text,
  add column if not exists extra_guest_fee numeric;

alter table public.host_applications
  add column if not exists price numeric,
  add column if not exists price_currency text,
  add column if not exists extra_guest_fee numeric;

-- Backfill existing rows from the legacy columns. Prefer USD as the stored
-- currency when it's set, otherwise ILS.
update public.listings
set price = coalesce(price_usd, price_ils),
    price_currency = case
      when price_usd is not null then 'USD'
      when price_ils is not null then 'ILS'
    end
where price is null and (price_usd is not null or price_ils is not null);

update public.listings
set extra_guest_fee = coalesce(extra_guest_fee_usd, extra_guest_fee_ils)
where extra_guest_fee is null
  and (extra_guest_fee_usd is not null or extra_guest_fee_ils is not null);

update public.host_applications
set price = coalesce(price_usd, price_ils),
    price_currency = case
      when price_usd is not null then 'USD'
      when price_ils is not null then 'ILS'
    end
where price is null and (price_usd is not null or price_ils is not null);

-- Constrain price_currency to the supported host set.
alter table public.listings drop constraint if exists listings_price_currency_check;
alter table public.listings
  add constraint listings_price_currency_check
  check (price_currency is null or price_currency in ('ILS','USD','GBP','EUR','CAD','CHF','AUD'));

alter table public.host_applications drop constraint if exists host_applications_price_currency_check;
alter table public.host_applications
  add constraint host_applications_price_currency_check
  check (price_currency is null or price_currency in ('ILS','USD','GBP','EUR','CAD','CHF','AUD'));
