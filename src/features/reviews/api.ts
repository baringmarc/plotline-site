import { callFunction } from '../../lib/functions'
import { unwrap } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import type { ReviewPayload } from '../../../supabase/functions/_shared/validate.ts'

export type PublicReview = {
  id: string
  name: string
  venue: string | null
  quote: string
  role: 'player' | 'owner'
  rating: number
}

export async function fetchApprovedReviews(): Promise<PublicReview[]> {
  // RLS returns approved reviews only.
  const rows = unwrap(
    await supabase
      .from('reviews')
      .select('id, name, venue, quote, role, rating')
      .order('created_at', { ascending: false })
      .limit(20),
  )
  return rows.map((r) => ({ ...r, role: r.role === 'owner' ? 'owner' : 'player' }))
}

export type FeedbackReply = { ok: true; message: string }

export function sendReview(payload: ReviewPayload): Promise<FeedbackReply> {
  return callFunction<FeedbackReply>('feedback', payload)
}
