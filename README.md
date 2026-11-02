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
| Hero | `Hero` | Promises, CTA and demo link, CSS phone mockup (`components/PhoneMockup.tsx`) |
| The short version | `ShortVersion` | A slim card: the cost in one line, what you get as chips, a link to Pricing |
| The player's side | `PlayerSide` | 4 drawn dark phone screens (`PlayerScreens.tsx`), open play strip |
| Your side | `Features` | Three headline items and three chips, only shipped features |
| What it costs | `Costs` | One Pricing section: two tiles, never billed, worked example as a stacked bar, flat vs percentage table (`features/landing/pricing.ts`), "Where the money goes" timeline, CTA |
| At a glance | `AtAGlance` | Right after Pricing: four key figures, then the offer as a fact sheet in three groups |
| Venues | `Venues` | Swipeable slider (`components/Slider.tsx`), two rows when 4+ venues. Later reads `public_venues`. |
| Reviews | `features/reviews` | Approved reviews from Supabase + a review form |
| Getting started | `Steps` | 4 setup steps |
| FAQ | `Faq` | three tabs (Players, Money, Your setup) of `<details>` answers, objection-led |
| Contact | `features/contact` | Owner contact form at `#contact` → `site-contact`, with Turnstile (`components/Turnstile.tsx`) |
| Final band + footer | `FinalBand`, `components/Footer.tsx` | |

All pricing reads `src/config/pricing.ts`, and every claim must match SPEC §3.1 ("Pricing claims", "Feature claims").

Other routes: `/terms` and `/privacy`.

## How the forms work

1. **Contact form:** validated in the browser with `src/lib/siteForms.ts` (an exact copy of the platform's rules), protected by Cloudflare Turnstile and a honeypot, then posted to `site-contact`. That stores a **lead**; no account is created and there's no trial. We follow up and set the venue up together.
2. **Review form:** posted to `site-review`, stored unapproved, and shown once we approve it.

## Local development

```bash
npm install
cp .env.example .env    # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_TURNSTILE_SITE_KEY
npm run dev             # http://localhost:5173
```

- Point `.env` at the staging project, or at court-booking-system's local stack (`npx supabase start` in that repo; its API is on port 54321). This repo has no database or functions of its own.
- Regenerate the types after a schema change in court-booking-system: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:types` (needs `npx supabase login`).

## Checks

```bash
npm run verify    # typecheck + lint + unit tests + build
```

## Deploying

Cloudflare Workers with static assets, on `plotline.fit` and `www.plotline.fit` (`wrangler.jsonc`). `src/worker.ts` sends `www` to the apex; everything else is `dist/` with single-page-app fallback, so `/terms` and `/privacy` deep links work.

1. Once: `npx wrangler login`. In the Cloudflare dashboard, make sure the DNS records for `plotline.fit` and `www` exist and are **proxied** (a proxied `AAAA` record to `100::` works for both), and that the `*` wildcard record stays pointed at court-booking-system.
2. `npm run build` reads `.env.production` (committed: the production Supabase URL, the publishable key and the Turnstile site key are public values). Never put a secret in it.
3. `npm run cf:deploy` (it builds first). `npm run cf:dev` serves the build locally first.
4. Check `https://plotline.fit/`, `https://plotline.fit/terms`, that `https://www.plotline.fit/terms` redirects to the apex, and send the contact form once (Turnstile, the lead in the console, the alert email).
5. Delete `vercel.json` once nothing deploys there.
- court-booking-system's `SITE_ORIGINS` already lists `https://plotline.fit` and `https://www.plotline.fit` on production (checked 2026-11-02).
- Facebook's link scraper needs a 200 from the page (`public/robots.txt` allows it). If the Sharing Debugger still shows 403 after deploy, check Cloudflare Security → WAF and Bot settings for a rule blocking `facebookexternalhit`.

## Before launch

- Deploy (above), then check the Messenger preview of `og.jpg`, send a test review and approve it in the console, and replace the drawn player-side screens once staging shows the ₱10 fee.
- `bookCallUrl` stays empty and the venue list shows only the demo venue until there are real ones (`src/config/site.ts`).
- Match features and pricing to what ships.
