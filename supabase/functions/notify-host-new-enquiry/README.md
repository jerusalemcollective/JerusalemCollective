# JLM Collective Email Notification Webhooks

These Edge Functions send marketplace email notifications through Resend.

## Required secrets

In Supabase, open **Edge Functions > Secrets** and add:

- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` set to `https://www.jlmcollective.co`

The sender domain `jlmcollective.co` must be verified in Resend before `no-reply@jlmcollective.co` can send reliably.

## Deploy the functions

Deploy these functions:

- `notify-host-new-enquiry`
- `notify-guest-host-replied`
- `notify-guest-request-decision`
- `notify-guest-case-updated`

## Create database webhooks

In Supabase, open **Database > Webhooks** and create these webhooks.

### 1. Host new enquiry

- Name: `notify-host-new-enquiry`
- Table: `booking_requests`
- Events: `Insert`
- Type: `Supabase Edge Functions`
- Function: `notify-host-new-enquiry`
- HTTP method: `POST`

### 2. Guest host replied

- Name: `notify-guest-host-replied`
- Table: `booking_requests`
- Events: `Update`
- Type: `Supabase Edge Functions`
- Function: `notify-guest-host-replied`
- HTTP method: `POST`

The function only sends when the new status is `host_replied` and the previous status was different.

### 3. Guest request decision

- Name: `notify-guest-request-decision`
- Table: `booking_requests`
- Events: `Update`
- Type: `Supabase Edge Functions`
- Function: `notify-guest-request-decision`
- HTTP method: `POST`

The function only sends when the new status is `accepted` or `declined` and the previous status was different.

### 4. Guest support case updated

- Name: `notify-guest-case-updated`
- Table: `support_cases`
- Events: `Update`
- Type: `Supabase Edge Functions`
- Function: `notify-guest-case-updated`
- HTTP method: `POST`

The function only sends when the support case status changes.

## Function URLs

If you need to use direct HTTP webhooks instead of the Edge Function picker, point each webhook to:

- `https://<project-ref>.supabase.co/functions/v1/notify-host-new-enquiry`
- `https://<project-ref>.supabase.co/functions/v1/notify-guest-host-replied`
- `https://<project-ref>.supabase.co/functions/v1/notify-guest-request-decision`
- `https://<project-ref>.supabase.co/functions/v1/notify-guest-case-updated`

If JWT verification is enabled for the function, include an `Authorization: Bearer <service-role-key>` header in the webhook settings.
