// POST /functions/v1/register: venue owner sign-up from the landing page.
// Validates the form, drops bots quietly, then creates the auth user with the form fields as
// metadata. A database trigger copies them into public.venue_signups, and Supabase Auth sends the
// confirmation email, whose link returns to SITE_URL/welcome.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { json, preflight, readJson } from '../_shared/http.ts'
import { isLikelyBot, validateSignup } from '../_shared/validate.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const body = await readJson(req)
  const result = validateSignup(body)

  // Answer bots exactly like a success, so they learn nothing.
  if (isLikelyBot(body, Date.now())) {
    return json({ ok: true, email: result.ok ? result.value.email : '' })
  }
  if (!result.ok) return json(result, 400)

  const s = result.value
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await supabase.auth.signUp({
    email: s.email,
    password: s.password,
    options: {
      emailRedirectTo: `${siteUrl}/welcome`,
      data: {
        source: 'landing',
        first_name: s.firstName,
        last_name: s.lastName,
        phone: s.phone,
        venue_name: s.venueName,
        location: s.location,
        courts: s.courts,
        facebook: s.facebook,
        open_play_addon: s.openPlayAddon,
        message: s.message,
      },
    },
  })

  if (error) {
    console.error('register: signUp failed', error.code, error.message)
    if (error.code === 'weak_password') return json({ ok: false, error: error.message }, 400)
    if (error.status === 429) {
      return json({ ok: false, error: 'Too many sign-ups right now. Please try again in a few minutes.' }, 429)
    }
    return json({ ok: false, error: 'We could not create your account. Please try again.' }, 500)
  }

  // An email that is already registered gets the same answer (Auth does not reveal it either).
  return json({ ok: true, email: s.email })
})
