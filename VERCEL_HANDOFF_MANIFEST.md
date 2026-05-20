# Vercel / GitHub Handoff

This project now deploys from the current Next.js App Router file structure.

## Key App Files

- `app/page.tsx`
- `app/stays/page.tsx`
- `app/map/page.tsx`
- `app/become-a-host/page.tsx`
- `app/listings/[id]/page.tsx`
- `app/hosts/[id]/page.tsx`
- `app/account/page.tsx`
- `app/host/dashboard/page.tsx`

## Admin Action Files

The old `app/admin/actions.ts` file has been split into domain files:

- `app/admin/admin-actions.ts`
- `app/admin/application-actions.ts`
- `app/admin/case-actions.ts`
- `app/admin/host-actions.ts`
- `app/admin/listing-actions.ts`
- `app/admin/review-actions.ts`

## Supabase

Run new SQL migrations in Supabase SQL Editor when they are added under `supabase/migrations/`.

The current repair migration for admin-to-host messages is:

- `supabase/migrations/026_listing_admin_messages_updated_at.sql`

## Deployment

Copy the changed files into the GitHub repo, commit, and push. Vercel should deploy from GitHub automatically.
