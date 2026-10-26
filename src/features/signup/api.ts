import { callFunction } from '../../lib/functions'
import type { SignupPayload } from '../../../supabase/functions/_shared/validate.ts'

export type RegisterReply = { ok: true; email: string }

export function registerVenue(payload: SignupPayload): Promise<RegisterReply> {
  return callFunction<RegisterReply>('register', payload)
}
