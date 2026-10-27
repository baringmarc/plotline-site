# RESEARCH.md

Technical findings gathered **before** a task is built. [SPEC.md](SPEC.md) is the source of truth for
behavior. Once a recommendation is accepted, it moves into SPEC §6 (decisions log) and the entry here is
marked `Decided`.

## How to write an entry

```md
### <Topic>
- **Status:** Open | Researched | Decided (SPEC §6, <date>)
- **Question:** what we need to know to build the task
- **Findings:** facts, each with a source (docs URL or the SQL/command you ran)
- **Gotchas:** traps to avoid
- **Recommendation:** what to do and why, in 1–3 lines
```

Rules:
- Check the official docs first. When you claim something "works in our setup", include the command you ran.
- Keep entries short. Link to sources rather than copying them.

---

## Milestone 1: Launch readiness

### Turnstile CAPTCHA with Supabase Auth
- **Status:** Open
- **Question:** How do we pass the Turnstile token through the `register` function to `auth.signUp`?
