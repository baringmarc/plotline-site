# Plotline site

Landing and sign-up site for a court booking product: venue owners read about it, see venues and
reviews, and start a free trial. Built with Vite, React 19, TypeScript and Supabase.

All copy, prices and brand details are placeholders in [`src/config/site.ts`](src/config/site.ts).

## Page structure

`src/routes/LandingPage.tsx`, top to bottom:

| Section | Component | Notes |
| --- | --- | --- |
| Sticky nav | `components/Nav.tsx` | Frosted bar; links fold into a menu on phones |
| Hero | `Hero` | Headline, two CTAs, CSS phone mockup (`components/PhoneMockup.tsx`) |
| Venues | `Venues` | Swipeable slider (`components/Slider.tsx`), two rows when 4+ venues |
| Reviews | `features/reviews` | Approved reviews from Supabase + a review form |
| Players / owners | `Audiences` | Two cards |
| Open play | `OpenPlay` | Dark band with chips |
| Features | `Features` | 3-column grid |
| Pricing | `Pricing` | 3 plans, one highlighted |
| Steps | `Steps` | How it works |
| Demo | `Demo` | Link to a live demo |
| Sign-up | `features/signup` | Owner registration form |
| FAQ | `Faq` | `<details>` accordion |
| Final band + footer | `FinalBand`, `components/Footer.tsx` | |

Other routes: `/welcome` (where the confirmation email lands), `/terms`, `/privacy`.

## How sign-up works

1. The form posts to the `register` Edge Function, which validates it (same rules as the browser,
   from `supabase/functions/_shared/validate.ts`) and drops bots (honeypot field + "filled too fast").
2. The function calls `auth.signUp` with the form fields as user metadata. A trigger copies them into
   `public.venue_signups` with status `pending`, and Supabase Auth sends the confirmation email.
3. The email link returns to `/welcome`. Confirming triggers `status = 'trial'` and
   `trial_ends_at = confirmed + 7 days`.

Reviews post to the `feedback` Edge Function, which stores them with `approved = false`. Approve
them in Supabase Studio (Table editor → `reviews`) to show them on the site.

## Local development

Docker Desktop must be running. This project's local Supabase uses ports **553xx**, so it can run
next to `court-booking-system` (543xx).

```bash
npm install
npm run db:start                 # starts Supabase, applies migrations and seed
cp .env.example .env             # fill in the publishable key printed by db:start
cp supabase/functions/.env.example supabase/functions/.env
npm run functions:serve          # Edge Functions, in a second terminal
npm run dev                      # http://localhost:5173
```

- Studio: http://127.0.0.1:55323
- Emails (confirmation links): http://127.0.0.1:55324

## Checks

```bash
npm run verify    # typecheck + lint + unit tests + build
npm run test:db   # pgTAP tests (RLS, triggers) against the local database
```

## Deploying

1. Create a Supabase project, then `npx supabase link --project-ref <ref>`.
2. `npm run db:push` and `npx supabase functions deploy register feedback`.
3. `npx supabase secrets set SITE_URL=https://your-domain ALLOWED_ORIGIN=https://your-domain`
4. In the dashboard, under Authentication → URL Configuration, set the Site URL and add
   `https://your-domain/welcome` to the redirect URLs. Set up custom SMTP for real email volume.
5. Deploy the front end (Vercel: `vercel.json` already rewrites routes to `index.html`) with
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set.

## Before launch

- Replace everything in `src/config/site.ts`, `public/logo.svg`, and add `public/og.jpg` (1200×630).
- Write real Terms and Privacy pages (`src/routes/SimplePages.tsx`).
- Turn on CAPTCHA (Turnstile) under Authentication → Attack Protection. The `register` function's
  bot checks can be skipped by calling Supabase Auth directly with the public key; CAPTCHA closes that.
