# TASKS.md

The working plan. [SPEC.md](SPEC.md) says **what** the site does; this file says **what to build next**
and tracks progress. [RESEARCH.md](RESEARCH.md) holds the technical findings behind the tasks.

## Handoff

> Update this section at the end of every session or task. Keep it short; it's the first thing the next session reads.

- **Current milestone:** none broken down yet. Propose one and get approval.
- **Next task:** none.
- **State:** Landing page, owner sign-up, reviews, migration and pgTAP tests exist (see README).
- **Blockers / notes:** Docker Desktop must be running for `npm run test:db`. Open items for launch are in README "Before launch".

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

One-liner: real copy and assets, Turnstile CAPTCHA, real Terms and Privacy, SMTP. Break down when approved.
