# Plotline site — Product Spec

The source of truth for **what** the site does. [TASKS.md](TASKS.md) says what to build next,
[RESEARCH.md](RESEARCH.md) holds technical findings, [README.md](README.md) covers setup and deploy.
Update this file in the same change as any behavior change, and add a row to §6 when a choice is made.

> This repo is the marketing frontend only. The database, Edge Functions and contract live in court-booking-system ([`docs/PLATFORM.md`](../court-booking-system/docs/PLATFORM.md)).

## 1. Overview

Marketing site for a court booking product. Venue owners read about it, see the demo and
reviews, and send a contact form; we then set their venue up with them.

### Goals
- Convert venue owners: clear pitch, pricing, and a short contact form.
- Show social proof: venues and approved reviews.
- Keep abuse low: validation shared by browser and server, honeypot, timing check, CAPTCHA before launch.

### Non-goals (v1)
- Booking itself (that is the court booking product), payments, an owner dashboard.

## 2. Roles
| Role | Can do |
| --- | --- |
| Visitor (`anon`) | Read the site, read approved reviews, submit a contact form or a review through Edge Functions |
| Admin (court-booking-system) | Approve reviews, read leads |

## 3. Pages
| Route | Purpose |
| --- | --- |
| `/` | Landing page (sections listed in README) |
| `/terms`, `/privacy` | Terms for venues and Privacy notice (`src/config/legal.ts`): the offer as in SAAS-PLAN §1 and "At a glance", what the two forms collect and why, under the Data Privacy Act. Nothing undecided is left on either page: the email service is Resend, and no draft notice shows (`legalDraftNotice` is empty) |

Every async view handles loading, empty and error states. Mobile-first.

### 3.1 Landing page: target (Milestone 1)

