import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callFunction } from './functions'

const invoke = vi.fn()
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

/** What supabase-js returns for a function that answered with an HTTP error. */
function httpError(status: number, body: unknown) {
  const res = new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  return { data: null, error: new FunctionsHttpError(res) }
}

describe('callFunction', () => {
  beforeEach(() => invoke.mockReset())

  it('returns the reply on 200 { ok: true }', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })
    await expect(callFunction('site-contact', { a: 1 })).resolves.toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledWith('site-contact', { body: { a: 1 } })
  })

  it.each([400, 403, 500, 503])('throws the function’s own message on %i', async (status) => {
    invoke.mockResolvedValue(httpError(status, { ok: false, error: `message for ${status}` }))
    await expect(callFunction('site-contact', {})).rejects.toThrow(`message for ${status}`)
  })

  it('falls back to a general message when the error body has none', async () => {
    invoke.mockResolvedValue(httpError(500, 'not json'))
    await expect(callFunction('site-contact', {})).rejects.toThrow('Something went wrong. Please try again.')
  })

  it('says so when the network fails', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError('offline') })
    await expect(callFunction('site-contact', {})).rejects.toThrow('Network problem')
  })
})
