# CLAUDE.md

Landing and owner sign-up site for a court booking product. See [README.md](README.md). Behavior: [SPEC.md](SPEC.md); plan and handoff: [TASKS.md](TASKS.md); findings: [RESEARCH.md](RESEARCH.md).

## Stack
- Vite 8, React 19, TypeScript 6 (strict), React Router 7, TanStack Query
- Supabase: Postgres, Auth, Edge Functions (Deno), through `@supabase/supabase-js`
- ESLint (flat config), Vitest + Testing Library (jsdom), pgTAP for database tests

## Commands
```bash
npm run dev / build / lint / test
npm run verify            # typecheck + lint + test + build: run before calling work done
npm run test:db           # pgTAP against the local db
npm run db:start / db:stop / db:reset:local
npm run functions:serve   # local Edge Functions
npm run db:push / db:types
```
Supabase CLI is a pinned dev dependency: use `npx supabase <cmd>`. Local ports are 553xx.

## Rules
- Visitor-facing copy lives in `src/config/site.ts`, not in components.
- Validation rules live in `supabase/functions/_shared/validate.ts`, shared by the forms and the
  Edge Functions. Keep its limits in step with the CHECK constraints in the migration.
- Every schema change is a new migration; never edit applied ones. RLS on every table with explicit
  policies; triggers and helpers live in the `private` schema. Add pgTAP tests in `supabase/tests/database/`.
- Data access: plain async functions in `features/<area>/api.ts`, wrapped by React Query hooks in
  `features/<area>/hooks.ts`. No Supabase calls inline in JSX.
- Only the publishable key goes in `VITE_*` vars. The service-role key is used only inside Edge Functions.
- Mobile-first; every async view handles loading, empty and error states.

## Workflow
- `/implement [T1.1 | milestone | request]` builds a task end to end (plan gate for DB/auth work, verify, `reviewer` agent).
- A Stop hook (`.claude/hooks/verify-gate.mjs`) blocks finishing while `npm run verify` fails.
- Update the TASKS.md Handoff section at the end of each task; update SPEC.md when behavior changes.
- Never run two test runs at once: they share the local database.
