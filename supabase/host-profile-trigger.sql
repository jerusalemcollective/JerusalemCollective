create table if not exists public.hosts (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  display_name text,
  email text,
  host_type text not null default 'owner',
  show_full_name boolean not null default false,
  is_verified boolean not null default false,
  profile_photo_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hosts enable row level security;

drop policy if exists "Hosts are publicly readable" on public.hosts;
drop policy if exists "Hosts can create their own profile" on public.hosts;
drop policy if exists "Hosts can update their own profile" on public.hosts;

create policy "Hosts are publicly readable"
on public.hosts
for select
using (true);

create policy "Hosts can create their own profile"
on public.hosts
for insert
to authenticated
with check (auth.uid() = id);

create policy "Hosts can update their own profile"
on public.hosts
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.create_host_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  full_name text;
begin
  full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'Host'
  );

  insert into public.hosts (
    id,
    name,
    display_name,
    email,
    host_type,
    show_full_name,
    is_verified
  )
  values (
    new.id,
    full_name,
    split_part(full_name, ' ', 1),
    new.email,
    'owner',
    false,
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.hosts.name, excluded.name),
        display_name = coalesce(public.hosts.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_host_profile on auth.users;

create trigger on_auth_user_created_create_host_profile
after insert on auth.users
for each row execute function public.create_host_profile_for_new_user();

insert into public.hosts (
  id,
  name,
  display_name,
  email,
  host_type,
  show_full_name,
  is_verified
)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    split_part(users.email, '@', 1),
    'Host'
  ) as name,
  split_part(
    coalesce(
      users.raw_user_meta_data ->> 'full_name',
      users.raw_user_meta_data ->> 'name',
      split_part(users.email, '@', 1),
      'Host'
    ),
    ' ',
    1
  ) as display_name,
  users.email,
  'owner',
  false,
  false
from auth.users
on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.hosts.name, excluded.name),
      display_name = coalesce(public.hosts.display_name, excluded.display_name);
