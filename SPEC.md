# Plotline site — Product Spec

The source of truth for **what** the site does. [TASKS.md](TASKS.md) says what to build next,
[RESEARCH.md](RESEARCH.md) holds technical findings, [README.md](README.md) covers setup and deploy.
Update this file in the same change as any behavior change, and add a row to §6 when a choice is made.

## 1. Overview

Landing and owner sign-up site for a court booking product. Venue owners read about it, see venues and
reviews, and start a 7-day free trial.

### Goals
- Convert venue owners: clear pitch, pricing, and a short sign-up form.
- Show social proof: venues and approved reviews.
- Keep abuse low: validation shared by browser and server, honeypot, timing check, CAPTCHA before launch.

### Non-goals (v1)
- Booking itself (that is the court booking product), payments, an owner dashboard.

## 2. Roles
| Role | Can do |
| --- | --- |
| Visitor (`anon`) | Read the site, read approved reviews, submit a sign-up or a review through Edge Functions |
| Owner (`authenticated`) | Everything a visitor can, plus read their own row in `venue_signups` |
| Admin (Supabase Studio, service role) | Approve reviews, manage sign-ups |

## 3. Pages
| Route | Purpose |
| --- | --- |
| `/` | Landing page (sections listed in README) |
| `/welcome` | Where the confirmation email lands |
| `/terms`, `/privacy` | Legal pages (placeholders until launch) |

Every async view handles loading, empty and error states. Mobile-first.

## 4. Flows

### Owner sign-up
1. The form posts to the `register` Edge Function, which validates (`_shared/validate.ts`) and drops bots.
2. `auth.signUp` with the form fields as metadata; trigger copies them to `venue_signups` (`pending`).
3. Email link returns to `/welcome`; confirming sets `status = 'trial'`, `trial_ends_at = confirmed + 7 days`.

Statuses: `pending` → `trial` → `active` | `cancelled`.

### Reviews
The `feedback` Edge Function stores a review with `approved = false`. Only approved reviews are public.

## 5. Data model
- `venue_signups`: one row per owner (limits are CHECK constraints; mirrored in `_shared/validate.ts`).
- `reviews`: name, venue, quote (10–400), role (`player`|`owner`), rating (1–5), `approved`.
- RLS on every table with explicit policies; triggers and helpers in the `private` schema.

## 6. Decisions log
| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-27 | Adopted SPEC/TASKS/RESEARCH workflow with `/implement` and the `reviewer` agent, copied from `court-booking-system` | Same working method across both projects |

## 7. Open questions
- Turnstile CAPTCHA before launch (README "Before launch").
- Real SMTP provider for confirmation emails.
