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
- **Status:** Decided (SPEC §6, 2026-10-27)
- **Question:** ~~How do we pass the Turnstile token through the `register` function to `auth.signUp`?~~ There's no sign-up anymore. The widget's token goes in the `turnstileToken` field to the platform's `site-contact` function, which verifies it with Cloudflare (court-booking-system `docs/PLATFORM.md` §4; drafted in its `docs/drafts/phase5-site-backend/`). What's left: the widget itself (script loading, size, light and dark, accessibility) and the site key in `VITE_TURNSTILE_SITE_KEY`.
- **Findings:**
  - Script: `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, then `turnstile.render(el, { sitekey, callback, 'expired-callback', 'error-callback', theme, size })`, which returns a widget id for `turnstile.reset(id)` and `turnstile.remove(id)`. `theme`: `auto` | `light` | `dark`; `size`: `normal` | `flexible` | `compact`. Source: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
  - Tokens expire after 300 seconds and can be validated only once, so a failed send needs a reset (same source).
  - Test site keys: `1x00000000000000000000AA` always passes (visible), `2x00000000000000000000AB` always fails, `3x00000000000000000000FF` forces an interactive challenge. They produce the token `XXXX.DUMMY.TOKEN.XXXX`, which production secret keys reject. Source: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
  - Accessibility: Cloudflare's client-side page has no guidance; the widget renders its own labelled iframe. We place it after the consent box and before the submit button, and the form's own error says when the check is missing.
- **Decision:** `src/lib/turnstile.ts` loads the script once; `components/Turnstile.tsx` renders with `theme: 'auto'` and `size: 'flexible'` and resets on every failed send. Without `VITE_TURNSTILE_SITE_KEY`, development uses the always-pass test key and production shows no widget.
