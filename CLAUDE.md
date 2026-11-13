# CLAUDE.md

Plotline's marketing site (target: `https://plotline.fit`). Venue owners read about Plotline, see the demo and reviews, and send the contact form. See [README.md](README.md). Behavior: [SPEC.md](SPEC.md); plan and handoff: [TASKS.md](TASKS.md); findings: [RESEARCH.md](RESEARCH.md).

## Platform (read first)
- Plotline is two repositories. **This one is only the marketing frontend.** The product, the database, every Edge Function, the SaaS plan and the brand guide live in [`court-booking-system`](https://github.com/baringmarc/court-booking-system), locally at `../court-booking-system`.
- **Its `docs/PLATFORM.md` is the single source of truth** for what this site depends on:
  - the domains and Supabase projects;
  - the `site-contact` and `site-review` Edge Functions (fields, rules, replies);
  - the public reads (`reviews` and `public_venues`);
  - the env vars.

  Read it before changing anything that talks to Supabase. To have it in a Claude Code session: `claude --add-dir ../court-booking-system`.
- **Never add migrations, Edge Functions or database tests here.** All backend work happens in court-booking-system. Two repos pushing migrations to the same Supabase project break each other's migration history.
- `src/lib/siteForms.ts` is an **exact copy** of court-booking-system's `supabase/functions/_shared/siteForms.ts`, used only for instant form feedback. The server's check is the one that counts. Never edit the copy on its own; change the original, then copy it over.
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
SUPABASE_PROJECT_REF=<ref> npm run db:types   # types from the shared project (see README)
```
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

## Learned rules
Lessons from repeated mistakes, added by `/retro` with the user's approval. Follow them like any rule above. Each lists the mistake categories it covers; `/retro` promotes a rule to a hard check if its mistake keeps happening anyway.

- **L1** Bring the docs up to date before the reviewer runs: follow `/implement` step 7 (Docs), not the Close step. _Why:_ the reviewer blocked three tasks for stale docs, and four more after this rule was added, until the Handoff was updated before review. _(categories: docs-drift; added 2026-11-02 from /retro M1; moved into `/implement` step 7 by T1.13, 2026-11-13)_
- **L2** Only the user changes a task's Acceptance. If a criterion can't hold, or the user changes a decision mid-task, ask first. Then write the new wording into Acceptance marked `(user, <date>)` and add a SPEC §6 row. Re-launch the `test-writer` in dispute mode for the affected tests before building, not after. _Why:_ four acceptance blockers and four "test fixed" disputes in M2 came from mid-task decisions that weren't written down. _(categories: acceptance-unmet, dispute; added 2026-11-10 from /retro M2)_
- **L3** When Acceptance needs a check only the user can do (by eye, a real device, a deploy), ask for it as soon as the build is checked in a browser, before launching the reviewer, and record it as `By-eye check (user, <date>)`. If the check needs a deploy, agree with the user at the plan step whether it happens before or after the commit, and write that into Acceptance. _Why:_ four review blockers in M4–M5 were user checks still waiting at review time. _(categories: acceptance-unmet; added 2026-11-13 from /retro M5)_