**Design reference:** [taradula.com/list-your-venue](https://taradula.com/list-your-venue), a competitor's owner page. We follow its **structure and page patterns only**. The pricing model, the claims and the words are ours (SAAS-PLAN §1), and the look is our brand (court-booking-system `docs/BRAND.md`: Fraunces and DM Sans, the cream/brown palette). Never copy its wording, numbers, colours or illustrations.

**Sections, top to bottom** (all copy in `src/config/site.ts`):

| # | Section | Content |
| --- | --- | --- |
| 1 | Hero | One outcome headline, a ✓ list of three promises (free for venues, players pay you directly, players add a ₱10 booking fee to each online booking), the CTA to the contact form, a secondary link to the live demo, the phone mockup |
| 2 | The short version | One two-column card (2026-11-02 artifact): on the left the label, one line on cost (the fee, "that fee is all we earn", players pay you, not us) with "Free" highlighted and a link to Pricing; on the right the 8 "what you get, free" items as ticked chips. The cost story is told in Pricing |
| 3 | The player's side | A 4-step walkthrough with captioned phone screens (pick a free slot → pay the venue → you confirm it → their booking link). All four are drawn screens in the app's dark theme (2026-11-02) until real ones exist (they need a real booking). The pay screen shows the venue's GCash QR. Open play is a card under the steps: its title, one line and two chips |
| 4 | Your side | Three headline items (today at a glance, payment proofs, moving a booking) and three "also in your admin" chips (peak and off-peak rates, hours and blackouts, earnings and occupancy with CSV). All shipped |
| 4b | Your venue, your way | Four headline items (`Highlights`, after Your side): your look (banner, court photos, amenities, social links, Maps pin, house rules), the venue's own `<slug>.plotline.fit` address, up to 10 payment accounts with QR codes, every sport on one page; and three "players also get" chips (guest booking, booking emails in the venue's name, My bookings). No colour presets (being redone) |
| 5 | What it costs | One Pricing section (T2.2): two stat tiles, a "never billed" row of crossed pills (labelled for screen readers only), a worked example drawn as a stacked bar (court price + ₱10 = what the player pays; the venue keeps the full court price; the fee is drawn wider than its share and says so), then "Where the money goes", then a flat fee vs an illustrative percentage fee table at several booking sizes. Amounts are computed from the fee in config, never typed in |
| 6 | Where the money goes | Inside Pricing as a timeline: a 4-step flow: player books → pays the venue (its own GCash, Maya, bank or PayMongo) → the booking is confirmed → Plotline sends one monthly invoice for the fees. What's never billed sits above the worked example |
| 7 | Venues and reviews | `Venues` lists only venues that use Plotline (for now the demo venue, Claudex Courts, as a centred card; a slider once there are more than 3), then `ReviewsSection` |
| 8 | Getting started | 4 steps: you contact us → we set up your courts, hours and rates → you get your booking link → we walk you and your team through it (no QR poster: it isn't a product feature) |
| 9 | FAQ | Objection-led questions in three tabs: Players (5), Money (4), Your setup (5), the first answer of each open; at most 120 words of answers per tab (see the rules below) |
| 10 | At a glance | A label/value fact sheet in three groups: the service (service, courts, provider), the money (booking fee, not billed, payments, billing), your data and leaving (CSV export, leaving; §6, 2026-10-29). Four key figures sit above the groups: ₱0 setup, ₱0 monthly, the fee per online booking, 30 days to export after leaving (T2.2). The section follows Pricing |
| 11 | Contact | The contact form (`site-contact`); after sending, a thank-you state with an optional "book a call" link |
| 12 | Final band | One line and the CTA |

**Page patterns:**
- Each section opens with a small uppercase label, an `h2` and a short lead, left-aligned, with no accent bar.
- Plain, tinted and dark sections take turns. Cards, ✓/✕ lists and stat tiles use the existing colour tokens and work in both themes.
- The CTA to the contact form (`#contact`) appears in the nav, the hero, after "What it costs" and in the final band.
- Sections may fade in on scroll. That is off under `prefers-reduced-motion`, and the fade-in never hides content (the page itself needs JavaScript, §6 2026-11-02).
- No live counters (venues, players, bookings) until they read real numbers; never show a zero.

**Pricing claims** (must match SAAS-PLAN §1; the amount isn't final, so it is one value in config):
- Free for venues: no subscription, no setup fee, nothing per hour.
- A ₱10 booking fee per confirmed online booking, paid by the player, shown at checkout and collected by the venue with the court price.
- Players pay the venue directly. Plotline never holds venue money and bills the fees on one monthly invoice.
- Not billed: open play, blackouts, and bookings the venue cancels (the player gets the fee back).
- PayMongo's own fees are between the venue and PayMongo (say so in the FAQ, don't hide it).
- Never claim: a free trial, self-serve sign-up, weekly billing, an owner-pays-the-fee switch, or walk-ins as a feature (they're being hidden).

**Feature claims:** only what court-booking-system ships. Its SAAS-PLAN Phase 5 "Copy" lists the gaps, and none of them may be claimed until they ship:
- open play sign-ups, slots, a waitlist or skill levels (open play is a marked session on the grid, with details and up to 3 links such as an RSVP form or Reclub);
- reminders;
- paying at the venue;
- a venue logo on the booking page.

`sections.test.tsx` checks the landing sections for these words.

## 4. Flows

### Owner contact (T1.7)
1. The form at `#contact` (`features/contact`) checks the fields with `src/lib/siteForms.ts`, an exact copy of the platform's rules. It needs the consent box (linked to `/privacy`) and, when a Turnstile site key is set, a passed check.
2. It posts the PLATFORM.md §4 fields to the platform's `site-contact` function, with the honeypot, the time of first touch and the Turnstile token. The function stores a lead; no account is created.
3. `200 { ok: true }` shows "Thanks, we'll be in touch", plus a "book a call" link when `site.bookCallUrl` is set. Any other reply shows the function's own message, and the Turnstile widget resets for a fresh token (each token works once).
4. Site key: `VITE_TURNSTILE_SITE_KEY`. Without it, development uses Cloudflare's always-pass test key, and a production build shows no widget (the function then refuses the form).

### Reviews
The review form posts to the platform's `site-review` function, which stores the review with `approved = false`. Only approved reviews are public (read from `reviews`).

## 5. Data model
This repo has no database. The tables (`leads`, `reviews`) and their RLS live in court-booking-system (`docs/PLATFORM.md`); the site reads approved `reviews` with the publishable key, and `src/lib/database.types.ts` is generated from the shared project.

## 6. Decisions log
| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-27 | Adopted SPEC/TASKS/RESEARCH workflow with `/implement` and the `reviewer` agent, copied from `court-booking-system` | Same working method across both projects |
| 2026-10-27 | This repo is the marketing **frontend only**. `court-booking-system` is the platform repo: it owns the Supabase schema, migrations and Edge Functions for every shared project; the contract between the two is its `docs/PLATFORM.md` | Two repos pushing migrations to one database break each other's migration history; one owner keeps the contract clear |
| 2026-10-27 | No self-serve sign-up and no free trial. Owners send a contact form (`site-contact`, stored as a lead); reviews go to `site-review`. Domain `plotline.fit`; the live demo is `https://claudex-courts.plotline.fit` | The SaaS plan (court-booking-system `docs/SAAS-PLAN.md` §1, Phase 5): we set each venue up together with the owner |
| 2026-10-27 | The landing page is rebuilt around the pricing model (§3.1), using taradula.com/list-your-venue as the design reference for structure only. It stays on `/`, with no separate owner page | The whole site is for venue owners. The reference sells a near-identical model well (price-led hero, short summary, worked example, money flow); our claims and brand stay our own |
| 2026-10-27 | The player walkthrough's last step is "their booking link", not "a reminder". Steps 1–2 use read-only screenshots of the live demo (`/book`, tomorrow, two hours picked); steps 3–5 are drawn until court-booking-system's M11 shows the fee at checkout. The demo button stays on `claudex-courts.plotline.fit` although its DNS isn't live yet (the user's call: the site isn't public before launch) | The product sends no reminders, and booking emails are off in production; a real booking for screenshots would send real data to production |
| 2026-10-27 | The owner cards leave out staff accounts and booking alerts | Admins are promoted by hand in the database and there's no staff management; booking emails are off in production (court-booking-system SPEC §2, §8) |
| 2026-10-27 | Final order as in §3.1; the old Demo band is dropped (the hero links to the demo). One dark band colour in both themes (`--band`, no terracotta override). The FAQ's staff answer says we set up the logins; it never promises staff management | §3.1 lists no demo band; one dark variant; admins are promoted by hand |
| 2026-10-27 | T1.7 is built against the PLATFORM.md contract before the platform deploys it; T1.8 (removing the old backend) waits for Phase 5 (the user's call). Turnstile: explicit rendering, `theme: auto`, `size: flexible`, reset after every failed send; Cloudflare's test key only in development | The frontend is ready the moment Phase 5 ships; test keys' dummy tokens are refused by real secret keys (RESEARCH M1) |
| 2026-10-27 | Values still to be provided are PLACEHOLDERs in `site.ts` with safe defaults: the support email on our domain, an empty Messenger link ("Message us" falls back to email), an empty Facebook link (hidden), an empty book-a-call link (hidden). The sample venue list is replaced by the demo venue only. T1.11 sets the real values | The user's call; a made-up page handle could point at someone else's page, and invented venues would be a false claim |
| 2026-10-27 | The Terms and Privacy notice are written now as drafts, with visible placeholders for what isn't decided, rather than waiting for the exit terms (T1.10's dependency) | The user's call: defaults now, real values in T1.11 |
| 2026-10-27 | The contact form keeps the PLATFORM.md fields. "Best time to call" and "demo preference" go in the message placeholder for now | Extra fields are a contract change (PLATFORM.md §7); not worth it before launch |
| 2026-10-29 | T1.11a values (the user's): support email `plotline.admin1@gmail.com`; Messenger `https://m.me/61595759948011`; Facebook `https://www.facebook.com/profile.php?id=61595759948011`; `bookCallUrl` stays empty; venues stay the demo only. Terms and Privacy: the provider and controller is "Plotline"; 1 week's notice before a fee change; contact-form leads are kept 1 year after our last contact; the Terms follow Philippine law. Set by us at the user's request: a suspension is lifted once the overdue invoice is paid, usually within one business day; a venue's PayMongo key is stored encrypted, read only by our server, never shown again (the admin pages show its last 4 characters), and if it may have leaked we disconnect it, tell the venue and help it replace the key; exit terms: leave any time by email with no notice period, fees for bookings confirmed before then go on a final invoice due within 7 days, the admin pages and CSV export stay open for 30 days after leaving, then the venue's data is deleted except what the law requires us to keep (such as invoices). The "At a glance" sheet gains "Provider" and "Leaving" rows. The Privacy notice says emails to us are kept in our Gmail inbox (Google); the service that sends us new-lead alerts is still to be named | The user's values and calls; the rest follow court-booking-system SAAS-PLAN §5 (manual suspension) and Phase 4 (encrypted keys, last 4 shown) |
| 2026-11-01 | Added "no limit on courts" (short version list, FAQ, "At a glance" row) and the "Your venue, your way" section (`Highlights`). Checked against court-booking-system SPEC: no court cap since SAAS-PLAN 2026-10-25; booking emails live through Resend since 2026-10-30 (to players, not owners); subdomains live (T13.8); up to 10 payment accounts with QR (T11.10). The colour presets are left out until they are redone (the user's call). The 2026-10-27 "booking emails are off in production" reason no longer holds; owner booking alerts still don't exist, so they stay off the owner cards. The contact form still caps courts at 50 (`MAX_COURTS` in the platform's `siteForms.ts`) | The user asked to showcase these; each claim is a shipped feature (§3.1 Feature claims) |
| 2026-11-02 | T1.8: the old local backend is deleted (`supabase/migrations`, `functions`, `tests`, `config.toml`, `seed.sql`, `docs/drafts/phase5`), with `/welcome`, `site.trialDays`, `courtOptions` and the `db:*`/`functions:serve`/`test:db` scripts. `db:types` generates `src/lib/database.types.ts` from the shared project (`SUPABASE_PROJECT_REF`). Phase 5 is live on the linked project, so the T1.8 hold ended | Phase 5 deployed `site-contact` and `site-review` (court-booking-system PLATFORM.md §5); the site now has no backend of its own |
| 2026-11-02 | The Privacy notice names Resend as the email service for new-lead alerts, and the Terms and Privacy draft notice is removed (`legalDraftNotice` is empty) with no separate legal review | Already decided in court-booking-system: PLATFORM.md §4 (Environment, `LEAD_ALERT_TO`: lead alerts use the Resend booking-email transport) and SAAS-PLAN decisions 2026-11-01 ("The user removes the Terms and Privacy draft notice without a separate legal review") |
| 2026-11-02 | The user's answers for launch: no book-a-call link (`bookCallUrl` stays empty); the venue list is the demo venue only; the booking fee is ₱10 and is set to 10 on production; the contact form keeps its 50-court limit (the page says "no limit on courts" for the product, the form is not a cap). Deploy: Cloudflare Workers static assets (`wrangler.jsonc`, `src/worker.ts` redirects www to the apex; `.env.production` holds the public production values incl. Turnstile site key `0x4AAAAAAFvBvpFgKwOYraXL`); `public/robots.txt` allows all so Facebook's scraper isn't refused | Production CORS for both origins checked 2026-11-02; PLATFORM.md §2 says www redirects to the apex |
| 2026-11-02 | T2.1 copy pass: hero stat tiles removed; the short version is one slim card linking to Pricing; Your side and Your venue cut to headline items plus chips; the FAQ regrouped into Players, Money and Your setup (3 each); "At a glance" in three groups. Highlights has four headline items, not three, to match the design's four numbered callouts. Tests cap each section's `<p>` text at 90 words (FAQ per group) and allow "paid by the player" in two sections. The fee amount still appears in the hero, short version, Pricing, the player's pay step and "At a glance", as the agreed design shows it | Design review 2026-11-02 (Milestone 2). The TASKS wording "no pricing amount in more than two sections" can't hold with that design; the user chose the phrase-only reading when asked on 2026-11-02 |
| 2026-11-02 | T2.4: the player walkthrough is four steps (find and pick merged, the user's call), all drawn in the app's dark theme (the two real light screenshots are removed); open play is a one-line strip; Getting started uses the shared timeline | Real dark screenshots of the booking grid need clicks through the demo, which headless Chrome can't script; the design wants dark screens on the light page; the user accepted drawn screens 2026-11-02 |
| 2026-11-02 | T2.5: the FAQ is three tabs (Players, Money, Your setup). "Answers readable with JS off" is reworded to "all nine Q&As are in the DOM up front; inactive panels use `hidden`" (the user's call). The site is a client-rendered SPA, so the whole page is blank without JavaScript; a prerender would be a separate task. §3.1's fade-in line was reworded to match | A literal JS-off FAQ can't hold without prerendering |
| 2026-11-02 | The sections below the hero were rebuilt to match the design artifact (left-aligned section heads with no accent bar, two-column short version, four dark player screens with a GCash QR on the pay screen, a dark Today view, a booking-page frame using the demo venue's own photos and a real QR from `public/demo/`, pricing cards in the artifact's order, three-card At a glance, tab FAQ). Copy tied to the Terms stays as in `site.ts`; the pricing tiles and money-flow wording follow the artifact. The visible "Never billed" label is now an `aria-label` only | The user asked for the artifact to be followed exactly; earlier tasks had worked from the task text and drifted |
| 2026-11-02 | FAQ grows from 9 to 14 questions (the user's list, checked against court-booking-system's SAAS-PLAN and demo script): can players see their booking later, can I cancel or move a booking, do I need a payment processor, can I manage more than one facility (SAAS-PLAN 2026-10-24: one owner, several venues, each billed separately), can I block off a court. Word cap per tab 90 → 120. Not added: manual bookings (walk-ins are hidden and not claimed), customising the link and sports (already on the page), account (covered by the app answer), setup time (no documented figure) | The user wanted more owner questions answered |

## 7. Open questions
- Turnstile CAPTCHA before launch: the token goes to the platform's `site-contact` function (its secret lives in court-booking-system), not to `auth.signUp`.
- A "book a call" link after the contact form (Google Calendar or Cal.com): which tool and whose calendar. Optional; the thank-you state works without it.
- ~~Real SMTP provider for confirmation emails.~~ No longer needed here: the contact form creates no account, so the site sends no auth emails. Plotline's email sender is set up in court-booking-system (SAAS-PLAN Phase 0).
