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

### Turnstile CAPTCHA on the contact form
- **Status:** Open (question changed on 2026-10-27)
- **Question:** ~~How do we pass the Turnstile token through the `register` function to `auth.signUp`?~~ There's no sign-up anymore. The widget's token goes in the `turnstileToken` field to the platform's `site-contact` function, which verifies it with Cloudflare (court-booking-system `docs/PLATFORM.md` §4; drafted in its `docs/drafts/phase5-site-backend/`). What's left: the widget itself (script loading, size, light and dark, accessibility) and the site key in `VITE_TURNSTILE_SITE_KEY`.
