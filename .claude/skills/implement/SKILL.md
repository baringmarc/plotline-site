---
name: implement
description: Implement the next task from TASKS.md (or a given task, or the whole current milestone) end to end. Orient, research, plan (pausing for approval on risky DB/security work), build, verify, get a reviewer verdict, then tick the task and update the handoff.
argument-hint: "[T1.1 | milestone | <ad-hoc request>]"
disable-model-invocation: true
---

# /implement

Arguments: `$ARGUMENTS`

- empty: the **Next task** from the TASKS.md Handoff section
- a task ID such as `T1.1`: that task
- `milestone`: do the next task, then keep going until the current milestone is done or a stop condition below is hit
- any other text: an ad-hoc request. Skip the TASKS.md steps (tick, handoff), but keep the rest.

Follow these steps in order for each task. Don't skip any of them.

## 1. Orient

- Read the TASKS.md Handoff section and the target task (its Do, Depends, Files and Acceptance).
- Read the SPEC.md sections the task touches and any related RESEARCH.md entries.
- Run `git status --short` and note which files were already changed before you start. They're out of scope for this task's review.
- **Stop and tell the user** if any of these is true:
  - a dependency isn't `[x]`
  - the task is already `[x]`
  - the Handoff section lists a blocker that affects this task
  - the current milestone has no task breakdown yet. Propose one in the TASKS.md format, researching first, and wait for approval.
- Mark the task `[~]` and set **Next task** in the Handoff section to this task.

## 2. Research

- If the task depends on RESEARCH.md entries that are still `Open`, fill them in first. Every finding needs a source, or the SQL or command you ran.
- Record choices that change behavior in SPEC §6.
- If research shows the task is wrong or too big, update or split it in TASKS.md, say so, and continue with the first part.

## 3. Plan gate

A task is **risky** if it does any of these:

- adds or changes a migration, RLS policy, grant, trigger, Edge Function or auth flow
- runs `npm run db:push`
- deviates from SPEC

For a risky task, pause and show the user a short plan: the files you'll touch, the approach (with a sketch of key SQL: constraints, function signatures, grants), how you'll prove each acceptance criterion, and that `npm run db:push` will apply it to the **linked remote project**. Ask for approval with AskUserQuestion and wait. Approving the plan also approves `db:push` for that migration.

For anything else, state your plan in two or three lines and continue.

## 4. Build

- Follow every rule in CLAUDE.md. Write the code the task needs and nothing from later tasks.
- Visitor-facing copy goes in `src/config/site.ts`; validation in `supabase/functions/_shared/validate.ts`.
- Logic modules: Vitest tests next to the module. Components: Testing Library tests where behavior matters, mocking `features/<area>/api.ts`, never the network.
- Database changes:
  1. `npx supabase migration new <name>`. Never edit a migration that already exists in `HEAD`.
  2. Write pgTAP tests in `supabase/tests/database/NN_<area>.test.sql`, following `01_landing.test.sql`: a transaction, `plan(n)`, acting as anon and authenticated, then `rollback`. Run `npm run test:db` until green locally.
  3. Only then `npm run db:push`, followed by `npm run db:types`.
- If behavior changed, update SPEC.md.

## 5. Verify

- Run `npm run verify` and fix failures until it passes. Never weaken, skip or delete tests or lint rules. The Stop hook re-runs verify anyway.
- Never run two test runs at once: they share the local database. Check `pgrep -fl "[v]erify-gate"` is empty first.
- For UI changes, check loading, empty and error states and the mobile layout.

## 6. Review

- Launch the `reviewer` agent in the foreground. Give it the task ID (or request), the files this task created or changed, the files that were already dirty before you started, and the pgTAP files that prove DB criteria.
- On **BLOCK**: fix every blocker, re-run verify, review again. After 3 rounds still BLOCK, stop and report.
- On **PASS**: fix cheap majors; list the rest as `Follow-ups` under the task.

## 7. Close

- Tick the task `[x]` with a short `Notes:` line (test files, follow-ups).
- Update the Handoff section: **Next task**, **State** (one line), **Blockers / notes**.
- If this was the last task of the milestone, say so. Breaking down the next milestone needs approval.
- **Commit, never push** (authorized by the user on 2026-10-27). Once `npm run verify` passes and the reviewer has signed off:
  - Check `git status` and stage only the files this run created or changed, including its TASKS/SPEC/RESEARCH updates. Leave unrelated dirty files out.
  - Never stage `.env`, `supabase/functions/.env` or other secrets.
  - Commit on the current branch (never `master`) with a message like `feat(landing): T1.2 pricing config and hero` plus the attribution line.
  - Don't push, amend or rewrite history.
  - If verify fails or the reviewer still says BLOCK, don't commit; report instead.

## 8. Report

A short message: task ID and title with the result, files changed by area, how it was proven (tests, `npm run verify`), the reviewer verdict and follow-ups, the commit hash and message (or why nothing was committed), and what's next.

## Milestone mode

After step 8, continue with the next task. Stop when a risky task reaches its plan gate, the reviewer still says BLOCK after 3 rounds, verify can't pass, research needs a user decision, or the milestone is complete. Whenever you stop, the Handoff section must say exactly where things stand.
