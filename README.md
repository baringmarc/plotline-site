# Plotline site

The marketing site for **Plotline**, a court booking platform for venues in the Philippines (target: `https://plotline.fit`). Venue owners read about the product, try the live demo, read reviews, and send a contact form; we then set their venue up with them. Built with Vite, React 19, TypeScript and Supabase.

All copy, prices and brand details live in [`src/config/site.ts`](src/config/site.ts) and aren't final.

## How it fits into Plotline

Plotline is two repositories:

| Repo | Role | Where |
| --- | --- | --- |
| **plotline-site** (this one) | Marketing frontend | `plotline.fit` |
| [court-booking-system](https://github.com/baringmarc/court-booking-system) | The product every venue runs on, **plus the platform**: the database, all Edge Functions, the SaaS plan and the brand guide | `<venue>.plotline.fit`, `app.plotline.fit` |

Both use the same Supabase project (staging or production), but **only court-booking-system changes its schema or deploys functions**. This site uses the publishable key, calls the `site-contact` and `site-review` functions, and reads approved reviews. The full contract (fields, replies, env vars) is in court-booking-system's [`docs/PLATFORM.md`](https://github.com/baringmarc/court-booking-system/blob/master/docs/PLATFORM.md).

The live demo it links to is the product's demo venue: `https://claudex-courts.plotline.fit`.

## Page structure

`src/routes/LandingPage.tsx`, top to bottom:

| Section | Component | Notes |
| --- | --- | --- |
| Sticky nav | `components/Nav.tsx` | Frosted bar; links fold into a menu on phones; "Get started" goes to `#contact` |
| Hero | `Hero` | Promises, ₱0 / booking-fee stat tiles, CTA and demo link, CSS phone mockup (`components/PhoneMockup.tsx`) |
| The short version | `ShortVersion` | What you get free, what it costs, what's never charged |
| The player's side | `PlayerSide` | 5 phone screens (`public/screens/`, drawn ones in `PlayerScreens.tsx`), open play callout |
| Your side | `Features` | Six owner feature cards, only shipped features |
| What it costs | `Costs` | Worked example and flat vs percentage table (`features/landing/pricing.ts`), mid-page CTA |
| Where the money goes | `MoneyFlow` | Dark band: 4 steps, never billed |
| Venues | `Venues` | Swipeable slider (`components/Slider.tsx`), two rows when 4+ venues. Later reads `public_venues`. |
| Reviews | `features/reviews` | Approved reviews from Supabase + a review form |
| Getting started | `Steps` | 4 setup steps |
| FAQ | `Faq` | `<details>` accordion, objection-led |
| At a glance | `AtAGlance` | The offer as a fact sheet |
| Contact | `features/contact` | Owner contact form at `#contact` → `site-contact`, with Turnstile (`components/Turnstile.tsx`) |
| Final band + footer | `FinalBand`, `components/Footer.tsx` | |

All pricing reads `src/config/pricing.ts`, and every claim must match SPEC §3.1 ("Pricing claims", "Feature claims").

Other routes: `/terms` and `/privacy`. `/welcome` goes away with the old sign-up.

## How the forms work (target, SAAS-PLAN Phase 5)

1. **Contact form:** validated in the browser with `src/lib/siteForms.ts` (an exact copy of the platform's rules), protected by Cloudflare Turnstile and a honeypot, then posted to `site-contact`. That stores a **lead**; no account is created and there's no trial. We follow up and set the venue up together.
2. **Review form:** posted to `site-review`, stored unapproved, and shown once we approve it.

**Today (transitional):** both forms are built for the platform (T1.7), but `site-contact` and `site-review` aren't deployed yet, so sending shows an error until court-booking-system's Phase 5 ships. This repo's old local backend (`register`, `feedback`) is no longer called and is removed in T1.8, once Phase 5 is live.

## Local development

```bash
npm install
cp .env.example .env    # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (and later VITE_TURNSTILE_SITE_KEY)
npm run dev             # http://localhost:5173
```

- **After Phase 5:** point `.env` at the staging project, or at court-booking-system's local stack (`npx supabase start` in that repo; its API is on port 54321). Regenerate types with `npx supabase gen types typescript --project-id <staging-ref> > src/lib/database.types.ts`.
- **Until then:** the old local backend still works (`npm run db:start`, then `npm run functions:serve`; Studio at http://127.0.0.1:55323, emails at http://127.0.0.1:55324). Don't deploy it.

## Checks

```bash
npm run verify    # typecheck + lint + unit tests + build
```

## Deploying (target)

- Cloudflare Workers (static assets) on `plotline.fit` and `www.plotline.fit`, with single-page-app fallback replacing `vercel.json`.
- Env: the production project's URL and publishable key, and the Turnstile site key.
- court-booking-system's `SITE_ORIGINS` secret must list `https://plotline.fit` and `https://www.plotline.fit`, or the functions refuse the site's calls (CORS).

## Before launch

- Replace the placeholders in `src/config/site.ts` (support email, Messenger, Facebook, demo URL `https://claudex-courts.plotline.fit`), `public/logo.svg`, and add `public/og.jpg` (1200×630).
- Remove the free-trial and sign-up wording; match features and pricing to what ships.
- Write real Terms and Privacy pages (`src/routes/SimplePages.tsx`), covering the Data Privacy Act.
