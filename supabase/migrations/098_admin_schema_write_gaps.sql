-- Readiness audit: list every column an INSERT must provide on the app's write
-- tables — i.e. NOT NULL, no default, not a primary key, not identity/generated.
--
-- This targets the recurring bug class where a NOT NULL column is added in the
-- Supabase UI (with no default) but the app code never populates it, so inserts
-- fail at runtime for a guest/host. SQL can't know what the code sets, so this
-- is a review aid, not a pass/fail: the admin readiness page lists these so a
-- newly added mandatory column is easy to spot. Gated on current_user_is_admin.

create or replace function public.admin_schema_write_gaps()
returns table (table_name text, column_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin permission required';
  end if;

  return query
  select c.table_name::text, c.column_name::text
  from information_schema.columns c
  join (values
    ('host_applications'), ('listings'), ('listing_photos'), ('bookings'),
    ('booking_requests'), ('booking_payments'), ('reviews'),
    ('listing_unavailable_ranges'), ('conversations'), ('messages'),
    ('saved_listings'), ('profiles'), ('hosts'), ('host_payment_profiles'),
    ('listing_admin_messages')
  ) as t(name) on t.name = c.table_name
  where c.table_schema = 'public'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and c.is_identity = 'NO'
    and c.is_generated = 'NEVER'
    -- Primary keys are always required and are never the surprise column.
    and not exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
        and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public'
        and tc.table_name = c.table_name
        and tc.constraint_type = 'PRIMARY KEY'
        and kcu.column_name = c.column_name
    )
  order by c.table_name, c.ordinal_position;
end;
$$;

revoke all on function public.admin_schema_write_gaps() from public;
grant execute on function public.admin_schema_write_gaps() to authenticated;
