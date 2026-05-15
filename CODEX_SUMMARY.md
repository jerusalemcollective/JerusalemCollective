# JLM Collective - Project Summary for Codex

## Project Overview
JLM Collective is an Airbnb-style vacation rental platform focused on Jerusalem properties. Built with Next.js 16, Tailwind CSS, and Supabase for authentication and database.

## Live URLs
- **Production**: https://v0-airbnb-style-homepage-navy.vercel.app
- **Custom Domain**: https://jlmcollective.co (pending DNS propagation)
- **Privacy Policy**: https://jlmcollective.co/privacy

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://nlsrkgrranxsiuwiztct.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc3JrZ3JyYW54c2l1d2l6dGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNTAyOTMsImV4cCI6MjA5MzcyNjI5M30.TCCndH4VyLlrHWqVi4PLfv7QMKPGuEG_6whXZq5lBBs
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## Supabase Configuration

### Site URL (Authentication > URL Configuration)
```
https://v0-airbnb-style-homepage-navy.vercel.app
```

### Redirect URLs
```
https://v0-airbnb-style-homepage-navy.vercel.app/**
https://v0-airbnb-style-homepage-navy.vercel.app/auth/callback
https://jlmcollective.co/**
https://jlmcollective.co/auth/callback
```

### Email Template (Authentication > Email Templates > Confirm signup)
```html
<div style="margin:0;background:#F8F5F2;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#252525;">
  <div style="margin:0 auto;max-width:560px;border:1px solid #e7e1da;border-radius:24px;background:#ffffff;padding:32px;">
    <div style="text-align:center;">
      <img
        src="https://v0-airbnb-style-homepage-navy.vercel.app/logos/JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png"
        alt="JLM Collective"
        width="200"
        style="display:block;margin:0 auto;max-width:200px;height:auto;"
      />
    </div>

    <h1 style="margin:32px 0 12px;font-size:28px;line-height:1.2;color:#252525;text-align:center;">
      Confirm your JLM Collective account
    </h1>

    <p style="margin:0 auto 28px;max-width:420px;font-size:15px;line-height:1.6;color:#665f58;text-align:center;">
      Welcome to JLM Collective. Confirm your email address to finish creating your host account.
    </p>

    <div style="text-align:center;">
      <a
        href="{{ .ConfirmationURL }}"
        style="display:inline-block;border-radius:999px;background:#c76f55;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;"
      >
        Confirm email
      </a>
    </div>

    <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#8a8178;text-align:center;">
      If you did not create a JLM Collective account, you can ignore this email.
    </p>
  </div>
</div>
```

---

## Vercel Configuration

### Build Settings
- **Framework Preset**: Next.js
- **Root Directory**: (leave blank)
- **Install Command**: `pnpm install`
- **Build Command**: `pnpm build`

### Custom Domains
- `jlmcollective.co`
- `www.jlmcollective.co`

### DNS Records (Cloudflare)
| Type | Name | Content |
|------|------|---------|
| A | @ | 76.76.21.21 |
| A | www | 76.76.21.21 |

---

## Key Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage with search form, featured stays |
| `/stays` | Listings page with filters and map view |
| `/map` | Full map view of listings |
| `/become-a-host` | Multi-step host application form |
| `/host/login` | Host login page |
| `/host/register` | Host registration with Supabase auth |
| `/privacy` | Privacy Policy page |
| `/listings/[id]` | Individual listing detail page |
| `/hosts/[id]` | Host profile page |
| `/auth/callback` | Supabase auth callback handler |

---

## Key Components

### Header (`components/header.tsx`)
- Logo with link to homepage
- Navigation: Browse Stays, List Your Stay
- Saved stays button (heart icon, circular)
- Account button (user icon, circular)

### Footer (`components/footer.tsx`)
- Logo and tagline
- Navigation links: Host login, Trust & safety, Contact
- Privacy Policy popup (modal with summary + link to full policy)
- Copyright notice

