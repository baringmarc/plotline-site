---
name: implement
description: Implement the next task from TASKS.md (or a given task, or the whole current milestone) end to end. Orient, research, plan (pausing for approval on risky DB/security work), write the failing tests first (test-writer), build, verify, get a reviewer verdict, then tick the task and update the handoff. In milestone mode, finish with /retro.
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

Before you start, read the **Learned rules** section of CLAUDE.md: they come from mistakes made in earlier milestones.

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

For anything else, state your plan in two or three lines, naming what the tests will need (functions, components, files), and continue.

## 4. Tests first (test-writer)

- Launch the `test-writer` agent in the foreground. Give it **only** the task ID (or the ad-hoc request) and the plan's names: functions, components, config keys, file paths. Don't send code or describe how you'll build it; it works from the task and SPEC.
- Use the names its report lists. Its tests are now **locked for this task**: the guard won't let you edit them.
- Skip this step only when the task has no behavior to test (pure copy, styling or docs). Say so in the plan.

## 5. Build

- Follow every rule in CLAUDE.md. Write the code the task needs and nothing from later tasks.
- Visitor-facing copy goes in `src/config/site.ts`; prices are built from `src/config/pricing.ts`, which must match court-booking-system's `docs/facts.json`.
- Make the test-writer's tests pass. You may **add** tests for edge cases you find (those are yours to edit): Vitest next to the module; Testing Library mocking `features/<area>/api.ts`, never the network.
- **If a locked test looks wrong** (it contradicts SPEC or the task, not merely your approach): add a line under the task in TASKS.md, `Test dispute: <file> "<test name>": <what it asserts> vs <what SPEC §x / the criterion says>`, and carry on. The reviewer rules on it in step 7; if it agrees, re-launch the `test-writer` in dispute mode with that line.
- No new migrations, Edge Functions or database tests here (CLAUDE.md, Platform). If a task seems to need one, stop: it's a contract change for court-booking-system.
- If behavior changed, update SPEC.md.

## 6. Verify

- Run `node .claude/hooks/verify-gate.mjs --full` and fix failures until it passes. It runs `npm run verify` (including the drift check) and records which changes passed. **The guard refuses `git commit` until a full run passed on exactly the current changes**, so re-run it after any later code edit.
- Never weaken, skip or delete tests or lint rules. The guard blocks most of it, and the reviewer checks the rest.
- For UI changes, check loading, empty and error states and the mobile layout.

## 7. Review

- Launch the `reviewer` agent in the foreground. Give it **only**: the task ID (or request), the files this task created or changed, the files that were already dirty before you started, the test files that prove the criteria, and any `Test dispute:` lines.
- **Don't** summarize what you built, explain your reasoning, or say it's correct. The reviewer judges the code with fresh eyes.
- After every verdict, log each **blocker** and **major** finding, one call each, with the reviewer's category:
  `node .claude/hooks/log-event.mjs reviewer '{"severity":"blocker","category":"error-state","file":"<file:line>","summary":"<one line>","round":1}'`
- On **BLOCK**: fix every blocker, re-run step 6, review again.
- On **PASS**: fix cheap majors; list the rest as `Follow-ups` under the task.
- **Still BLOCK after 3 rounds: escalate.** Don't commit. Write under **Blockers / notes** in the Handoff:
  ```
  - **Escalation <task id> (<date>):**
    - Still failing: <each unresolved blocker, file:line>
    - Tried: round 1 <…>; round 2 <…>; round 3 <…>
    - Blocked on: <the one decision or fact you need from the user>
  ```
  Then log it (`node .claude/hooks/log-event.mjs escalation '{"summary":"<blocked on…>"}'`), stop and report.

## 8. Close

- Tick the task `[x]` with a short `Notes:` line (test files, follow-ups).
- Update the Handoff section: **Next task**, **State** (one line), **Blockers / notes**.
- If this was the last task of the milestone, say so. Breaking down the next milestone needs approval.
- **Commit, never push** (authorized by the user on 2026-10-27). Once the full verify (step 6) passes and the reviewer has signed off:
  - Check `git status` and stage only the files this run created or changed, including its TASKS/SPEC/RESEARCH updates. Leave unrelated dirty files out.
  - Never stage `.env`, `supabase/functions/.env` or other secrets.
  - Commit on the current branch (never `master`) with a message like `feat(landing): T1.2 pricing config and hero` plus the attribution line.
  - Don't push, amend or rewrite history.
  - If verify fails or the reviewer still says BLOCK, don't commit; report instead.

## 9. Report

A short message: task ID and title with the result, files changed by area, how it was proven (the test-writer's tests and yours, the full verify), any test disputes and how they were settled, the reviewer verdict and follow-ups, the commit hash and message (or why nothing was committed), and what's next.

## Milestone mode

After step 9, continue with the next task. Stop when a risky task reaches its plan gate, the reviewer still says BLOCK after 3 rounds (escalate, step 7), verify can't pass, research needs a user decision, or the milestone is complete. Whenever you stop, the Handoff section must say exactly where things stand.

**When the milestone is complete** (its last task is committed), run the retro before you stop: follow `.claude/skills/retro/SKILL.md` for that milestone. It proposes lessons and waits for the user's approval, so this is where milestone mode ends.
