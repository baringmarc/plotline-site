# Draft: switch the forms to the platform (SAAS-PLAN Phase 5)

**Not active.** Parked here so nothing builds or tests them yet. Apply them in Phase 5, **after** court-booking-system has moved the backend in (its `docs/drafts/phase5-site-backend/`) and deployed `site-contact` and `site-review`. The contract they follow: court-booking-system's `docs/PLATFORM.md` §4.

| Draft | Goes to |
| --- | --- |
| `src/lib/siteForms.ts` | `src/lib/siteForms.ts`: an exact copy of the platform's rules, for instant form feedback |
| `src/features/contact/api.ts` | `src/features/contact/api.ts` (replaces `features/signup/api.ts`) |
| `src/features/reviews/api.ts` | `src/features/reviews/api.ts` (now imports `lib/siteForms` and calls `site-review`) |
| `env.example` | `.env.example` (adds `VITE_TURNSTILE_SITE_KEY`) |

Still to build in Phase 5 (not drafted, since it's UI work and the design is changing):
- **The contact form:** turn `SignupForm` into the contact form. No passwords and no agreement boxes; one consent checkbox, the Turnstile widget, and a "Thanks, we'll be in touch" state instead of `/welcome`.
- **Remove the old backend:** remove `/welcome` and the trial copy, then delete `supabase/migrations`, `supabase/functions` and `supabase/tests`, and the old `db:*`/`functions:serve` scripts. Add a `db:types` script that generates from the shared project.
- **Update tests:** update `SignupForm.test.tsx` and drop `validate.test.ts` (the platform's `siteForms.test.ts` covers the rules).
- **Clean up:** delete this folder.
