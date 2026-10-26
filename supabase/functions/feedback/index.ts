// POST /functions/v1/feedback: a review from the landing page. Stored unapproved; it appears on
// the site once someone sets approved = true in the Supabase dashboard.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { json, preflight, readJson } from '../_shared/http.ts'
import { isLikelyBot, validateReview } from '../_shared/validate.ts'

const THANKS = 'Thank you! Your review will appear once we have checked it.'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early

  const body = await readJson(req)
  if (isLikelyBot(body, Date.now())) return json({ ok: true, message: THANKS })

  const result = validateReview(body)
  if (!result.ok) return json(result, 400)

  const r = result.value
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await admin.from('reviews').insert({
    name: r.name,
    venue: r.venue || null,
    quote: r.quote,
    role: r.role,
    rating: r.rating,
    consented_at: new Date().toISOString(),
  })

  if (error) {
    console.error('feedback: insert failed', error.code, error.message)
    return json({ ok: false, error: 'Could not send your review. Please try again.' }, 500)
  }
  return json({ ok: true, message: THANKS })
})
