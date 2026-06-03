drop policy if exists "Users can view own conversations" on public.conversations;
create policy "Users can view own conversations"
on public.conversations
for select
to authenticated
using (
  auth.uid() = participant_1
  or auth.uid() = participant_2
  or exists (
    select 1
    from public.hosts
    where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
      and hosts.user_id = auth.uid()
  )
);

drop policy if exists "Users can create conversations" on public.conversations;
create policy "Users can create conversations"
on public.conversations
for insert
to authenticated
with check (
  auth.uid() = participant_1
  or auth.uid() = participant_2
  or exists (
    select 1
    from public.hosts
    where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
      and hosts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own conversations" on public.conversations;
create policy "Users can update own conversations"
on public.conversations
for update
to authenticated
using (
  auth.uid() = participant_1
  or auth.uid() = participant_2
  or exists (
    select 1
    from public.hosts
    where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
      and hosts.user_id = auth.uid()
  )
)
with check (
  auth.uid() = participant_1
  or auth.uid() = participant_2
  or exists (
    select 1
    from public.hosts
    where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
      and hosts.user_id = auth.uid()
  )
);

drop policy if exists "Users can view messages in their conversations" on public.messages;
create policy "Users can view messages in their conversations"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and (
        conversations.participant_1 = auth.uid()
        or conversations.participant_2 = auth.uid()
        or exists (
          select 1
          from public.hosts
          where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
            and hosts.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can send messages in their conversations" on public.messages;
create policy "Users can send messages in their conversations"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and (
        conversations.participant_1 = auth.uid()
        or conversations.participant_2 = auth.uid()
        or exists (
          select 1
          from public.hosts
          where (hosts.id = conversations.participant_1 or hosts.id = conversations.participant_2)
            and hosts.user_id = auth.uid()
        )
      )
  )
);
