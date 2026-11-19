// T6.4 Player view: the viewer (TASKS.md T6.4; court-booking-system docs/PLATFORM.md §4 "Live stacks", "Viewer
// fallback": if the channel status is CLOSED, CHANNEL_ERROR or TIMED_OUT, call get_live_stack every 15 seconds until it
// reconnects; ignore any snapshot whose version is not above the one shown; show the time of the last update).
// Plan names: `createLiveViewer({ code, onState, read?, subscribe?, pollMs? })` -> `{ stop() }` in
// src/features/stack/live/viewer.ts; `read` defaults to getLiveStack, `subscribe` to subscribeLiveStack, `pollMs` to
// 15000. `ViewerState` = { kind: 'loading' } | { kind: 'not_found' } | { kind: 'error' } |
// { kind: 'ready'; view: LiveStackView; mode: 'live' | 'polling'; updatedAt: Date }.
// The clock is faked; `expiresAt` is always 24 h after the fake "now" of the read, so the last update is the same
// whether it is taken from the clock or from the stack's expiry (PLATFORM.md: 24 hours after its last publish).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts, recordScore } from '../engine'
import { LiveError, type LiveStackView } from './api'
import { buildSnapshot, type LiveSnapshot } from './snapshot'
import { createLiveViewer, type ViewerState } from './viewer'

const getLiveStack = vi.fn()
const subscribeLiveStack = vi.fn()

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    subscribeLiveStack: (...a: unknown[]) => subscribeLiveStack(...a),
    publishLiveStack: vi.fn(),
    goLive: vi.fn(),
  }
})

type Status = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'
type Handlers = {
  onSnapshot(msg: { version: number; snapshot: LiveSnapshot | null; ended: boolean }): void
  onStatus(status: Status): void
}

