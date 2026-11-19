// T6.2 Organizer goes live: the publisher (TASKS.md T6.2; court-booking-system docs/PLATFORM.md §4 "Live stacks").
// Names from the approved plan: `createLivePublisher({ key, onStatus, onVersion })` -> `{ submit, end, stop }`,
// `LiveStatus`, `MIN_PUBLISH_GAP_MS` (2000), `RETRY_AFTER_NETWORK_MS` (5000). Rules under test:
// - every change publishes `buildSnapshot(session)` through `publishLiveStack`; the first publish is at once and
//   uses key.version + 1; each success follows the reply's version;
// - at most one publish every 2 s: changes inside the gap collapse into one publish of the latest;
// - too_fast: retry after the gap with the latest snapshot and the same version;
// - stale_version: re-read with getLiveStack and continue from its version (null view: stop, not_found);
// - ended / forbidden / not_found / limit_reached / too_large / invalid_snapshot: stop with that reason;
// - network failure: Reconnecting, retry after 5 s with the latest; Live again on success;
// - a snapshot over 64 KB is never sent: stop with too_large;
// - end(session) publishes the end (end: true), then stops with ended; stop() stops without publishing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts, timeOut } from '../engine'
import type { Session } from '../types'
import { LiveError, type LiveErrorCode } from './api'
import type { LiveKey } from './liveKey'
import { MIN_PUBLISH_GAP_MS, RETRY_AFTER_NETWORK_MS, createLivePublisher, type LiveStatus } from './publisher'
import { buildSnapshot } from './snapshot'

const publishLiveStack = vi.fn()
const getLiveStack = vi.fn()

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    publishLiveStack: (...a: unknown[]) => publishLiveStack(...a),
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    goLive: vi.fn(),
  }
})

const KEY: LiveKey = { code: 'CODE123', secret: 'SECRET456', version: 0 }

/** A running session whose title tells snapshots apart. */
function session(title = 'Tuesday Open Play'): Session {
  return fillCourts(
    createSession({ format: 'fair', courts: 1, title, names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] }),
  )
}

/** A session whose snapshot is over 64 KB (one very long name). */
function hugeSession(): Session {
  const s = createSession({ format: 'fair', courts: 1, title: 'Huge' })
  return fillCourts(addPlayers(s, ['x'.repeat(70_000), 'Ben', 'Cy', 'Dee', 'Eli']))
}

const view = (version: number) => ({
  title: 'Tuesday Open Play',
  courts: 1,
  snapshot: null,
  version,
  ended: false,
  expiresAt: '2026-11-20T10:00:00Z',
  venue: null,
})

/** Lets pending promise chains settle without moving the clock. */
async function flush() {
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(0)
}

/** The n-th (0-based) publishLiveStack argument. */
const call = (n: number) => publishLiveStack.mock.calls[n][0] as {
  code: string
  secret: string
  version: number
  snapshot: unknown
  end?: boolean
}

/** Replies like the server: echoes the version it was given. */
const okReply = () =>
  publishLiveStack.mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))

function setup(key: LiveKey = KEY) {
  const onStatus = vi.fn<(s: LiveStatus) => void>()
  const onVersion = vi.fn<(v: number) => void>()
  const publisher = createLivePublisher({ key, onStatus, onVersion })
  return { publisher, onStatus, onVersion }
}

let active: ReturnType<typeof setup> | null = null
function start(key: LiveKey = KEY) {
  active = setup(key)
  return active
}

beforeEach(() => {
  vi.useFakeTimers()
  publishLiveStack.mockReset()
  getLiveStack.mockReset()
  okReply()
})
afterEach(() => {
  active?.publisher.stop()
  active = null
  vi.useRealTimers()
})

describe('createLivePublisher: constants (T6.2)', () => {
  it('publishes at most once every 2 s and retries a network failure after 5 s', () => {
    expect(MIN_PUBLISH_GAP_MS).toBe(2000)
    expect(RETRY_AFTER_NETWORK_MS).toBe(5000)
  })
})

