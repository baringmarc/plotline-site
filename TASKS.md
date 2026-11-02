# TASKS.md

The working plan. [SPEC.md](SPEC.md) says **what** the site does; this file says **what to build next**
and tracks progress. [RESEARCH.md](RESEARCH.md) holds the technical findings behind the tasks.

## Handoff

> Update this section at the end of every session or task. Keep it short; it's the first thing the next session reads.

- **Current milestone:** Milestone 2, Easier to read (planned 2026-11-02; T2.1–T2.3 done, T2.4–T2.6 to do). Milestone 1 is complete.
- **Next task:** T2.4 (player's side, short version, Getting started); design in the "Full Page Redesign" artifact linked under Milestone 2. Milestone 1 leftovers: replace the drawn player-side frames (`PlayerScreens.tsx`) once staging shows the ₱10 fee at checkout; delete `vercel.json` once nothing deploys there.
- **State:** T2.3 done 2026-11-02 ("Your side": `.side-split`, items beside a drawn Today grid; "Your venue": `.venue-split`, drawn browser frame with four callouts beside a numbered list; drawings in `Illustrations.tsx`; `vitest.config.ts` now lets a test read `global.css`). T2.2 done 2026-11-02 (one Pricing section, "At a glance" with key figures right after it). T2.1 copy pass done 2026-11-02 (copy shortened and regrouped in `site.ts`; visuals start in T2.2; "At a glance" lost its ₱0 setup and monthly rows until T2.2 adds the key figures). T1.1–T1.10 and T1.11a done (T1.8 done 2026-11-02: the old backend is removed). T1.11a set the user's values (SPEC §6, 2026-10-29): support email `plotline.admin1@gmail.com`, Messenger and Facebook links, "Provider" and "Leaving" rows in "At a glance", and the Terms and Privacy text (provider Plotline, PayMongo key handling, suspension lifted on payment, 1 week's fee notice, exit terms, 1-year lead retention). T1.11b code is done (2026-11-02): `bookCallUrl` stays empty and the venue list stays demo-only (the user's call), `wrangler.jsonc` + `src/worker.ts` (www → apex, tested) + `cf:deploy` + `.env.production` (public production values and the Turnstile site key) + `public/robots.txt`. Launch steps (all done and passed 2026-11-02 except (6)): (1) `npx wrangler login`, DNS for the apex and `www` proxied, `npm run cf:deploy`; (2) check the live site and send one real contact form; (3) re-scrape in Facebook's Sharing Debugger (it got 403 on the empty page; if it still does, a Cloudflare WAF/bot rule blocks `facebookexternalhit`); (4) send and approve a test review; (5) test `/admin/courts/:id` on a phone; (6) when staging shows the ₱10 fee at checkout (production is set to 10), tell me and I replace the drawn player-side frames. The email service (Resend) is named and the draft notice is off (2026-11-02, from court-booking-system). The contact form posts to `site-contact` and reviews to `site-review`, both live on the shared project since 2026-11-01.
- **Blockers / notes:** The leaving terms and the 1-week fee notice (T1.11a) should be added to court-booking-system SAAS-PLAN §1, where the business terms are decided. The user's rule (2026-10-27): anything still to be decided or provided gets a placeholder now, and T1.11 collects the real values. Open from T1.7: none (`bookCallUrl` stays empty; the Turnstile site key is in `.env.production`). PLATFORM.md §4 should list the 503 reply that the drafted `site-contact` sends when its Turnstile secret is unset (a court-booking-system change). The owner cards leave out staff accounts (admins are promoted by hand, no staff UI) and booking alerts (emails off in production); add them only once they ship. "Run your courts from your phone" assumes the admin pages work on a phone; check `/admin/courts/:id` (the rate grid) when real screenshots are taken. The player's side steps 3–5 are drawn placeholders (`PlayerScreens.tsx`). Replace them with real screenshots once court-booking-system M11 shows the ₱10 fee at checkout, from a booking made on staging or the local stack, not production. `claudex-courts.plotline.fit` doesn't resolve yet; the demo button keeps it (the user's call). Open items for launch are in README "Before launch".
- **Update (2026-11-01):** added "no limit on courts" and a `Highlights` section (6 cards, SPEC §3.1 row 4b); see SPEC §6. Colour presets deliberately not mentioned. The contact form still caps courts at 50. Ideas left for later: PayMongo detail, waiver at checkout, late-night/24h hours, the server-side double-booking guarantee.
- **Platform (2026-10-27):** this repo becomes frontend only. The backend moves to `court-booking-system` (its `docs/PLATFORM.md`; Phase 5 is live). Plan new milestones around the contact form, not the old sign-up and trial, and never add migrations or Edge Functions here.

