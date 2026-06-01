create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value, description)
values
  (
    'jlm_payments_enabled',
    'false',
    'Controls whether hosts can enable JLM-collected online payments and whether guests can use Book now.'
  ),
  (
    'direct_payments_enabled',
    'true',
    'Controls whether hosts can offer direct-to-host payment instructions.'
  )
on conflict (key) do nothing;

drop policy if exists "Public can read payment route settings" on public.platform_settings;
create policy "Public can read payment route settings"
on public.platform_settings
for select
to anon, authenticated
using (key in ('jlm_payments_enabled', 'direct_payments_enabled'));
