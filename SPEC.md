# Plotline site — Product Spec

The source of truth for **what** the site does. [TASKS.md](TASKS.md) says what to build next,
[RESEARCH.md](RESEARCH.md) holds technical findings, [README.md](README.md) covers setup and deploy.
Update this file in the same change as any behavior change, and add a row to §6 when a choice is made.

> **Planned change (2026-10-27).** This spec describes the site **as it is today**. Under Plotline's SaaS plan, the owner sign-up and the 7-day trial are replaced by a **contact form** (a lead, no account, no trial), and this repo's backend (`venue_signups`, `reviews`, `register`, `feedback`) moves to `court-booking-system`, which owns the database and every Edge Function. The target and the contract are in court-booking-system's [`docs/PLATFORM.md`](../court-booking-system/docs/PLATFORM.md) and `docs/SAAS-PLAN.md` (Phase 5). Don't extend the sign-up flow; build toward the contact form.

## 1. Overview

Landing and owner sign-up site for a court booking product. Venue owners read about it, see venues and
reviews, and start a 7-day free trial.

### Goals
- Convert venue owners: clear pitch, pricing, and a short sign-up form.
- Show social proof: venues and approved reviews.
- Keep abuse low: validation shared by browser and server, honeypot, timing check, CAPTCHA before launch.

### Non-goals (v1)
- Booking itself (that is the court booking product), payments, an owner dashboard.

## 2. Roles
| Role | Can do |
| --- | --- |
| Visitor (`anon`) | Read the site, read approved reviews, submit a sign-up or a review through Edge Functions |
| Owner (`authenticated`) | Everything a visitor can, plus read their own row in `venue_signups` |
| Admin (Supabase Studio, service role) | Approve reviews, manage sign-ups |

## 3. Pages
| Route | Purpose |
| --- | --- |
| `/` | Landing page (sections listed in README) |
| `/welcome` | Where the confirmation email lands |
| `/terms`, `/privacy` | Draft Terms for venues and Privacy notice (`src/config/legal.ts`): the offer as in SAAS-PLAN §1 and "At a glance", what the two forms collect and why, under the Data Privacy Act. Undecided parts are visible "[to be decided]" placeholders and the pages say they are drafts |

Every async view handles loading, empty and error states. Mobile-first.

### 3.1 Landing page: target (Milestone 1)

**Design reference:** [taradula.com/list-your-venue](https://taradula.com/list-your-venue), a competitor's owner page. We follow its **structure and page patterns only**. The pricing model, the claims and the words are ours (SAAS-PLAN §1), and the look is our brand (court-booking-system `docs/BRAND.md`: Fraunces and DM Sans, the cream/brown palette). Never copy its wording, numbers, colours or illustrations.

**Sections, top to bottom** (all copy in `src/config/site.ts`):

| # | Section | Content |
| --- | --- | --- |
| 1 | Hero | One outcome headline, a ✓ list of three promises (free for venues, players pay you directly, ₱10 per online booking paid by the player), two stat tiles (₱0 to start, ₱10 the only fee), the CTA to the contact form, a secondary link to the live demo, the phone mockup |
| 2 | The short version | Two cards: "What you get, free" (✓ list) and "What it costs" (the fee rules, then a ✕ list: no subscription, no setup fee, no monthly fee). Ends with the line that Plotline never holds the venue's money |
| 3 | The player's side | A 5-step walkthrough with captioned phone screens (find a slot → pick a time → pay the venue → you confirm it → their booking link). Steps 1–2 are read-only screenshots of the live demo; 3–5 are drawn screens until real ones exist (they need a real booking). Open play is a callout under the steps |
| 4 | Your side | Six owner feature cards, all shipped: today's courts, payment proof review, peak and off-peak rates, hours and blackouts, moving a booking, earnings and occupancy with CSV |
| 5 | What it costs | Stat tiles, a worked example (court price + ₱10 = what the player pays; the venue keeps the full court price) and a flat fee vs an illustrative percentage fee table at several booking sizes. Both are computed from the fee in config, never typed in |
| 6 | Where the money goes | A 4-step flow: player books → pays the venue (its own GCash, Maya, bank or PayMongo) → the booking is confirmed → Plotline sends one monthly invoice for the fees. Then what's never billed |
| 7 | Venues and reviews | `Venues` lists only venues that use Plotline (for now the demo venue, Claudex Courts, as a centred card; a slider once there are more than 3), then `ReviewsSection` |
| 8 | Getting started | 4 steps: you contact us → we set up your courts, hours and rates → you get your booking link → we walk you and your team through it (no QR poster: it isn't a product feature) |
| 9 | FAQ | Objection-led questions (see the rules below) |
| 10 | At a glance | A label/value fact sheet: service, setup fee, monthly fee, booking fee, not billed, payments, billing, your data (CSV export). Exit terms and the provider are added once settled (§7) |
| 11 | Contact | The contact form (`site-contact`); after sending, a thank-you state with an optional "book a call" link |
| 12 | Final band | One line and the CTA |

**Page patterns:**
- Each section opens with a small uppercase label, an `h2` and a short accent bar.
- Plain, tinted and dark sections take turns. Cards, ✓/✕ lists and stat tiles use the existing colour tokens and work in both themes.
- The CTA to the contact form (`#contact`) appears in the nav, the hero, after "What it costs" and in the final band.
- Sections may fade in on scroll. That is off under `prefers-reduced-motion`, and all content is visible without JavaScript.
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

**Until court-booking-system deploys `site-contact` and `site-review` (Phase 5), both forms show an error:** the functions don't exist yet. The old local backend (`register`, `feedback`) stays until then (T1.8), but nothing calls it.

### Reviews
The review form posts to the platform's `site-review` function, which stores the review with `approved = false`. Only approved reviews are public (read from `reviews`).

## 5. Data model
- `venue_signups`: one row per owner (limits are CHECK constraints; mirrored in `_shared/validate.ts`).
- `reviews`: name, venue, quote (10–400), role (`player`|`owner`), rating (1–5), `approved`.
- RLS on every table with explicit policies; triggers and helpers in the `private` schema.

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

## 7. Open questions
- Turnstile CAPTCHA before launch: the token goes to the platform's `site-contact` function (its secret lives in court-booking-system), not to `auth.signUp`.
- Exit terms for the "At a glance" sheet and the FAQ: notice period to leave, what happens to unpaid invoices, and whether a venue can still export its bookings after it leaves or while it's suspended (the CSV export from the admin pages already ships). Not settled in SAAS-PLAN yet; leave those rows out until it is. The Terms show it as a "[to be decided]" placeholder.
- For the Terms and Privacy notice (T1.10 placeholders, T1.11): the provider's registered name and address (also the personal information controller), the notice period before a fee change, how a suspension is lifted, how venues' PayMongo keys are stored and protected (SAAS-PLAN Phase 4), how long contact-form leads are kept, the email provider that sends us new leads, and a legal review of both pages.
- A "book a call" link after the contact form (Google Calendar or Cal.com): which tool and whose calendar. Optional; the thank-you state works without it.
- ~~Real SMTP provider for confirmation emails.~~ No longer needed here: the contact form creates no account, so the site sends no auth emails. Plotline's email sender is set up in court-booking-system (SAAS-PLAN Phase 0).
