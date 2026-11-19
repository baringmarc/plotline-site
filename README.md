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
| The short version | `ShortVersion` | A two-column card: the cost in one line and a link to Pricing, beside what you get as ticked chips |
| The player's side | `PlayerSide` | 4 drawn dark phone screens (`PlayerScreens.tsx`, the pay screen with a GCash QR), open play card |
| Your side | `AdminTour` | Tabbed tour of the seven admin pages with real screenshots (`public/admin-tour/`, made in court-booking-system), callouts of shipped features only; under them `AdminDemo`, the silent demo video (click to play, self-hosted) |
| Your venue, your way | `Highlights` | Four headline items (your look, own `<slug>.plotline.fit` address, payment accounts, every sport) and three "players also get" chips, beside a drawn booking-page frame (`Illustrations.tsx`) |
| What it costs | `Costs` | One Pricing section: two tiles, never billed, worked example as a stacked bar, "Where the money goes" timeline, flat vs percentage table (`features/landing/pricing.ts`), CTA |
| At a glance | `AtAGlance` | Right after Pricing: four key figures, then the offer as a fact sheet in three groups |
| Venues | `VenuesSection` | Reads `public_venues` (`features/venues/`); swipeable slider (`components/Slider.tsx`), two rows when 4+ venues; the demo card when the feed is empty. |
| Reviews | `features/reviews` | Approved reviews from Supabase + a review form |
| Getting started | `Steps` | 4 setup steps |
| FAQ | `Faq` | Three tabs (Players, Money, Your setup) with `<details>` answers, the first of each open, objection-led; all Q&As stay in the DOM |
| Contact | `features/contact` | Owner contact form at `#contact` → `site-contact`, with Turnstile (`components/Turnstile.tsx`) |
| Final band + footer | `FinalBand`, `components/Footer.tsx` | |

All pricing reads `src/config/pricing.ts`, and every claim must match SPEC §3.1 ("Pricing claims", "Feature claims").

Other routes: `/terms` and `/privacy`, and `/paddle-stack` (Paddle Stack, the free open-play queue for organizers: singles or doubles, fixed pairs, levels, six formats, a TV board and share cards; `features/stack/`, lazy-loaded, copy in `src/config/paddleStack.ts`; rules in SPEC §4). Linked from the top bar and the footer. The Worker gives `/paddle-stack` its own title and share tags (`src/config/pageMeta.ts`, `withPageMeta` in `src/worker.ts`). `public/sitemap.xml` lists the four pages.

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
npm run verify    # typecheck + lint + unit tests + build + drift check
npm run test:e2e  # browser tests: Chromium, WebKit and Firefox at every device size (see below)
npm run test:live # live stack smoke against court-booking-system's local stack (see below)
```

**Browser tests** (`e2e/`, Playwright). One-time setup: `npx playwright install chromium webkit firefox` (a few hundred MB). `npm run test:e2e` builds the site, serves it with `vite preview` on port 4173 and runs every spec in 18 projects, one per engine × viewport (`e2e/matrix.ts`: phone 390×844, Android 360×740, iPad portrait and landscape, laptop 1366×768, PC 1920×1080), in both themes; the TV board runs only in the `*-pc` projects. Each check fails on sideways scroll, overlapping cards or a console error, and saves a full-page screenshot under `test-results/` (git-ignored). Requests off localhost and Google Fonts get an empty reply, so the tests never reach production. Run one project with `npx playwright test --project=webkit-phone`. It isn't part of `npm run verify` or the commit gate (slow, and the browsers are a big download); tasks that change the screen list it in their Acceptance. WebKit isn't real Safari: the share sheet, photo picker, full screen and wake lock still need a real iPhone or iPad.

**Live stack smoke** (`e2e/live/`, `npm run test:live`). Start court-booking-system's local stack (`npx supabase start` there), then run `LIVE_SUPABASE_PUBLISHABLE_KEY=<publishable key from npx supabase status> npm run test:live`. It goes live, publishes and reads back through the Edge Function and RPCs, and a Chromium spec (`e2e/live/organizer.spec.ts`) clicks Go live on the board in a build made with `.env.live` (the local stack's URL and publishable key; Turnstile's test key). `LIVE_SUPABASE_URL` overrides the default `http://127.0.0.1:54321`. The device matrix doesn't run it. The player spec (`e2e/live/player.spec.ts`) follows a stack from a second, phone-sized context, live and with the WebSocket refused. The hand-off spec (`e2e/live/handoff.spec.ts`) also needs a local venue admin and an open-play session: `LIVE_HANDOFF_EMAIL`, `LIVE_HANDOFF_PASSWORD` and `LIVE_HANDOFF_SESSION_ID`. Make them with court-booking-system's own e2e helpers against the local stack (the open-play stack spec shows how); nothing is committed here. To try it on a phone on the same Wi-Fi: `npx vite --mode live --host` with the local stack running, then open `http://<this Mac's IP>:5173/paddle-stack`. For a phone to follow a live stack, set `VITE_SUPABASE_URL=http://<this Mac's IP>:54321` too and open the organizer page on the Mac's IP, not `localhost`: the share link and the TV's QR use the page's own address.

## Deploying

Cloudflare Workers with static assets, on `plotline.fit` and `www.plotline.fit` (`wrangler.jsonc`). `src/worker.ts` sends `www` to the apex and answers byte-range requests for video and audio with 206 (static assets alone reply 200 with the whole file, and Safari won't play a video that way); everything else is `dist/` with single-page-app fallback, so `/terms` and `/privacy` deep links work.

1. Once: `npx wrangler login`. In the Cloudflare dashboard, make sure the DNS records for `plotline.fit` and `www` exist and are **proxied** (a proxied `AAAA` record to `100::` works for both), and that the `*` wildcard record stays pointed at court-booking-system.
2. `npm run build` reads `.env.production` (committed: the production Supabase URL, the publishable key and the Turnstile site key are public values). Never put a secret in it.
3. **Automatic:** Cloudflare Workers Builds deploys every push to `master` (the `plotline-site` Worker → Settings → Builds, connected to this repo; build `npm run build`, deploy `npx wrangler deploy`), the same way court-booking-system deploys. It doesn't run `npm run verify`, so run that before merging. **By hand:** `npm run cf:deploy` (it builds first). `npm run cf:dev` serves the build locally first.
4. Check `https://plotline.fit/`, `https://plotline.fit/terms`, that `curl -s https://plotline.fit/paddle-stack | grep '<title>'` shows Paddle Stack's title (then re-scrape it in Facebook's Sharing Debugger), that `https://www.plotline.fit/terms` redirects to the apex, and send the contact form once (Turnstile, the lead in the console, the alert email).
5. Delete `vercel.json` once nothing deploys there.
- court-booking-system's `SITE_ORIGINS` already lists `https://plotline.fit` and `https://www.plotline.fit` on production (checked 2026-11-02).
- Facebook's link scraper needs a 200 from the page (`public/robots.txt` allows it). If the Sharing Debugger still shows 403 after deploy, check Cloudflare Security → WAF and Bot settings for a rule blocking `facebookexternalhit`.

## Before launch

- Deploy (above), then check the Messenger preview of `og.jpg`, send a test review and approve it in the console, and replace the drawn player-side screens once staging shows the ₱10 fee.
- `bookCallUrl` stays empty (`src/config/site.ts`). The venue list is live: a venue appears once a platform admin approves it in the console (court-booking-system).
- Match features and pricing to what ships.
