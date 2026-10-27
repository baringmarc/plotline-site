# Plotline site — Product Spec

The source of truth for **what** the site does. [TASKS.md](TASKS.md) says what to build next,
[RESEARCH.md](RESEARCH.md) holds technical findings, [README.md](README.md) covers setup and deploy.
Update this file in the same change as any behavior change, and add a row to §6 when a choice is made.

> **Planned change (2026-10-27).** This spec describes the site **as it is today**. Under Plotline's SaaS plan, the owner sign-up and the 7-day trial are replaced by a **contact form** (a lead, no account, no trial), and this repo's backend (`venue_signups`, `reviews`, `register`, `feedback`) moves to `court-booking-system`, which owns the database and every Edge Function. The target and the contract are in court-booking-system's [`docs/PLATFORM.md`](../court-booking-system/docs/PLATFORM.md) and `docs/SAAS-PLAN.md` (Phase 5). Don't extend the sign-up flow; build toward the contact form.

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
| 2026-10-27 | This repo is the marketing **frontend only**. `court-booking-system` is the platform repo: it owns the Supabase schema, migrations and Edge Functions for every shared project; the contract between the two is its `docs/PLATFORM.md` | Two repos pushing migrations to one database break each other's migration history; one owner keeps the contract clear |
| 2026-10-27 | No self-serve sign-up and no free trial. Owners send a contact form (`site-contact`, stored as a lead); reviews go to `site-review`. Domain `plotline.fit`; the live demo is `https://claudex-courts.plotline.fit` | The SaaS plan (court-booking-system `docs/SAAS-PLAN.md` §1, Phase 5): we set each venue up together with the owner |

## 7. Open questions
- Turnstile CAPTCHA before launch: the token goes to the platform's `site-contact` function (its secret lives in court-booking-system), not to `auth.signUp`.
- ~~Real SMTP provider for confirmation emails.~~ No longer needed here: the contact form creates no account, so the site sends no auth emails. Plotline's email sender is set up in court-booking-system (SAAS-PLAN Phase 0).
