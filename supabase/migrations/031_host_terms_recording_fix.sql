alter table public.hosts
add column if not exists host_terms_accepted_at timestamptz,
add column if not exists host_terms_version text;

alter table public.host_applications
add column if not exists host_terms_accepted_at timestamptz,
add column if not exists host_terms_version text;

create or replace function public.accept_current_host_terms_for_host(
  accepted_version text,
  target_host_id uuid
)
returns public.hosts
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_host public.hosts%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if target_host_id is null then
    raise exception 'Host profile is required';
  end if;

  if trim(coalesce(accepted_version, '')) = '' then
    raise exception 'Terms version is required';
  end if;

  update public.hosts
  set host_terms_accepted_at = now(),
      host_terms_version = accepted_version,
      updated_at = now()
  where id = target_host_id
    and (
      id = current_user_id
      or user_id = current_user_id
    )
  returning * into updated_host;

  if updated_host.id is null then
    raise exception 'Host profile not found';
  end if;

  return updated_host;
end;
$$;

revoke all on function public.accept_current_host_terms_for_host(text, uuid) from public;
grant execute on function public.accept_current_host_terms_for_host(text, uuid) to authenticated;

create or replace function public.require_host_terms_before_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.hosts
    where hosts.id = new.host_id
      and hosts.host_terms_accepted_at is not null
  ) then
    raise exception 'Host terms must be accepted before submitting a stay';
  end if;

  if new.host_terms_accepted_at is null then
    select hosts.host_terms_accepted_at, hosts.host_terms_version
    into new.host_terms_accepted_at, new.host_terms_version
    from public.hosts
    where hosts.id = new.host_id;
  end if;

  return new;
end;
$$;
