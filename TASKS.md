# TASKS.md

The working plan. [SPEC.md](SPEC.md) says **what** the site does; this file says **what to build next**
and tracks progress. [RESEARCH.md](RESEARCH.md) holds the technical findings behind the tasks.

## Handoff

> Update this section at the end of every session or task. Keep it short; it's the first thing the next session reads.

- **Current milestone:** Milestone 1, Launch readiness (broken down 2026-10-27).
- **Next task:** T1.2 Pricing config, hero and the short version. T1.2–T1.6 need nothing from the platform; T1.7 waits for `site-contact`.
- **State:** T1.1 done: page patterns in place and used on Features. The dark section, stat tiles, ✕ lists and fact sheet are styled but not used yet (T1.2, T1.3, T1.6). The rest of the page still has the old trial and plan copy.
- **Blockers / notes:** Docker Desktop must be running for `npm run test:db`. Open items for launch are in README "Before launch".
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

- [ ] **T1.2 Pricing config, hero and the short version**
  - Do: add one `pricing` object to `site.ts` (booking fee, currency, what's not billed) that every pricing sentence and number reads from. Rewrite the hero (promises, ₱0/₱10 stat tiles, CTA, demo link) and add "The short version" (what you get free / what it costs + ✕ list + "we never hold your money").
  - Depends: T1.1
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/routes/LandingPage.tsx`, `src/styles/global.css`
  - Acceptance: no trial, sign-up or monthly-plan wording in the hero or the short version; changing `pricing.bookingFee` changes every amount shown in them; claims match the SPEC §3.1 pricing list; `site.demoUrl` is `https://claudex-courts.plotline.fit`.

- [ ] **T1.3 What it costs and where the money goes**
  - Do: replace `Pricing` (and the `plans`/`openPlayAddon` config) with "What it costs" (stat tiles, worked example, flat vs illustrative percentage table) and add "Where the money goes" (4-step flow, never-billed list, monthly invoice). Compute the tables with a pure function from `pricing` and a list of example court prices in config. Mid-page CTA after it.
  - Depends: T1.2
  - Files: `src/config/site.ts`, `src/features/landing/pricing.ts` (+ `pricing.test.ts`), `src/features/landing/sections.tsx`, `src/styles/global.css`
  - Acceptance: `plans` and `openPlayAddon` are gone (the sign-up form's add-on box goes with them); the percentage column is labelled as an illustration, not a competitor's price; the tables are readable at 360px (stacked or scrolling inside their card, not the page); tests cover the example and table maths.

- [ ] **T1.4 The player's side**
  - Do: a 5-step walkthrough with captioned screenshots taken from the live demo (find a slot → pick → pay the venue → confirmation → reminder). Open play as one step or a callout. Replaces `Audiences` and the `OpenPlay` band.
  - Depends: T1.1
  - Files: `public/screens/*.webp`, `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/styles/global.css`
  - Acceptance: images have width/height and alt text, lazy-load below the fold, and stay under ~120 KB each; swipeable on phones, a row or grid on desktop; screenshots show the ₱10 fee at checkout once court-booking-system M11 is live (placeholder frames until then, noted in the Handoff).

- [ ] **T1.5 Your side**
  - Do: rewrite `Features` as owner feature cards (slot grid, bookings on your phone, proof approval, peak and off-peak rates, blackouts, staff accounts, earnings). Only features the product has, or will have at launch.
  - Depends: T1.1
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`
  - Acceptance: no walk-in feature; each card checked against court-booking-system's current features (list any doubtful ones in the Handoff).

- [ ] **T1.6 Getting started, FAQ, at a glance, final band**
  - Do: `Steps` becomes the 4 setup steps; rewrite the FAQ around objections (unpaid bookings, cancellations, PayMongo fees, no app for players, changing rates, open play, staff logins); add the "At a glance" fact sheet; update the final band and the nav CTA to `#contact`. Put the sections in the SPEC §3.1 order and update the README section table.
  - Depends: T1.2, T1.3
  - Files: `src/config/site.ts`, `src/features/landing/sections.tsx`, `src/routes/LandingPage.tsx`, `src/components/Nav.tsx`, `README.md`
  - Acceptance: no trial or plan wording left anywhere on `/` except inside the old sign-up form (T1.7); exit-terms rows are left out until SPEC §7 settles them; nav links point at sections that exist.

- [ ] **T1.7 Contact form** (waits for the platform's `site-contact`)
  - Do: apply `docs/drafts/phase5/` (siteForms copy, `features/contact/api.ts`, reviews api, env example). Turn `SignupForm` into `ContactForm` at `#contact` with the PLATFORM.md fields, one consent checkbox, Turnstile and the honeypot. The message placeholder asks for the best time to call and an in-person or online walkthrough. Thank-you state with an optional "book a call" link from `site.ts`.
  - Depends: court-booking-system Phase 5 deployed to staging; T1.6
  - Files: `src/lib/siteForms.ts`, `src/features/contact/*`, `src/features/reviews/api.ts`, `src/config/site.ts`, `.env.example`
  - Acceptance: fields and replies (200/400/403/500) match PLATFORM.md §4, each with its own message; `siteForms.ts` is byte-identical to the platform's; tests cover validation, a successful send and each error reply.

- [ ] **T1.8 Remove the old sign-up and backend**
  - Do: delete `features/signup`, `/welcome`, `trialDays` and `courtOptions` if unused, `supabase/migrations`, `supabase/functions`, `supabase/tests`, the old `db:*`/`functions:serve` scripts and `docs/drafts/phase5/`. Add `db:types` from the shared project.
  - Depends: T1.7
  - Files: as listed, `package.json`, `README.md`, `CLAUDE.md`
  - Acceptance: `grep -ri "trial" src` finds nothing; `npm run verify` passes; README and CLAUDE.md no longer describe the transitional backend.

- [ ] **T1.9 Real content and assets**
  - Do: real support email, Messenger and Facebook links, real venues (with permission) and logos, real reviews seeded through `site-review`, page title, description and share image.
  - Depends: T1.6
  - Files: `src/config/site.ts`, `index.html`, `public/`
  - Acceptance: no `example.com`, `your-page` or "Sample" values left; the share image renders in Messenger's link preview.

- [ ] **T1.10 Terms and Privacy**
  - Do: real `/terms` (the standard offer: fees, invoices, grace and suspension, what's never billed) and `/privacy` (what the contact and review forms collect, why, how long, who to ask).
  - Depends: SPEC §7 exit terms settled
  - Files: `src/routes/SimplePages.tsx` (or one file per page), `src/config/site.ts`
  - Acceptance: terms match SAAS-PLAN §1 and the "At a glance" sheet; the contact form's consent links to `/privacy`.
