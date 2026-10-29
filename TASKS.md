# TASKS.md

The working plan. [SPEC.md](SPEC.md) says **what** the site does; this file says **what to build next**
and tracks progress. [RESEARCH.md](RESEARCH.md) holds the technical findings behind the tasks.

## Handoff

> Update this section at the end of every session or task. Keep it short; it's the first thing the next session reads.

- **Current milestone:** Milestone 1, Launch readiness (broken down 2026-10-27).
- **Next task:** T1.11b Remaining placeholders, once the user provides them; T1.8 once court-booking-system's Phase 5 is live (held, the user's call 2026-10-27).
- **State:** T1.1–T1.7, T1.9, T1.10 and T1.11a done; T1.8 held. T1.11a set the user's values (SPEC §6, 2026-10-29): support email `plotline.admin1@gmail.com`, Messenger and Facebook links, "Provider" and "Leaving" rows in "At a glance", and the Terms and Privacy text (provider Plotline, PayMongo key handling, suspension lifted on payment, 1 week's fee notice, exit terms, 1-year lead retention). Left for T1.11b: `bookCallUrl` (empty), the venue list (demo only), the email service's name, and the draft notice until a legal review. The contact form posts to `site-contact` and reviews to `site-review`; neither is deployed yet, so sending shows an error until Phase 5. The old backend in `supabase/` is no longer called (T1.8 removes it).
- **Blockers / notes:** The leaving terms and the 1-week fee notice (T1.11a) should be added to court-booking-system SAAS-PLAN §1, where the business terms are decided. The user's rule (2026-10-27): anything still to be decided or provided gets a placeholder now, and T1.11 collects the real values. Open from T1.7: `site.bookCallUrl` is empty (no book-a-call link), and production needs `VITE_TURNSTILE_SITE_KEY` (without it no widget shows and `site-contact` answers 403). PLATFORM.md §4 should list the 503 reply that the drafted `site-contact` sends when its Turnstile secret is unset (a court-booking-system change). The owner cards leave out staff accounts (admins are promoted by hand, no staff UI) and booking alerts (emails off in production); add them only once they ship. "Run your courts from your phone" assumes the admin pages work on a phone; check `/admin/courts/:id` (the rate grid) when real screenshots are taken. The player's side steps 3–5 are drawn placeholders (`PlayerScreens.tsx`). Replace them with real screenshots once court-booking-system M11 shows the ₱10 fee at checkout, from a booking made on staging or the local stack, not production. `claudex-courts.plotline.fit` doesn't resolve yet; the demo button keeps it (the user's call). Docker Desktop must be running for `npm run test:db`. Open items for launch are in README "Before launch".
- **Platform (2026-10-27):** this repo becomes frontend only. The backend moves to `court-booking-system` (its `docs/PLATFORM.md`; drafts in this repo's `docs/drafts/phase5/` and court-booking-system's `docs/drafts/phase5-site-backend/`). Plan new milestones around the contact form, not the old sign-up and trial, and never add migrations or Edge Functions here.

## How tasks work

- Only the **current milestone** is broken into tasks. Later milestones stay one-liners.
- Tasks run **in order** unless `Depends` says otherwise. Each task should fit in one focused session.
- Status: `[ ]` todo, `[~]` in progress, `[x]` done, `[-]` dropped (say why).
- **Definition of done** (all required before ticking a box):
  1. Every acceptance criterion holds. DB criteria are proven by pgTAP tests in `supabase/tests/database/`.
  2. `npm run verify` passes.
  3. The `reviewer` agent reports no blocking issues against SPEC.md and this task.
- If a task changes behavior, update SPEC.md in the same task (and add a row to its decisions log).
- If a task is too big, split it here first (T1.4a, T1.4b, …).

### Task format

```md
- [ ] **T1.1 Title**
  - Do: what to build
  - Depends: T-ids or none
  - Files: expected files
  - Acceptance: checkable criteria
```

---

## Milestone 1: Launch readiness

One-liner: the landing page rebuilt around the pricing model (SPEC §3.1), real copy and assets, the contact form on the platform's `site-contact` (with Turnstile), real Terms and Privacy. Follows court-booking-system's SAAS-PLAN Phase 5 and `docs/PLATFORM.md` (updated 2026-10-27: no sign-up, no trial, no SMTP here).

