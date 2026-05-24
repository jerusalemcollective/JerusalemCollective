alter table public.messages
add column if not exists read_at
  timestamptz;

comment on column
  public.messages.read_at is
  'Set when the recipient first
   views this message.
   Null means unread.';

create index if not exists
  messages_read_at_idx
  on public.messages (read_at)
  where read_at is null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'messages'
    and policyname =
      'Recipients can mark messages as read'
  ) then
    execute $policy$
      create policy
        "Recipients can mark messages as read"
        on public.messages
        for update
        to authenticated
        using (
          sender_id != auth.uid()
          and exists (
            select 1
            from public.conversations
            where conversations.id =
              messages.conversation_id
            and (
              conversations.participant_1 =
                auth.uid()
              or conversations.participant_2 =
                auth.uid()
            )
          )
        )
        with check (true)
    $policy$;
  end if;
end $$;
