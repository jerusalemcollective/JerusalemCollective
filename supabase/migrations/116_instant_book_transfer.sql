-- 116_instant_book_transfer.sql
--
-- Instant book + bank transfer. Booking style (instant / request) and payment
-- method (JLM card / transfer to the host) are independent host choices. Until
-- now instant book only worked through JLM card checkout (/api/book-now ->
-- Stripe -> finalize_instant_booking). This adds the instant + transfer path.
--
-- instant_book_listing() is called by the signed-in guest (/api/instant-book).
-- It writes EXACTLY what a host accepting a request writes
-- (update_booking_request_status, migration 100), in one transaction:
--   * a booking_requests row with status 'accepted', linked to the guest/host
--     conversation (reused or created, same identity rule as
--     create_listing_enquiry);
--   * a confirmed bookings row, priced the same way the accept flow prices it
--     (nightly listing price x nights, per currency, host commission rate),
--     payment_status 'unpaid' = paid off-platform, directly to the host. No
--     booking_payments row, exactly like an accepted request;
--   * a 'booking' listing_unavailable_ranges row blocking the dates.
-- Plus one guest message in the thread so the host sees what happened.
--
-- Safety:
--   * Concurrency: a per-listing transaction advisory lock serialises instant
--     books on the same listing, and the existing exclusion constraints
--     (bookings_no_overlap_confirmed, listing_unavailable_no_overlap, 067/099)
--     remain the hard guarantee against any other path (host accept, manual
--     block, calendar import). A constraint hit is turned into a friendly error.
--   * Idempotency: a repeat call for the same guest + listing + dates that has
--     already produced a confirmed booking returns that booking
--     (already_booked = true) instead of failing or double-writing. Relies on
--     booking_requests_no_dupe_idx (065).
--   * The host's "new enquiry" webhook (106) fires on every booking_requests
--     INSERT; host_notified_at is set on insert so it skips, and the API route
--     sends a "New booking" email instead.
--
-- Safe to re-run (create or replace).

