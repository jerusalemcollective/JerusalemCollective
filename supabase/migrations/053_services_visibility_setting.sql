insert into public.platform_settings (key, value, description)
values (
  'services_bar_enabled',
  'true',
  'Controls whether Services links and service promotion sections are visible on the public website.'
)
on conflict (key) do nothing;

drop policy if exists "Public can read services visibility setting" on public.platform_settings;
create policy "Public can read services visibility setting"
on public.platform_settings
for select
to anon, authenticated
using (key = 'services_bar_enabled');