### Search Form (in `app/page.jsx`)
- Neighbourhood autocomplete (Google Places API)
- Date range picker with improved UX:
  - Stays open until both dates selected
  - Quick select: 1 week, 2 weeks
  - Clear button
  - Auto-closes after selecting departure date
- Guest selector (adults, children, infants)

---

## Host Registration Flow

### Signup (`app/host/register/page.tsx`)
1. Validates Supabase env vars are present
2. Calls `supabase.auth.signUp()` with email/password
3. Checks for actual user creation (not fake user for existing emails)
4. Shows success message only after confirmed signup
5. Sends confirmation email via Supabase/Resend SMTP

### Become a Host Form (`app/become-a-host/page.jsx`)
Multi-step form with sections:
1. **Contact Details**
   - Full name, email, phone, WhatsApp (optional)
   - "Your connection to this stay" - Owner or Representative
   - If representative: role field (agent, assistant, family member, etc.)
   - Permission confirmation checkbox

2. **Property Info**
   - Property type, title, description
   - Location, neighborhood

3. **Amenities & Pricing**
   - Amenities selection
   - Pricing, availability

4. **Photos**
   - Image upload

---

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Terracotta (Primary) | `#c76f55` | Buttons, accents, links |
| Terracotta Hover | `#b55f47` | Button hover states |
| Background | `#F8F5F2` | Page backgrounds |
| Stone shades | `stone-*` | Text, borders, neutral elements |

---

## Dependencies

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.49.1",
    "date-fns": "^4.1.0",
    "next": "^16",
    "react": "^19",
    "react-dom": "^19"
  }
}
```

---

## File Structure

```
app/
├── page.jsx                    # Homepage
├── layout.tsx                  # Root layout
├── globals.css                 # Global styles
├── stays/page.tsx              # Listings page
├── map/page.tsx                # Map view
├── privacy/page.tsx            # Privacy Policy
├── become-a-host/page.jsx      # Host application form
├── host/
│   ├── login/page.tsx          # Host login
│   └── register/page.tsx       # Host registration
├── listings/[id]/page.tsx      # Listing detail
├── hosts/[id]/page.tsx         # Host profile
└── auth/callback/route.ts      # Auth callback

components/
├── header.tsx                  # Site header
├── footer.tsx                  # Site footer with privacy popup
└── ui/
    └── calendar.tsx            # Date picker component

lib/
├── supabaseClient.js           # Supabase client (legacy)
├── supabase/
│   ├── client.ts               # Browser Supabase client
│   ├── server.ts               # Server Supabase client
│   └── middleware.ts           # Middleware helpers
├── host-profile.ts             # Host profile utilities
└── sample-listings.ts          # Sample data

public/
└── logos/
    └── JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png

supabase/
└── confirmation-email-template.html
```

---

## Google Cloud Console Settings

### OAuth Consent Screen
- **Authorized domains**: 
  - `v0-airbnb-style-homepage-navy.vercel.app`
  - `jlmcollective.co`

### API Key Restrictions (Google Maps)
- **Website restrictions**:
  - `https://v0-airbnb-style-homepage-navy.vercel.app/*`
  - `https://jlmcollective.co/*`

### Privacy Policy URL
```
https://v0-airbnb-style-homepage-navy.vercel.app/privacy
```

---

## Recent Changes Summary

1. **Calendar UX Improvement**: Calendar stays open for date selection, auto-closes only after both arrival and departure dates are selected
2. **Account Button**: Changed to circular icon-only button
3. **Host Signup Validation**: Proper error handling, checks for existing accounts, validates env vars
4. **Privacy Policy**: Full legal page at `/privacy` with popup summary in footer
5. **Become a Host Form**: Updated "Your connection to this stay" section with owner/representative options, role field, and permission checkbox
6. **Footer**: Removed duplicate "List your stay" link, added Privacy Policy popup
7. **Custom Domain**: Added `jlmcollective.co` and `www.jlmcollective.co` to Vercel

---

## Deployment Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Deploy to Vercel
vercel deploy --prod
```
