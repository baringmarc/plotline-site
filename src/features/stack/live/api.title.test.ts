// T6.4 (mine): an untitled stack reads back from get_live_stack as `title: null` (seen on the local stack, 2026-11-19;
// PLATFORM.md §4 "stack-live": an empty title means no title). The view must read it as '' rather than fail.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLiveStack, LiveError } from './api'

const rpc = vi.fn()
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const row = (title: unknown) => ({
  data: { title, courts: 1, snapshot: null, version: 0, ended: false, expires_at: '2026-11-20T08:00:00+00:00', venue: null },
  error: null,
})

beforeEach(() => rpc.mockReset())

describe('getLiveStack: the title (T6.4)', () => {
  it('reads a null title as no title', async () => {
    rpc.mockResolvedValue(row(null))
    await expect(getLiveStack('c')).resolves.toMatchObject({ title: '', courts: 1 })
  })

  it('still refuses a title that is neither text nor null', async () => {
    rpc.mockResolvedValue(row(7))
    await expect(getLiveStack('c')).rejects.toEqual(new LiveError('unknown'))
  })
})
