alter table public.hosts
add column if not exists calendar_token text default gen_random_uuid()::text;

update public.hosts
set calendar_token = gen_random_uuid()::text
where calendar_token is null;

create unique index if not exists hosts_calendar_token_unique_idx
  on public.hosts (calendar_token)
  where calendar_token is not null;
