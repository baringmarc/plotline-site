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
- Pricing copy must match SAAS-PLAN §1: free for venues, a ₱10 booking fee per confirmed online booking, paid by the player. No free trial, no self-serve sign-up. The amount isn't final.

## Stack
- Vite 8, React 19, TypeScript 6 (strict), React Router 7, TanStack Query
- Supabase through `@supabase/supabase-js`, with the **publishable key only**
- ESLint (flat config), Vitest + Testing Library (jsdom)

## Commands
```bash
npm run dev / build / lint / test
npm run verify            # typecheck + lint + test + build: run before calling work done
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
- `/implement [T1.1 | milestone | request]` builds a task end to end (plan gate for DB/auth work, verify, `reviewer` agent), then commits it (never pushes) once verify passes and the reviewer signs off.
- A Stop hook (`.claude/hooks/verify-gate.mjs`) blocks finishing while `npm run verify` fails.
- Update the TASKS.md Handoff section at the end of each task; update SPEC.md when behavior changes.
- Never run two test runs at once: they share the local database.
