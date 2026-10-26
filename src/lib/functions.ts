import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

type FunctionReply = { ok: boolean; error?: string }

/**
 * Calls an Edge Function and returns its JSON reply. Our functions answer `{ ok: false, error }`
 * with a readable message on a 4xx/5xx; that message becomes the thrown Error.
 */
export async function callFunction<T extends FunctionReply>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const reply = (await error.context.json().catch(() => null)) as FunctionReply | null
      throw new Error(reply?.error || 'Something went wrong. Please try again.')
    }
    throw new Error('Network problem. Please check your connection and try again.')
  }
  if (!data?.ok) throw new Error(data?.error || 'Something went wrong. Please try again.')
  return data
}