Design reference for T1.1–T1.6: [taradula.com/list-your-venue](https://taradula.com/list-your-venue), for structure and page patterns only. Our model, words and brand (SPEC §3.1). T1.1–T1.6 need nothing from the platform; T1.7 and T1.8 wait for court-booking-system to deploy `site-contact` and `site-review`.

- [x] **T1.1 Page patterns**
  - Notes: `SectionHead`, `Reveal` (+ `Reveal.test.tsx`), and in `global.css` `.shead`, `section.dark`, `.stats`/`.stat`, `.ticks.crosses`, `.facts`, `.reveal`. The tinted variant is the existing `section.white`. Proven on `Features`; checked in headless Chrome at 360/1280px, light and dark, reduced motion. Reviewer: PASS.
  - Follow-ups: one dark band colour. In the dark theme `.band` switches to terracotta but `section.dark` stays on `--band`; settle it in T1.6 (FinalBand on `section.dark`, or match the override).
  - Do: the shared building blocks from SPEC §3.1 "Page patterns": a section head (label, `h2`, accent bar, lead), plain/tinted/dark section variants, ✓ and ✕ lists, stat tiles, a label/value fact sheet, and an optional fade-in on scroll. Use them in one existing section to prove them out.
  - Depends: none
  - Files: `src/styles/global.css`, `src/components/SectionHead.tsx`, `src/components/Reveal.tsx` (or a hook), `src/features/landing/sections.tsx`
  - Acceptance: only existing colour tokens (no new hex values outside `:root`); correct in light and dark themes; no horizontal scroll at 360px; with `prefers-reduced-motion` or without JS every section is fully visible; Reveal has a test.

- [x] **T1.2 Pricing config, hero and the short version**
  - Notes: `pricing` and `peso()` live in `src/config/pricing.ts` (re-exported from `site.ts`) so a test can swap the fee. `sections.test.tsx` covers: amounts only from config, a ₱15 fee replaces every ₱10, no trial/sign-up/plan wording, the demo link. Checked at 360/1280px, light and dark. Reviewer: PASS.
  - Follow-ups: in T1.3 "Where the money goes", name PayMongo next to GCash, Maya and bank (the hero promise leaves it out for brevity). In T1.6 confirm the QR poster is a real product feature before "Getting started" promises it (left out of "What you get" for that reason).
  - Do: add one `pricing` object to `site.ts` (booking fee, currency, what's not billed) that every pricing sentence and number reads from. Rewrite the hero (promises, ₱0/₱10 stat tiles, CTA, demo link) and add "The short version" (what you get free / what it costs + ✕ list + "we never hold your money").
  - Depends: T1.1
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/routes/LandingPage.tsx`, `src/styles/global.css`
  - Acceptance: no trial, sign-up or monthly-plan wording in the hero or the short version; changing `pricing.bookingFee` changes every amount shown in them; claims match the SPEC §3.1 pricing list; `site.demoUrl` is `https://claudex-courts.plotline.fit`.

- [x] **T1.3 What it costs and where the money goes**
  - Notes: maths in `src/features/landing/pricing.ts` (+ `pricing.test.ts`); `Costs` (keeps `id="pricing"`) and `MoneyFlow` in `sections.tsx`, tested in `sections.test.tsx` incl. a ₱15 fee swap. Step 2 names PayMongo (closes the T1.2 follow-up). The sign-up form still sends `openPlayAddon: false` for the old validator until T1.8. Reviewer: PASS.
  - Do: replace `Pricing` (and the `plans`/`openPlayAddon` config) with "What it costs" (stat tiles, worked example, flat vs illustrative percentage table) and add "Where the money goes" (4-step flow, never-billed list, monthly invoice). Compute the tables with a pure function from `pricing` and a list of example court prices in config. Mid-page CTA after it.
  - Depends: T1.2
  - Files: `src/config/site.ts`, `src/features/landing/pricing.ts` (+ `pricing.test.ts`), `src/features/landing/sections.tsx`, `src/styles/global.css`
  - Acceptance: `plans` and `openPlayAddon` are gone (the sign-up form's add-on box goes with them); the percentage column is labelled as an illustration, not a competitor's price; the tables are readable at 360px (stacked or scrolling inside their card, not the page); tests cover the example and table maths.

- [x] **T1.4 The player's side**
  - Notes: `PlayerSide` (+ `PlayerScreens.tsx`, `public/screens/step-1-find.webp`, `step-2-pick.webp`, read-only from the live demo) replaces `Audiences` and the `OpenPlay` band. The last step is "their booking link" (the product has no reminders; SPEC §6). Also fixed two unshipped claims from T1.2 (venue logo, open play waitlist) and added SPEC §3.1 "Feature claims" with a test over the landing sections. Reviewer: PASS.
  - Do: a 5-step walkthrough with captioned screenshots taken from the live demo (find a slot → pick → pay the venue → confirmation → reminder). Open play as one step or a callout. Replaces `Audiences` and the `OpenPlay` band.
  - Depends: T1.1
  - Files: `public/screens/*.webp`, `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/styles/global.css`
  - Acceptance: images have width/height and alt text, lazy-load below the fold, and stay under ~120 KB each; swipeable on phones, a row or grid on desktop; screenshots show the ₱10 fee at checkout once court-booking-system M11 is live (placeholder frames until then, noted in the Handoff).

- [x] **T1.5 Your side**
  - Notes: six cards in `site.ts` (`featuresHead`, `features`), each checked against court-booking-system's SPEC; staff accounts and booking alerts dropped (SPEC §6). `Features` is in the unshipped-feature check in `sections.test.tsx`. Reviewer: PASS.
  - Do: rewrite `Features` as owner feature cards (today's courts, proof review, peak and off-peak rates, hours and blackouts, moving a booking, earnings). Only features the product has, or will have at launch.
  - Depends: T1.1
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`
  - Acceptance: no walk-in feature; each card checked against court-booking-system's current features (list any doubtful ones in the Handoff); no SPEC §3.1 unshipped feature (drop "pay when they arrive", the open play waitlist and skill levels, "name and logo"; check "Booking alerts", since booking emails are off in production); `Features` added to the unshipped-feature check in `sections.test.tsx` (T1.6 adds `Steps`, `Faq` and `FinalBand`).

- [x] **T1.6 Getting started, FAQ, at a glance, final band**
  - Notes: `Steps` (4 steps, no QR poster: settles the T1.2 follow-up), `Faq` (8 answers checked against court-booking-system), `AtAGlance` (no exit terms or provider yet), `FinalBand`; `contactAnchor` and `nav` in `site.ts`; the old form's section is `#contact`. Demo band dropped; `.band` keeps `--band` in dark mode (settles the T1.1 follow-up). `index.html` meta tags rewritten, with `src/indexHtml.test.ts`. `sections.test.tsx` runs the copy checks over all 10 static sections, plus CTA and nav-anchor tests. README table and SPEC §3.1/§6/§7 updated. Reviewer: PASS (round 2; round 1 caught the old meta description).
  - Do: `Steps` becomes the 4 setup steps; rewrite the FAQ around objections (unpaid bookings, cancellations, PayMongo fees, no app for players, changing rates, open play, staff logins); add the "At a glance" fact sheet (the FAQ's staff logins answer says we set them up for you, never staff management); move every CTA to `#contact` (nav, hero, the mid-page one in `Costs`, final band). Put the sections in the SPEC §3.1 order and update the README section table.
  - Depends: T1.2, T1.3
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/routes/LandingPage.tsx`, `src/components/Nav.tsx`, `README.md`
  - Acceptance: no trial or plan wording left anywhere on `/` except inside the old sign-up form (T1.7); exit-terms rows are left out until SPEC §7 settles them; nav links point at sections that exist.

- [x] **T1.7 Contact form** (built ahead of the platform's `site-contact`, the user's call)
  - Notes: `features/contact` (`ContactForm.tsx` + test), `components/Turnstile.tsx` + test, `lib/turnstile.ts`, `lib/siteForms.ts` (byte-identical to court-booking-system's draft original), `lib/functions.test.ts` (each reply's own message). Reviews call `site-review`. The old `features/signup` is gone. A Turnstile load failure shows its own notice with a "Message us" link. RESEARCH "Turnstile" is Decided. Reviewer: PASS.
  - Do: apply `docs/drafts/phase5/` (siteForms copy, `features/contact/api.ts`, reviews api, env example). Turn `SignupForm` into `ContactForm` at `#contact` with the PLATFORM.md fields, one consent checkbox, Turnstile and the honeypot. The message placeholder asks for the best time to call and an in-person or online walkthrough. Thank-you state with an optional "book a call" link from `site.ts`.
  - Depends: court-booking-system Phase 5 deployed to staging; T1.6
  - Files: `src/lib/siteForms.ts`, `src/features/contact/*`, `src/features/reviews/api.ts`, `src/config/site.ts`, `.env.example`
  - Acceptance: fields and replies (200/400/403/500) match PLATFORM.md §4, each with its own message; `siteForms.ts` is byte-identical to the platform's; tests cover validation, a successful send and each error reply.

- [ ] **T1.8 Remove the old sign-up and backend** (held until court-booking-system's Phase 5 is live, the user's call 2026-10-27)
  - Do: delete `features/signup`, `/welcome`, `trialDays` and `courtOptions` if unused, `supabase/migrations`, `supabase/functions`, `supabase/tests`, the old `db:*`/`functions:serve` scripts and `docs/drafts/phase5/`. Add `db:types` from the shared project.
  - Depends: T1.7
  - Files: as listed, `package.json`, `README.md`, `CLAUDE.md`
  - Acceptance: `grep -ri "trial" src` finds nothing; `npm run verify` passes; README and CLAUDE.md no longer describe the transitional backend.

- [x] **T1.9 Real content and assets**
  - Notes: PLACEHOLDERs in `site.ts` with safe defaults, `messageLink` (Messenger, else email), the demo venue only (`venuesHead`, a centred `.venuerow` for ≤3 venues), `public/og.jpg` (1200×630) and absolute preview tags in `index.html`. Tests: `src/config/content.test.ts`, `src/components/Footer.test.tsx`. Reviewer: PASS.
  - Do (re-scoped 2026-10-27 under the user's placeholder rule; the real values move to T1.11): mark every value still to be provided as PLACEHOLDER in `site.ts` with a safe default (support email on our domain; Messenger and Facebook empty, so their links hide or fall back to email; `bookCallUrl` empty); list only real venues (for now the demo venue, Claudex Courts); make the share image and the page's title, description and preview tags.
  - Depends: T1.6
  - Files: `src/config/site.ts`, `index.html`, `public/`
  - Acceptance: no `example.com`, `your-page` or "Sample" values left; no fake venue on the page; no link points at a page that isn't ours; `public/og.jpg` is 1200×630 and `og:image` is absolute. Checking the Messenger link preview needs the live site, so it moves to T1.11.

- [x] **T1.10 Terms and Privacy** (written as drafts before the exit terms are settled, the user's call)
  - Notes: `src/config/legal.ts` (re-exported from `site.ts`) rendered by `SimplePages.tsx`; 10 PLACEHOLDER markers, each a visible "[to be decided]" or the draft notice; `SimplePages.test.tsx`. The review consent no longer promises first names only. Reviewer: PASS (round 2; round 1 caught a privacy line that called published reviews private).
  - Do: real `/terms` (the standard offer: fees, invoices, grace and suspension, what's never billed) and `/privacy` (what the contact and review forms collect, why, how long, who to ask).
  - Depends: SPEC §7 exit terms settled
  - Files: `src/routes/SimplePages.tsx` (or one file per page), `src/config/site.ts`
  - Acceptance: terms match SAAS-PLAN §1 and the "At a glance" sheet; the contact form's consent links to `/privacy`.

- [x] **T1.11a Real values the user has given** (split from T1.11 on 2026-10-29: the values decided so far)
  - Notes: values in `site.ts` and `legal.ts` (`provider` exported and shared with "At a glance"); tests in `SimplePages.test.tsx`, `content.test.ts`, `sections.test.tsx`, `Footer.test.tsx`, new `Nav.test.tsx`. README "Before launch" trimmed. Reviewer: PASS (the Handoff and README drift fixed).
  - Do: set the values in SPEC §6 (2026-10-29): support email, Messenger and Facebook links; in the Terms and Privacy, the provider, the PayMongo key wording, how a suspension is lifted, the fee-change notice, the exit terms, the lead retention, the Gmail inbox, and the governing law (no longer a placeholder). Add "Provider" and "Leaving" rows to the "At a glance" sheet. `bookCallUrl` stays empty and the demo venue stays the only venue (the user's call), so their PLACEHOLDER notes stay.
  - Depends: T1.9, T1.10
  - Files: `src/config/site.ts`, `src/config/legal.ts`, `src/routes/SimplePages.test.tsx`
  - Acceptance: no "[to be decided]" text left on `/terms`; `/privacy` states the 1-year retention and names no undecided period; "Message us" opens Messenger; the footer shows the Facebook link; the Terms and the "At a glance" sheet agree on the provider and leaving; the only PLACEHOLDER markers left are `bookCallUrl`, the venue list, the draft notice and the email service's name.

- [ ] **T1.11b Remaining placeholders**
  - Do: `bookCallUrl`, real venues (with permission) and logos, the name of the email service that sends new-lead alerts (court-booking-system SAAS-PLAN Phase 0), a legal review of both pages before the draft notice comes off, `VITE_TURNSTILE_SITE_KEY` for production, and the booking fee if it changes. Checked by hand, as they carry no marker: real reviews (sent through `site-review` once it's live), the Messenger link preview of `og.jpg` on the live site, and the production env vars.
  - Depends: T1.11a; the user's values
  - Files: `src/config/site.ts`, `src/config/legal.ts`, `index.html`, `public/`, deploy env vars
  - Acceptance: `grep -rn PLACEHOLDER src index.html` finds nothing; T1.9's and T1.10's acceptance hold with real values.
