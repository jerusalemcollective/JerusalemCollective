-- 110_support_case_responses.sql
--
-- Let the OTHER party add their side to a report before JLM resolves it (the
-- Airbnb "give the counterparty a chance to respond" step). A guest-filed report
-- can be answered by the host, and vice versa.
--
-- Columns hold each side's free-text response + when it was added. Writes go
-- through a SECURITY DEFINER RPC that routes the text to the caller's column
-- (guest vs host), so no broad UPDATE policy is needed.

alter table public.support_cases
  add column if not exists guest_response text,
  add column if not exists host_response text,
  add column if not exists guest_responded_at timestamptz,
  add column if not exists host_responded_at timestamptz;

create or replace function public.add_support_case_response(
  target_case_id uuid,
  response_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  c_guest uuid;
  c_host_id uuid;
  clean text := nullif(trim(coalesce(response_text, '')), '');
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;
  if clean is null then
    raise exception 'A response is required';
  end if;

  select guest_id, host_id into c_guest, c_host_id
  from public.support_cases
  where id = target_case_id;

  if c_guest is null and c_host_id is null then
    raise exception 'Report not found';
  end if;

  if caller = c_guest then
    update public.support_cases
    set guest_response = clean, guest_responded_at = now()
    where id = target_case_id;
  elsif exists (
    select 1 from public.hosts h
    where h.id = c_host_id and (h.id = caller or h.user_id = caller)
  ) then
    update public.support_cases
    set host_response = clean, host_responded_at = now()
    where id = target_case_id;
  else
    raise exception 'Not authorized for this report';
  end if;
end;
$$;

revoke all on function public.add_support_case_response(uuid, text) from public;
grant execute on function public.add_support_case_response(uuid, text) to authenticated;
