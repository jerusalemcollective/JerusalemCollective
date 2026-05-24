create table if not exists
  public.listing_shul_distances (
    id uuid primary key
      default gen_random_uuid(),
    listing_id uuid not null
      references public.listings(id)
      on delete cascade,
    shul_name text not null,
    walking_seconds integer not null,
    walking_minutes integer
      generated always as (
        round(walking_seconds::numeric / 60)
      ) stored,
    created_at timestamptz not null
      default now(),
    updated_at timestamptz not null
      default now(),
    unique(listing_id, shul_name)
  );

create index if not exists
  listing_shul_distances_listing_id_idx
  on public.listing_shul_distances
    (listing_id);

alter table
  public.listing_shul_distances
  enable row level security;

create policy
  "Public can read shul distances"
  on public.listing_shul_distances
  for select
  to anon, authenticated
  using (true);

create policy
  "Service role can manage shul distances"
  on public.listing_shul_distances
  for all
  to service_role
  using (true);
