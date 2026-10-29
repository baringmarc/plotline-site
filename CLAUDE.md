# CLAUDE.md

Plotline's marketing site (target: `https://plotline.fit`). Venue owners read about Plotline, see the demo and reviews, and send the contact form. See [README.md](README.md). Behavior: [SPEC.md](SPEC.md); plan and handoff: [TASKS.md](TASKS.md); findings: [RESEARCH.md](RESEARCH.md).

## Platform (read first)
- Plotline is two repositories. **This one is only the marketing frontend.** The product, the database, every Edge Function, the SaaS plan and the brand guide live in [`court-booking-system`](https://github.com/baringmarc/court-booking-system), locally at `../court-booking-system`.
- **Its `docs/PLATFORM.md` is the single source of truth** for what this site depends on:
  - the domains and Supabase projects;
  - the `site-contact` and `site-review` Edge Functions (fields, rules, replies);
  - the public reads (`reviews`, and later `public_venues`);
  - the env vars.

  Read it before changing anything that talks to Supabase. To have it in a Claude Code session: `claude --add-dir ../court-booking-system`.
- **Never add migrations, Edge Functions or database tests here.** All backend work happens in court-booking-system. Two repos pushing migrations to the same Supabase project break each other's migration history.
- **Transitional (until SAAS-PLAN Phase 5):** this repo still holds its original local-only backend (`supabase/` with `venue_signups`, `reviews`, the `register` and `feedback` functions). It was never deployed and must not be. Phase 5 moves it to court-booking-system as `leads`/`reviews` and `site-contact`/`site-review` (this repo's side is drafted in `docs/drafts/phase5/`), and then `supabase/migrations`, `supabase/functions` and `supabase/tests` are deleted here.
- `src/lib/siteForms.ts` (after Phase 5) is an **exact copy** of court-booking-system's `supabase/functions/_shared/siteForms.ts`, used only for instant form feedback. The server's check is the one that counts. Never edit the copy on its own; change the original, then copy it over.
- The brand (palette, Fraunces and DM Sans, logo) follows court-booking-system's `docs/BRAND.md`.
- Pricing copy must match court-booking-system's `docs/facts.json` (decided in SAAS-PLAN §1): free for venues, a booking fee per confirmed online booking, paid by the player. No free trial, no self-serve sign-up. The amount isn't final. `src/config/pricing.ts` holds the amount for the page; `npm run check:drift` fails if it, or any doc here, disagrees with facts.json (it needs `../court-booking-system` checked out, and skips otherwise).

## Stack
- Vite 8, React 19, TypeScript 6 (strict), React Router 7, TanStack Query
- Supabase through `@supabase/supabase-js`, with the **publishable key only**
- ESLint (flat config), Vitest + Testing Library (jsdom)

## Commands
```bash
npm run dev / build / lint / test
npm run verify            # typecheck + lint + test + build + check:drift
node .claude/hooks/verify-gate.mjs --full   # the full gate: run before calling work done; commits need it
npm run db:types          # after Phase 5: types from the shared project (see README)
```
Until Phase 5 the old local backend scripts still exist (`db:start`, `functions:serve`, `test:db`, local ports 553xx). Use them only to run the site locally. Don't extend them.

## Rules
- Visitor-facing copy lives in `src/config/site.ts`, not in components.
- Data access: plain async functions in `features/<area>/api.ts`, wrapped by React Query hooks in `features/<area>/hooks.ts`. No Supabase calls inline in JSX. Forms call Edge Functions through `lib/functions.ts`.
- Only the publishable key and the Turnstile site key go in `VITE_*` vars. No service-role key in this repo, ever.
- Mobile-first; every async view handles loading, empty and error states.
- If a change needs a new field, function or table, it's a contract change: follow court-booking-system's `docs/PLATFORM.md` §7 (the platform repo first, then here).

## Workflow
- `/implement [T1.1 | milestone | request]` builds a task end to end (plan gate for DB/auth work, `test-writer` agent writes the failing tests, build, full verify, `reviewer` agent), then commits it (never pushes) once verify passes and the reviewer signs off. Milestone mode ends with `/retro`, which turns repeated mistakes into the **Learned rules** below (with the user's approval).
- **Fast gate (Stop hook, `.claude/hooks/verify-gate.mjs`):** you can't finish a turn while typecheck, lint or the unit tests fail.
- **Full gate:** `node .claude/hooks/verify-gate.mjs --full` runs `npm run verify`. **`git commit` is refused until it has passed on exactly the current changes.**
- **Guard (PreToolUse hook, `.claude/hooks/guard.mjs`)** blocks before the fact: editing applied migrations, adding `.skip`/`.only` or removing assertions from tests, editing the test-writer's locked tests, secrets under `src/`, force pushes, `reset --hard`, amends, resetting a remote database, and edits to the harness itself (`.claude/hooks`, `settings.json`, `harness.json`, the ESLint config). If a block seems wrong, stop and ask the user rather than working around it.
- Gate failures, guard blocks, reviewer findings and escalations are logged to `.claude/retro/failures.jsonl` (append-only; log with `node .claude/hooks/log-event.mjs`). `/retro` reads it.
- Update the TASKS.md Handoff section at the end of each task; update SPEC.md when behavior changes.
- `test:db` takes a lock (`scripts/with-lock.mjs`), so a second test run waits for the first instead of sharing the local database.

## Learned rules
Lessons from repeated mistakes, added by `/retro` with the user's approval. Follow them like any rule above. Each lists the mistake categories it covers; `/retro` promotes a rule to a hard check if its mistake keeps happening anyway.

_(none yet)_
