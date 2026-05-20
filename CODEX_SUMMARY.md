# JLM Collective - Project Summary

JLM Collective is a Jerusalem short-term stay marketplace built with Next.js App Router, Tailwind CSS, and Supabase for authentication and data.

## Public Routes

- `/` - Homepage with search, featured stays, neighbourhood discovery, and SEO metadata
- `/stays` - Searchable stays page with filters
- `/map` - Map view of published listings
- `/listings/[id]` - Listing detail page with Open Graph image and JSON-LD structured data
- `/hosts/[id]` - Public host profile page
- `/become-a-host` - Host application flow

## Account And Host Routes

- `/account` - Guest profile dashboard
- `/account/messages` - Guest messages
- `/account/bookings` - Guest trips
- `/account/enquiries` - Guest enquiries
- `/account/reviews` - Guest review submissions
- `/host/dashboard` - Host dashboard
- `/host/dashboard/listings` - Host listing management
- `/host/dashboard/messages` - Host inbox
- `/host/dashboard/calendar` - Host availability calendar
- `/host/dashboard/payments` - Host payment details

## Admin Routes

- `/admin` - Admin overview
- `/admin/applications` - Host application review
- `/admin/listings` - Listing moderation
- `/admin/hosts` - Host management
- `/admin/guests` - Guest directory
- `/admin/enquiries` - Enquiry work queue
- `/admin/reviews` - Review approval
- `/admin/cases` - Support cases
- `/admin/admins` - Admin role management
- `/admin/audit` - Admin audit log

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=your_resend_api_key
```

## Important Notes

- Private routes should not be indexed by search engines.
- Public listing pages include Open Graph metadata and JSON-LD structured data.
- Admin-to-host listing messages require `listing_admin_messages.updated_at`; run migration `026_listing_admin_messages_updated_at.sql` if missing.
- The old `lib/supabaseClient.js` and `.jsx` page files have been removed in favour of typed App Router files.