describe('createLivePublisher: publishing (T6.2)', () => {
  it('the first change publishes at once with the code, secret, key.version + 1 and the snapshot', async () => {
    const { publisher } = start({ ...KEY, version: 4 })
    const s = session()
    publisher.submit(s)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    const c = call(0)
    expect(c.code).toBe(KEY.code)
    expect(c.secret).toBe(KEY.secret)
    expect(c.version).toBe(5)
    expect(c.snapshot).toEqual(buildSnapshot(s))
    expect(c.end ?? false).toBe(false)
  })

  it('a fresh key (version 0) publishes version 1 first', async () => {
    const { publisher } = start()
    publisher.submit(session())
    await flush()
    expect(call(0).version).toBe(1)
  })

  it('a success reports the reply version and the Live status', async () => {
    publishLiveStack.mockResolvedValueOnce({ version: 1, expiresAt: '2026-11-20T10:00:00Z' })
    const { publisher, onStatus, onVersion } = start()
    publisher.submit(session())
    await flush()
    expect(onVersion).toHaveBeenCalledWith(1)
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'live' })
  })

  it('the next publish continues from the version in the reply', async () => {
    publishLiveStack.mockResolvedValueOnce({ version: 7, expiresAt: '2026-11-20T10:00:00Z' })
    const { publisher, onVersion } = start()
    publisher.submit(session('one'))
    await flush()
    expect(onVersion).toHaveBeenLastCalledWith(7)
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS)
    publisher.submit(session('two'))
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).version).toBe(8)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('two')))
  })

  it('a change after the gap has passed publishes at once', async () => {
    const { publisher } = start()
    publisher.submit(session('one'))
    await flush()
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS + 3000)
    publisher.submit(session('two'))
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('two')))
  })

  it('does not publish before anything is submitted', async () => {
    start()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})

describe('createLivePublisher: coalescing, at most one publish every 2 s (T6.2)', () => {
  it('changes inside the gap collapse into one publish of the latest session, sent when the gap ends', async () => {
    const { publisher } = start()
    publisher.submit(session('one'))
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(300)
    publisher.submit(session('two'))
    await vi.advanceTimersByTimeAsync(700)
    publisher.submit(session('three'))
    await vi.advanceTimersByTimeAsync(500)
    publisher.submit(session('four'))

    // Still inside the 2 s gap after the first publish: nothing more is sent.
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS - 1 - 1500)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('four')))
    expect(call(1).version).toBe(2)

    // Nothing pending any more: no further publishes.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
  })

  it('a steady stream of changes publishes no more than once every 2 s', async () => {
    const { publisher } = start()
    let s = session()
    for (let t = 0; t < 10_000; t += 250) {
      s = { ...s, title: `change ${t}` }
      publisher.submit(s)
      await vi.advanceTimersByTimeAsync(250)
    }
    await flush()
    // 10 s of changes: at most one publish per 2 s window (0, 2, 4, 6, 8 s and the one at 10 s).
    expect(publishLiveStack.mock.calls.length).toBeLessThanOrEqual(6)
    expect(publishLiveStack.mock.calls.length).toBeGreaterThanOrEqual(5)
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS)
    await flush()
    const last = publishLiveStack.mock.calls.length - 1
    expect(call(last).snapshot).toEqual(buildSnapshot(s))
  })
})

describe('createLivePublisher: too_fast (T6.2)', () => {
  it('keeps the latest snapshot and retries after the gap with the same version', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('too_fast'))
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    expect(call(0).version).toBe(1)

    await vi.advanceTimersByTimeAsync(500)
    publisher.submit(session('two'))

    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS - 1 - 500)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).version).toBe(1)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('two')))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'live' })
  })

  it('retries the same snapshot when nothing changed meanwhile', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('too_fast'))
    const { publisher } = start()
    publisher.submit(session('one'))
    await flush()
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('one')))
    expect(call(1).version).toBe(1)
  })
})

describe('createLivePublisher: stale_version (T6.2)', () => {
  it('re-reads the stack and continues from its version + 1 with the pending snapshot', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('stale_version'))
    getLiveStack.mockResolvedValue(view(12))
    const { publisher, onVersion } = start()
    publisher.submit(session('one'))
    await flush()
    expect(getLiveStack).toHaveBeenCalledWith(KEY.code)

    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).version).toBe(13)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('one')))
    expect(onVersion).toHaveBeenLastCalledWith(13)
  })

  it('stops with not_found when the re-read finds no stack', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('stale_version'))
    getLiveStack.mockResolvedValue(null)
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: 'not_found' })

    publisher.submit(session('two'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
  })
})

