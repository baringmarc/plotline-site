// T6.4 (mine, from the review): an ended stack can't change, so a phone whose channel is down stops reading it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveStackView } from './api'
import { createLiveViewer, type ViewerState } from './viewer'

type Handlers = Parameters<NonNullable<Parameters<typeof createLiveViewer>[0]['subscribe']>>[1]

const view = (version: number, ended: boolean): LiveStackView => ({
  title: 'Tuesday',
  courts: 1,
  snapshot: null,
  version,
  ended,
  expiresAt: '2026-11-20T12:00:00Z',
  venue: null,
})

async function flush() {
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0)
}

function harness(read: ReturnType<typeof vi.fn>) {
  const states: ViewerState[] = []
  let handlers: Handlers | null = null
  createLiveViewer({
    code: 'C',
    onState: (s) => states.push(s),
    read: read as unknown as (code: string) => Promise<LiveStackView | null>,
    subscribe: (_c, h) => {
      handlers = h
      return () => {}
    },
    pollMs: 1_000,
  })
  return { states, h: () => handlers! }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createLiveViewer: an ended stack (T6.4)', () => {
  it('a stack already ended at the first read never polls', async () => {
    const read = vi.fn(async () => view(4, true))
    const t = harness(read)
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('polling stops once a poll finds the stack ended', async () => {
    let current = view(1, false)
    const read = vi.fn(async () => current)
    const t = harness(read)
    await flush()
    t.h().onStatus('CLOSED')
    await flush()
    current = view(2, true)
    await vi.advanceTimersByTimeAsync(1_000)
    await flush()
    const calls = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(5_000)
    expect(read).toHaveBeenCalledTimes(calls)
    const last = t.states[t.states.length - 1]
    expect(last.kind === 'ready' && last.view.ended).toBe(true)
  })
})
