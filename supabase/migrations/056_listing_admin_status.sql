alter table public.listings
  add column if not exists admin_status text not null default 'needs_work';

alter table public.listings
  drop constraint if exists listings_admin_status_check;

alter table public.listings
  add constraint listings_admin_status_check
  check (admin_status in ('needs_work', 'ready_for_launch', 'live'));

update public.listings
set admin_status = case
  when is_published is true then 'live'
  else 'needs_work'
end
where admin_status is null
   or admin_status not in ('needs_work', 'ready_for_launch', 'live');

create index if not exists listings_admin_status_idx
on public.listings (admin_status);