describe('createLivePublisher: errors that stop publishing (T6.2)', () => {
  it.each<LiveErrorCode>(['ended', 'forbidden', 'not_found', 'limit_reached', 'too_large', 'invalid_snapshot'])(
    '%s stops with that reason and sends nothing more',
    async (code) => {
      publishLiveStack.mockRejectedValueOnce(new LiveError(code))
      const { publisher, onStatus, onVersion } = start()
      publisher.submit(session('one'))
      await flush()
      expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: code })
      expect(onVersion).not.toHaveBeenCalled()

      publisher.submit(session('two'))
      await vi.advanceTimersByTimeAsync(20_000)
      publisher.end(session('three'))
      await vi.advanceTimersByTimeAsync(20_000)
      expect(publishLiveStack).toHaveBeenCalledTimes(1)
    },
  )
})

describe('createLivePublisher: network failures (T6.2)', () => {
  it('a LiveError unknown shows Reconnecting and retries after 5 s with the latest snapshot, then Live', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('unknown'))
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'reconnecting' })

    await vi.advanceTimersByTimeAsync(1000)
    publisher.submit(session('two'))
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_NETWORK_MS - 1 - 1000)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('two')))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'live' })
  })

  it('a rejection that is not a LiveError (offline fetch) is treated as a network failure', async () => {
    publishLiveStack.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'reconnecting' })
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_NETWORK_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('one')))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'live' })
  })

  it('keeps retrying every 5 s while the network stays down', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('unknown')).mockRejectedValueOnce(new LiveError('unknown'))
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_NETWORK_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'reconnecting' })
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_NETWORK_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(3)
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'live' })
  })
})

describe('createLivePublisher: a snapshot over 64 KB (T6.2)', () => {
  it('stops with too_large without calling publishLiveStack', async () => {
    const { publisher, onStatus } = start()
    publisher.submit(hugeSession())
    await flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(publishLiveStack).not.toHaveBeenCalled()
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: 'too_large' })

    publisher.submit(session('small again'))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})

describe('createLivePublisher: end(session) (T6.2)', () => {
  it('publishes the snapshot with end: true, then stops with ended', async () => {
    const { publisher, onStatus } = start()
    const base = session()
    const s = timeOut(base, base.line[0])
    publisher.end(s)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    expect(call(0).end).toBe(true)
    expect(call(0).version).toBe(1)
    expect(call(0).snapshot).toEqual(buildSnapshot(s))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: 'ended' })

    publisher.submit(session('after the end'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
  })

  it('an end inside the gap waits for it and replaces the pending change (one publish, end: true)', async () => {
    const { publisher, onStatus } = start()
    publisher.submit(session('one'))
    await flush()
    await vi.advanceTimersByTimeAsync(500)
    publisher.submit(session('two'))
    publisher.end(session('final'))
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS - 1 - 500)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).end).toBe(true)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('final')))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: 'ended' })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
  })

  it('an end refused with too_fast is retried after the gap, still with end: true', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('too_fast'))
    const { publisher, onStatus } = start()
    publisher.end(session('final'))
    await flush()
    await vi.advanceTimersByTimeAsync(MIN_PUBLISH_GAP_MS)
    await flush()
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(call(1).end).toBe(true)
    expect(call(1).snapshot).toEqual(buildSnapshot(session('final')))
    expect(onStatus).toHaveBeenLastCalledWith({ state: 'stopped', reason: 'ended' })
  })
})

describe('createLivePublisher: stop() (T6.2)', () => {
  it('drops a pending change: nothing more is published', async () => {
    const { publisher } = start()
    publisher.submit(session('one'))
    await flush()
    publisher.submit(session('two'))
    publisher.stop()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
  })

  it('cancels a network retry and ignores later changes', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('unknown'))
    const { publisher } = start()
    publisher.submit(session('one'))
    await flush()
    publisher.stop()
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_NETWORK_MS * 3)
    publisher.submit(session('two'))
    publisher.end(session('three'))
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
  })

  it('does not publish an end', async () => {
    const { publisher } = start()
    publisher.stop()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})