create or replace function public.instant_book_listing(
  target_listing_id uuid,
  check_in_date date,
  check_out_date date,
  guest_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  listing_record public.listings%rowtype;
  profile_record public.host_payment_profiles%rowtype;
  host_account_id uuid;
  listing_currency text;
  card_route_live boolean;
  booking_nights integer;
  guests_clean integer := coalesce(guest_count, 1);
  existing_request public.booking_requests%rowtype;
  existing_booking public.bookings%rowtype;
  request_record public.booking_requests%rowtype;
  booking_record public.bookings%rowtype;
  conversation_uuid uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if target_listing_id is null then
    raise exception 'Listing is required';
  end if;

  if check_in_date is null or check_out_date is null then
    raise exception 'Choose check-in and check-out dates';
  end if;

  if check_out_date <= check_in_date then
    raise exception 'Check-out must be after check-in';
  end if;

  -- current_date is UTC; Israel is ahead of UTC, so this never rejects a
  -- check-in that is "today" for the guest.
  if check_in_date < current_date then
    raise exception 'Check-in date is in the past';
  end if;

  if guests_clean < 1 then
    raise exception 'Guest count must be at least 1';
  end if;

  booking_nights := check_out_date - check_in_date;

  -- Serialise instant books on this listing for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtext('instant_book_listing:' || target_listing_id::text));

  select *
  into listing_record
  from public.listings
  where id = target_listing_id;

  if listing_record.id is null or not coalesce(listing_record.is_published, false) then
    raise exception 'Listing not available';
  end if;

  if coalesce(listing_record.booking_type, '') <> 'instant' then
    raise exception 'This stay does not offer instant booking';
  end if;

  if listing_record.host_id is null then
    raise exception 'Host not available';
  end if;

  -- Online card payment counts as "enabled" only when it would actually be
  -- offered on the listing page (app/listings/[id]/page.tsx): platform switch on,
  -- listing opted in, host accepts JLM payment in the listing currency. When it
  -- is live, the guest must use the card checkout (/api/book-now) instead.
  select *
  into profile_record
  from public.host_payment_profiles
  where host_id = listing_record.host_id;

  listing_currency := case
    when listing_record.price_usd is not null then 'USD'
    when listing_record.price_ils is not null then 'ILS'
  end;

  card_route_live :=
    coalesce(listing_record.online_payment_enabled, false)
    and exists (
      select 1 from public.platform_settings
      where key = 'jlm_payments_enabled' and value <> 'false'
    )
    and coalesce(profile_record.accepts_jlm_payment, false)
    and listing_currency is not null
    and listing_currency = any(coalesce(profile_record.payout_currencies, array[]::text[]));

  if card_route_live then
    raise exception 'This stay is booked with online card payment';
  end if;

  if listing_currency is null then
    raise exception 'This stay does not have a price yet';
  end if;

  if booking_nights < greatest(coalesce(listing_record.min_nights, 1), 1) then
    raise exception 'Minimum stay is % nights', greatest(coalesce(listing_record.min_nights, 1), 1);
  end if;

  if listing_record.max_guests is not null and guests_clean > listing_record.max_guests then
    raise exception 'This stay sleeps up to % guests', listing_record.max_guests;
  end if;

  select coalesce(hosts.user_id, hosts.id)
  into host_account_id
  from public.hosts
  where hosts.id = listing_record.host_id
  limit 1;

  host_account_id := coalesce(host_account_id, listing_record.host_id);

  if host_account_id = current_user_id then
    raise exception 'You cannot book your own listing';
  end if;

  -- Idempotency / reuse: the guest may already have a request for these exact
  -- dates (a double click, or an earlier enquiry). At most one exists (065).
  select *
  into existing_request
  from public.booking_requests
  where guest_id = current_user_id
    and listing_id = target_listing_id
    and check_in = check_in_date
    and check_out = check_out_date
  order by created_at asc
  limit 1
  for update;

  if existing_request.id is not null then
    if existing_request.status = 'accepted' and existing_request.booking_id is not null then
      select * into existing_booking from public.bookings where id = existing_request.booking_id;
      if existing_booking.id is not null and existing_booking.status = 'confirmed' then
        return jsonb_build_object(
          'booking_id', existing_booking.id,
          'request_id', existing_request.id,
          'conversation_id', existing_request.conversation_id,
          'nights', booking_nights,
          'guests', existing_booking.guests,
          'currency', listing_currency,
          'total_amount_usd', existing_booking.total_amount_usd,
          'total_amount_ils', existing_booking.total_amount_ils,
          'already_booked', true
        );
      end if;
    end if;

    if existing_request.status = 'declined' then
      raise exception 'The host declined these dates';
    end if;
  end if;

  -- Availability. Ranges are half-open: check-out day = next check-in is fine.
  -- 1) any calendar hold (bookings, manual blocks, imported calendars).
  if exists (
    select 1
    from public.listing_unavailable_ranges r
    where r.listing_id = target_listing_id
      and r.start_date < check_out_date
      and r.end_date > check_in_date
  ) then
    raise exception 'Those dates are no longer available';
  end if;

  -- 2) any live booking (in case its calendar row is missing).
  if exists (
    select 1
    from public.bookings b
    where b.listing_id = target_listing_id
      and b.status in ('pending', 'confirmed')
      and b.check_in < check_out_date
      and b.check_out > check_in_date
  ) then
    raise exception 'Those dates are no longer available';
  end if;

  -- 3) an accepted request with no booking behind it (a linked booking is
  --    already covered by 2, and a cancelled one must not block the dates).
  if exists (
    select 1
    from public.booking_requests br
    where br.listing_id = target_listing_id
      and br.status = 'accepted'
      and br.booking_id is null
      and br.id is distinct from existing_request.id
      and br.check_in < check_out_date
      and br.check_out > check_in_date
  ) then
    raise exception 'Those dates are no longer available';
  end if;

  begin
    -- Conversation: reuse the request's thread, else the unique
    -- (guest, host account, listing) thread, creating it if needed.
    conversation_uuid := existing_request.conversation_id;

    if conversation_uuid is null then
      insert into public.conversations (participant_1, participant_2, listing_id)
      values (current_user_id, host_account_id, target_listing_id)
      on conflict (participant_1, participant_2, listing_id)
      do update set updated_at = now()
      returning id into conversation_uuid;
    end if;

    insert into public.messages (conversation_id, sender_id, content)
    values (
      conversation_uuid,
      current_user_id,
      'Booked instantly: ' || check_in_date::text || ' to ' || check_out_date::text
        || E'\nGuests: ' || guests_clean::text
        || E'\nPayment: directly to the host by bank transfer.'
    );

    update public.conversations
    set updated_at = now()
    where id = conversation_uuid;

    -- Booking: same columns and pricing as update_booking_request_status (100).
    insert into public.bookings (
      user_id,
      listing_id,
      host_id,
      check_in,
      check_out,
      guests,
      total_amount_usd,
      total_amount_ils,
      commission_percent,
      status,
      payment_status
    )
    values (
      current_user_id,
      target_listing_id,
      listing_record.host_id,
      check_in_date,
      check_out_date,
      guests_clean,
      case when listing_record.price_usd is not null then round(listing_record.price_usd * booking_nights)::integer else null end,
      case when listing_record.price_ils is not null then round(listing_record.price_ils * booking_nights)::integer else null end,
      public.current_host_commission_percent(listing_record.host_id),
      'confirmed',
      'unpaid'
    )
    returning * into booking_record;

    if existing_request.id is not null then
      update public.booking_requests
      set status = 'accepted',
          guests = guests_clean,
          conversation_id = conversation_uuid,
          booking_id = booking_record.id,
          host_notified_at = coalesce(host_notified_at, now()),
          updated_at = now()
      where id = existing_request.id
      returning * into request_record;
    else
      insert into public.booking_requests (
        listing_id,
        host_id,
        guest_id,
        conversation_id,
        check_in,
        check_out,
        guests,
        message,
        status,
        booking_id,
        host_notified_at
      )
      values (
        target_listing_id,
        listing_record.host_id,
        current_user_id,
        conversation_uuid,
        check_in_date,
        check_out_date,
        guests_clean,
        null,
        'accepted',
        booking_record.id,
        now()
      )
      returning * into request_record;
    end if;

    insert into public.listing_unavailable_ranges (
      listing_id,
      host_id,
      start_date,
      end_date,
      reason,
      source
    )
    values (
      target_listing_id,
      listing_record.host_id,
      check_in_date,
      check_out_date,
      'Booking confirmed',
      'booking'
    );
  exception
    when exclusion_violation then
      -- Another path (host accept, manual block, calendar sync) took an
      -- overlapping hold between our checks and our insert.
      raise exception 'Those dates are no longer available';
    when unique_violation then
      -- A concurrent call for the same guest + dates won the request insert.
      raise exception 'This booking is already being processed';
  end;

  return jsonb_build_object(
    'booking_id', booking_record.id,
    'request_id', request_record.id,
    'conversation_id', conversation_uuid,
    'nights', booking_nights,
    'guests', guests_clean,
    'currency', listing_currency,
    'total_amount_usd', booking_record.total_amount_usd,
    'total_amount_ils', booking_record.total_amount_ils,
    'already_booked', false
  );
end;
$$;

revoke all on function public.instant_book_listing(uuid, date, date, integer) from public;
revoke all on function public.instant_book_listing(uuid, date, date, integer) from anon;
grant execute on function public.instant_book_listing(uuid, date, date, integer) to authenticated;
