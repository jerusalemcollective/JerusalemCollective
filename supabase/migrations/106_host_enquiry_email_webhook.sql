-- 106_host_enquiry_email_webhook.sql
--
-- Send the host's "new enquiry" email server-side, fired by the database on
-- every booking_requests INSERT, instead of relying on the guest's browser to
-- POST /api/notify-host-enquiry (which 403s whenever the calling session isn't
-- the enquiry's guest, silently dropping the email).
--
-- The trigger calls our Vercel webhook (app/api/webhooks/notify-host-enquiry),
-- which sends the email with the service role — no user session, so it can't
-- mismatch. Authenticated by the x-webhook-secret header, which must equal the
-- SUPABASE_WEBHOOK_SECRET env var set in Vercel.
--
-- IMPORTANT: before running, replace the secret below with the SAME value you
-- put in Vercel's SUPABASE_WEBHOOK_SECRET, and confirm the URL matches your live
-- domain.

create extension if not exists pg_net;

create or replace function public.notify_host_enquiry_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
begin
  begin
    perform net.http_post(
      url := 'https://www.jlmcollective.co/api/webhooks/notify-host-enquiry',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', 'f1df955f70506654ca729d89ffe6667b88aaebbecd99e101968a9e949aabf1cc'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'booking_requests',
        'record', to_jsonb(new)
      )
    );
  exception when others then
    -- Never let a webhook hiccup block creating the enquiry itself.
    raise warning 'notify_host_enquiry_webhook failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists notify_host_enquiry_webhook on public.booking_requests;

create trigger notify_host_enquiry_webhook
after insert on public.booking_requests
for each row
execute function public.notify_host_enquiry_webhook();