const START = new Date('2026-11-19T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const POLL = 15_000

function snap(title = 'Tuesday Open Play', scored = 0): LiveSnapshot {
  let s = createSession({ format: 'fair', courts: 1, title })
  s = fillCourts(addPlayers(s, ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay']))
  for (let i = 0; i < scored; i++) {
    s = fillCourts(recordScore(s, s.games[s.games.length - 1].id, 11, i))
  }
  return buildSnapshot(s)
}

/** A view as read "now": expiresAt is 24 h after the current fake time. */
function view(version: number, over: Partial<LiveStackView> = {}): LiveStackView {
  return {
    title: 'Tuesday Open Play',
    courts: 1,
    snapshot: snap(),
    version,
    ended: false,
    expiresAt: new Date(Date.now() + DAY).toISOString(),
    venue: null,
    ...over,
  }
}

/** Lets pending promise chains settle without moving the clock. */
async function flush() {
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0)
}

function harness(opts: { read?: ReturnType<typeof vi.fn>; pollMs?: number; useDefaults?: boolean } = {}) {
  const states: ViewerState[] = []
  const read = opts.read ?? vi.fn()
  let handlers: Handlers | null = null
  const leave = vi.fn()
  const subscribe = vi.fn((_code: string, h: Handlers) => {
    handlers = h
    return leave
  })
  const viewer = opts.useDefaults
    ? createLiveViewer({ code: 'CODE1', onState: (s) => states.push(s) })
    : createLiveViewer({
        code: 'CODE1',
        onState: (s) => states.push(s),
        read: read as unknown as (code: string) => Promise<LiveStackView | null>,
        subscribe,
        ...(opts.pollMs !== undefined ? { pollMs: opts.pollMs } : {}),
      })
  return {
    states,
    read,
    subscribe,
    leave,
    viewer,
    last: () => states[states.length - 1],
    h: () => {
      if (!handlers) throw new Error('subscribe was not called')
      return handlers
    },
  }
}

const ready = (s: ViewerState | undefined) => {
  expect(s?.kind).toBe('ready')
  return s as Extract<ViewerState, { kind: 'ready' }>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  getLiveStack.mockReset()
  subscribeLiveStack.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------- loading, not found, error ----------

describe('createLiveViewer: the first read (T6.4)', () => {
  it('starts in loading, reads the code and joins the channel', async () => {
    const read = vi.fn(() => new Promise<LiveStackView | null>(() => {}))
    const t = harness({ read })
    expect(t.states[0]).toEqual({ kind: 'loading' })
    await flush()
    expect(read).toHaveBeenCalledWith('CODE1')
    expect(t.subscribe).toHaveBeenCalledTimes(1)
    expect(t.subscribe.mock.calls[0][0]).toBe('CODE1')
    expect(t.last()).toEqual({ kind: 'loading' })
  })

  it('an unknown or expired code (read gives null) is not_found', async () => {
    const t = harness({ read: vi.fn(async () => null) })
    await flush()
    expect(t.last()).toEqual({ kind: 'not_found' })
  })

  it('a failed first read is error', async () => {
    const t = harness({ read: vi.fn(async () => Promise.reject(new LiveError('unknown'))) })
    await flush()
    expect(t.last()).toEqual({ kind: 'error' })
  })

  it('a stack is ready with its view and the time of the read as the last update', async () => {
    const v = view(4)
    const t = harness({ read: vi.fn(async () => v) })
    await flush()
    const s = ready(t.last())
    expect(s.view).toEqual(v)
    expect(s.updatedAt).toBeInstanceOf(Date)
    expect(s.updatedAt.getTime()).toBe(START.getTime())
  })

  it('a stack not published yet is ready with snapshot null', async () => {
    const t = harness({ read: vi.fn(async () => view(0, { snapshot: null })) })
    await flush()
    const s = ready(t.last())
    expect(s.view.snapshot).toBeNull()
    expect(s.view.version).toBe(0)
  })

  it('an ended stack is ready with ended: true (its final board)', async () => {
    const final = snap('Tuesday Open Play', 2)
    const t = harness({ read: vi.fn(async () => view(12, { ended: true, snapshot: final })) })
    await flush()
    const s = ready(t.last())
    expect(s.view.ended).toBe(true)
    expect(s.view.snapshot).toEqual(final)
  })

  it('uses getLiveStack and subscribeLiveStack from the API by default', async () => {
    getLiveStack.mockResolvedValue(view(2))
    subscribeLiveStack.mockReturnValue(() => {})
    const t = harness({ useDefaults: true })
    await flush()
    expect(getLiveStack).toHaveBeenCalledWith('CODE1')
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(subscribeLiveStack.mock.calls[0][0]).toBe('CODE1')
    expect(ready(t.last()).view.version).toBe(2)
  })
})

// ---------- live through the channel ----------

describe('createLiveViewer: live (T6.4)', () => {
  it('SUBSCRIBED makes the mode live', async () => {
    const t = harness({ read: vi.fn(async () => view(1)) })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    await flush()
    expect(ready(t.last()).mode).toBe('live')
  })

  it('a SUBSCRIBED that comes before the read finishes still ends up live', async () => {
    let resolve: (v: LiveStackView) => void = () => {}
    const read = vi.fn(() => new Promise<LiveStackView>((r) => (resolve = r)))
    const t = harness({ read })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    resolve(view(1))
    await flush()
    expect(ready(t.last()).mode).toBe('live')
  })

  it('a broadcast with a higher version replaces the board, keeps title and venue, and moves the last update', async () => {
    const venue = { name: 'Acme Courts', slug: 'acme-courts', logoPath: 'v1/logo.png' }
    const t = harness({ read: vi.fn(async () => view(3, { venue })) })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    await vi.advanceTimersByTimeAsync(4_000)
    const next = snap('Tuesday Open Play', 1)
    t.h().onSnapshot({ version: 4, snapshot: next, ended: false })
    await flush()
    const s = ready(t.last())
    expect(s.view.version).toBe(4)
    expect(s.view.snapshot).toEqual(next)
    expect(s.view.ended).toBe(false)
    expect(s.view.title).toBe('Tuesday Open Play')
    expect(s.view.venue).toEqual(venue)
    expect(s.mode).toBe('live')
    expect(s.updatedAt.getTime()).toBe(START.getTime() + 4_000)
  })

  it.each([3, 2, 0])('ignores a broadcast whose version (%i) is not above the one shown (3)', async (version) => {
    const first = view(3)
    const t = harness({ read: vi.fn(async () => first) })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    await flush()
    const before = ready(t.last())
    await vi.advanceTimersByTimeAsync(5_000)
    t.h().onSnapshot({ version, snapshot: snap('Old board'), ended: false })
    await flush()
    const s = ready(t.last())
    expect(s.view.version).toBe(3)
    expect(s.view.snapshot).toEqual(first.snapshot)
    expect(s.updatedAt.getTime()).toBe(before.updatedAt.getTime())
  })

  it('an ended broadcast shows the final board with ended: true', async () => {
    const t = harness({ read: vi.fn(async () => view(5)) })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    const final = snap('Tuesday Open Play', 3)
    t.h().onSnapshot({ version: 6, snapshot: final, ended: true })
    await flush()
    const s = ready(t.last())
    expect(s.view.ended).toBe(true)
    expect(s.view.version).toBe(6)
    expect(s.view.snapshot).toEqual(final)
  })

  it('does not poll while the channel is live', async () => {
    const read = vi.fn(async () => view(1))
    const t = harness({ read })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    await flush()
    const reads = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL * 4)
    expect(read).toHaveBeenCalledTimes(reads)
    expect(ready(t.last()).mode).toBe('live')
  })
})

// ---------- the fallback ----------

describe('createLiveViewer: polling fallback (T6.4)', () => {
  it.each(['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'] as const)('%s switches the mode to polling', async (status) => {
    const t = harness({ read: vi.fn(async () => view(1)) })
    await flush()
    t.h().onStatus('SUBSCRIBED')
    await flush()
    t.h().onStatus(status)
    await flush()
    expect(ready(t.last()).mode).toBe('polling')
  })

  it('a channel that fails before the first read finishes is ready in polling mode', async () => {
    let resolve: (v: LiveStackView) => void = () => {}
    const read = vi.fn(() => new Promise<LiveStackView>((r) => (resolve = r)))
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    resolve(view(1))
    await flush()
    expect(ready(t.last()).mode).toBe('polling')
  })

  it('reads get_live_stack every 15 s by default while the channel is down, and no faster', async () => {
    const read = vi.fn(async () => view(1))
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    const atFailure = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL)
    const c1 = read.mock.calls.length
    expect(c1).toBeGreaterThanOrEqual(atFailure + 1)
    await vi.advanceTimersByTimeAsync(POLL - 1)
    expect(read).toHaveBeenCalledTimes(c1)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(c1 + 1)
    await vi.advanceTimersByTimeAsync(POLL)
    expect(read).toHaveBeenCalledTimes(c1 + 2)
    for (const call of read.mock.calls as unknown[][]) expect(call[0]).toBe('CODE1')
  })

  it('pollMs sets the interval', async () => {
    const read = vi.fn(async () => view(1))
    const t = harness({ read, pollMs: 1_000 })
    await flush()
    t.h().onStatus('TIMED_OUT')
    await flush()
    await vi.advanceTimersByTimeAsync(1_000)
    const c1 = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(3_000)
    expect(read).toHaveBeenCalledTimes(c1 + 3)
  })

  it('a poll with a higher version updates the board and the last update', async () => {
    let current = view(1)
    const read = vi.fn(async () => current)
    const t = harness({ read })
    await flush()
    t.h().onStatus('CLOSED')
    await flush()
    await vi.advanceTimersByTimeAsync(POLL - 1_000)
    const next = snap('Tuesday Open Play', 2)
    current = view(7, { snapshot: next, expiresAt: new Date(START.getTime() + POLL + DAY).toISOString() })
    await vi.advanceTimersByTimeAsync(1_000)
    await flush()
    const s = ready(t.last())
    expect(s.view.version).toBe(7)
    expect(s.view.snapshot).toEqual(next)
    expect(s.mode).toBe('polling')
    expect(s.updatedAt.getTime()).toBe(START.getTime() + POLL)
  })

  it('a poll with a version not above the one shown changes nothing', async () => {
    const first = view(5)
    let current = first
    const read = vi.fn(async () => current)
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    const before = ready(t.last())
    current = view(5, { snapshot: snap('Other board') })
    await vi.advanceTimersByTimeAsync(POLL)
    current = view(4, { snapshot: snap('Older board') })
    await vi.advanceTimersByTimeAsync(POLL)
    await flush()
    const s = ready(t.last())
    expect(s.view.version).toBe(5)
    expect(s.view.snapshot).toEqual(first.snapshot)
    expect(s.updatedAt.getTime()).toBe(before.updatedAt.getTime())
  })

  it('a poll that finds the stack gone (expired) is not_found', async () => {
    let current: LiveStackView | null = view(2)
    const read = vi.fn(async () => current)
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    current = null
    await vi.advanceTimersByTimeAsync(POLL)
    await flush()
    expect(t.last()).toEqual({ kind: 'not_found' })
  })

  it('a failed poll keeps the board shown and polling goes on', async () => {
    let fail = false
    const read = vi.fn(async () => {
      if (fail) throw new LiveError('unknown')
      return view(2)
    })
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    fail = true
    await vi.advanceTimersByTimeAsync(POLL)
    await flush()
    expect(ready(t.last()).view.version).toBe(2)
    expect(t.states.some((s) => s.kind === 'error')).toBe(false)
    const c = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL)
    expect(read.mock.calls.length).toBeGreaterThan(c)
  })

  it('stops polling once the channel reconnects, and the mode is live again', async () => {
    const read = vi.fn(async () => view(1))
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await vi.advanceTimersByTimeAsync(POLL * 2)
    t.h().onStatus('SUBSCRIBED')
    await flush()
    expect(ready(t.last()).mode).toBe('live')
    const c = read.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL * 4)
    expect(read).toHaveBeenCalledTimes(c)
  })

  it('a broadcast after reconnecting still has to be above the version a poll showed', async () => {
    let current = view(1)
    const read = vi.fn(async () => current)
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    current = view(8)
    await vi.advanceTimersByTimeAsync(POLL)
    await flush()
    t.h().onStatus('SUBSCRIBED')
    t.h().onSnapshot({ version: 8, snapshot: snap('Stale'), ended: false })
    await flush()
    expect(ready(t.last()).view.snapshot).toEqual(current.snapshot)
    t.h().onSnapshot({ version: 9, snapshot: snap('Fresh'), ended: false })
    await flush()
    expect(ready(t.last()).view.snapshot?.title).toBe('Fresh')
  })
})

// ---------- stop ----------

describe('createLiveViewer: stop (T6.4)', () => {
  it('leaves the channel, stops polling and reports nothing more', async () => {
    const read = vi.fn(async () => view(1))
    const t = harness({ read })
    await flush()
    t.h().onStatus('CHANNEL_ERROR')
    await flush()
    t.viewer.stop()
    expect(t.leave).toHaveBeenCalled()
    const reads = read.mock.calls.length
    const states = t.states.length
    await vi.advanceTimersByTimeAsync(POLL * 4)
    t.h().onSnapshot({ version: 50, snapshot: snap('Late'), ended: false })
    await flush()
    expect(read).toHaveBeenCalledTimes(reads)
    expect(t.states).toHaveLength(states)
  })

  it('a first read that finishes after stop reports nothing', async () => {
    let resolve: (v: LiveStackView) => void = () => {}
    const t = harness({ read: vi.fn(() => new Promise<LiveStackView>((r) => (resolve = r))) })
    await flush()
    t.viewer.stop()
    const states = t.states.length
    resolve(view(1))
    await flush()
    expect(t.states).toHaveLength(states)
  })
})