## How tasks work

- Only the **current milestone** is broken into tasks. Later milestones stay one-liners.
- Tasks run **in order** unless `Depends` says otherwise. Each task should fit in one focused session.
- Status: `[ ]` todo, `[~]` in progress, `[x]` done, `[-]` dropped (say why).
- **Definition of done** (all required before ticking a box):
  1. Every acceptance criterion holds.
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

- [x] **T1.8 Remove the old sign-up and backend**
  - Notes: deleted `supabase/` (tracked files), `docs/drafts/phase5/`, `WelcomePage` and its route, `trialDays`, `courtOptions` and the `db:*`/`functions:serve`/`test:db` scripts; `src/lib/database.types.ts` regenerated from the shared staging project (`SUPABASE_PROJECT_REF=avhxinkecylhptysgbjx npm run db:types`). `grep -ri trial src` now only matches tests that assert the word is absent. Reviewer: PASS. No new tests (removal only).
  - Follow-ups (user, harness is protected): `scripts/with-lock.mjs` is unused; `.claude/harness.json` comment, `reviewer.md` and `guard.mjs` still mention `test:db`/pgTAP. Gitignored leftovers in `supabase/` (`.temp` links this checkout to the shared project, `functions/.env`) can be deleted by hand.
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

- [x] **T1.11b Remaining placeholders**
  - Notes (2026-11-02): done. The user deployed to Cloudflare and the launch checks passed (live site, contact form, test review, Facebook scrape, Messenger preview). Facebook's 403 was a Cloudflare skip rule for `facebookexternalhit`/`Facebot`/`meta-externalagent` plus Facebook's cached failure. The leaving terms and the 1-week notice were copied into court-booking-system SAAS-PLAN §1 (uncommitted there). The 50-court form limit stays (the user's call). Resend is named and the draft notice is off (earlier commit).
  - Do: `bookCallUrl`, real venues (with permission) and logos, `VITE_TURNSTILE_SITE_KEY` for production, and the booking fee if it changes. Checked by hand, as they carry no marker: real reviews (sent through `site-review` once it's live), the Messenger link preview of `og.jpg` on the live site, and the production env vars.
  - Depends: T1.11a; the user's values
  - Files: `src/config/site.ts`, `src/config/legal.ts`, `index.html`, `public/`, deploy env vars
  - Acceptance: `grep -rn PLACEHOLDER src index.html` finds only the two values the user chose to leave (`bookCallUrl` empty, the venue list demo-only; SPEC §6 2026-11-02); T1.9's and T1.10's acceptance hold with real values.

## Milestone 2: Easier to read

One-liner: the landing page below the hero has too much text in sections that look alike. Keep the content, cut the repetition, and carry the weight with a few visuals. Design reference (agreed with the user 2026-11-02, public): [Plotline Full Page Redesign](https://claude.ai/artifact/PLn4Lwnm4LMBfjUhhZMtTC). Front end only: no migrations, functions or contract change. Pricing wording must keep passing `npm run check:drift`.

Decisions from the design review (2026-11-02):
- Remove the hero stat tiles (₱0 / ₱10); the pricing section shows them.
- The cost story is told in one place (Pricing). "The short version" becomes a slim card that links to it; the FAQ keeps only the money answers owners ask.
- "At a glance" becomes its own short section right after Pricing, always open, not collapsed and not inside Pricing.
- Keep the "A flat fee vs a percentage" table; the line chart was dropped as harder to read.
- Player's side keeps the page background; only the five phone screens use the app's dark theme, for contrast.
- Sequences (money flow, Getting started) share one vertical/horizontal timeline style.
- Section order stays as today except "At a glance" moves up next to Pricing (SPEC §3.1 to be updated in T2.6).

Order: copy first (cheap, safe, shows how much visual work is still needed), then visuals.

- [x] **T2.1 Copy pass**
  - Notes (2026-11-02): tests in `sections.test.tsx` (word caps, FAQ groups, "paid by the player" limit, claims kept on the page, swapped fee over all sections), `content.test.ts`, `SimplePages.test.tsx`. Config shapes: `faqGroups`, `atAGlance.groups`, `featuresAlso`, `highlightsAlso`; `hero.stats` and the short version's cost card are gone. Components render them plainly; T2.2–T2.5 add the visuals. The acceptance wording was clarified (see below).
  - Do: in `site.ts`, shorten the long bodies and say each pricing fact once. Merge `shortVersion` into the slim card (one line on cost, the 8 "what you get" items as short chips). Tighten `highlights` and `features` to one line each (3 headline items plus a short "also" list for each). Regroup `faqs` into Players, Money and Your setup (3 each) and tighten the answers by about a third. Drop the hero `stats`. Move the "Provider" and "Leaving" rows into the new "At a glance" groups. Keep every claim that is a shipped feature (SPEC §3.1 "Feature claims"): nothing is deleted without a home elsewhere on the page.
  - Depends: none
  - Files: `src/config/site.ts`, `src/features/landing/sections.test.tsx`, `src/config/content.test.ts`
  - Acceptance (reading confirmed by the user 2026-11-02): "body copy" = the text of a section's `<p>` elements (the FAQ per group), at most 90 words; the sentence "paid by the player" appears in at most two sections (the amount itself also sits in the hero, the short version, the player's pay step and "At a glance", as the agreed design shows it); every amount still comes from `pricing`; `npm run check:drift` passes; Terms and "At a glance" still agree on provider and leaving; tests cover the word caps and the FAQ groups.

- [x] **T2.2 Pricing section and "At a glance"**
  - Notes (2026-11-02): `Costs` is now the whole Pricing section (tiles, visible "Never billed" row, stacked-bar worked example, table, `Timeline` for the money flow, CTA); `MoneyFlow` and its dark band are gone. `AtAGlance` has four `keyFigures` and sits right after Pricing. Shared `.timeline` CSS is ready for T2.4. Tests in `sections.test.tsx` and new `src/routes/LandingPage.test.tsx`. Reviewer: PASS (the visible-label major fixed). Layout (360/1280px, both themes) was checked from the CSS only: headless Chrome would not render below ~500px wide, so look at it by eye.
  - Follow-ups: `#at-a-glance` and `#venues` are now two plain sections in a row; settle the background rhythm in T2.6's whole-page check.
  - Do: rework `Costs` and `MoneyFlow` into one Pricing section: the two stat tiles, a "never billed" row, the worked example as a stacked bar (the fee drawn at a readable minimum width, with a "not to scale" note), the flat vs percentage table as today, and "Where the money goes" as a four-step timeline (stacked on phones, a row from 760px). Restyle `AtAGlance` as its own section after it: four key figures (including the ₱0 setup and ₱0 monthly that T2.1 took out of its rows) and the three groups already in config. The hero stat tiles went in T2.1.
  - Depends: T2.1
  - Files: `src/features/landing/sections.tsx`, `src/features/landing/pricing.ts`, `src/routes/LandingPage.tsx`, `src/styles/global.css`, `src/features/landing/sections.test.tsx`
  - Acceptance: the "Fee" label fits its bar at 360px and 1280px; the bar's total equals `workedExample()`; the table rows come from `feeComparison()`; the nav "Pricing" anchor still works; light and dark themes both correct; no horizontal scroll at 360px; a ₱15 fee replaces every ₱10 (existing test extended to the new markup).

- [x] **T2.3 "Your side" and "Your venue"**
  - Notes (2026-11-02): tests in `Illustrations.test.tsx`, `sections.layout.test.tsx`, `sections.test.tsx`. Reviewer: PASS. Layout at 360px and both themes checked from the CSS only; look by eye. Follow-up: SPEC §3.1 layout wording goes in T2.6.
  - Do: make the two sections look different from each other. "Your side": three headline items beside a drawn "Today" grid with a payment-proof card, plus chips for the rest. "Your venue": a drawn browser frame of a venue page with four numbered callouts, the numbered list beside it, and chips for what players also get. Drawn with CSS and inline SVG from the site's tokens, no new image assets.
  - Depends: T2.1
  - Files: `src/features/landing/sections.tsx`, a new `src/features/landing/Illustrations.tsx`, `src/styles/global.css`, `site.ts`
  - Acceptance: the two sections use different layouts; decorative drawings have `aria-hidden` or a text alternative; every feature claim from T2.1 is still on the page; correct in both themes; no horizontal scroll at 360px.

- [ ] **T2.4 Player's side, short version, Getting started**
  - Do: show the five player screens in the app's dark theme on the normal page background, at the screenshots' natural proportions (five columns from 1000px, a swipe row below). Turn open play into a one-line strip. Build the slim "short version" card and move "Getting started" onto the same timeline as the money flow.
  - Depends: T2.1, T2.2 (shared timeline style)
  - Files: `src/features/landing/sections.tsx`, `src/features/landing/PlayerScreens.tsx`, `src/styles/global.css`, `public/screens/`
  - Acceptance: the five screens read clearly against the light section; the first two use real dark-mode screenshots of the demo venue if the demo is reachable, otherwise drawn dark screens (note it in the Handoff); alt text kept; the player-side open item (real fee screens from staging) stays in the Handoff.

- [ ] **T2.5 FAQ in groups**
  - Do (T2.1 already renders three labelled groups and opens the first answer of each): show the FAQ as three tabs (Players, Money, Your setup) with the first answer of each open; keyboard accessible (`role="tablist"`, arrow keys); the answers stay readable with JavaScript off.
  - Depends: T2.1
  - Files: `src/features/landing/sections.tsx`, `src/styles/global.css`, `src/features/landing/sections.test.tsx`
  - Acceptance: tabs switch with click and arrow keys; all nine questions are reachable; with JS off every answer is visible; tests cover tab switching.

- [ ] **T2.6 Close-out**
  - Do: update SPEC.md (§3.1 section order and rows, a decisions-log row for the 2026-11-02 choices), README, and the Handoff; run the L1 grep for the terms this milestone removed (hero stats, short version cards, the line chart). Check the whole page at 360, 768 and 1280px in both themes, and run `/retro`.
  - Depends: T2.1–T2.5
  - Files: `SPEC.md`, `README.md`, `TASKS.md`
  - Acceptance: `npm run verify` and the full gate pass; the page matches the artifact apart from the stand-in reviews and form; the reviewer reports no blocking issues.

## Retro follow-ups

- [ ] **T1.12 Reviewer stays read-only without being blocked**
  - Why: the guard blocked the reviewer's compound or piped shell commands 10 times across T1.11a, T1.8 and T1.11b (/retro M1).
  - Do: in `.claude/agents/reviewer.md`, tell the reviewer to use Read, Grep and Glob, and single read-only commands (no `cd &&` chains, loops or pipes into other commands). This file is protected by the guard, so the user makes or approves the edit.
  - Depends: none
  - Files: `.claude/agents/reviewer.md`
  - Acceptance: a review run of a multi-file diff logs no `reviewer-readonly` guard events.
