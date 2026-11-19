// T6.9 The organizer joins its own live channel (TASKS.md T6.9; court-booking-system docs/PLATFORM.md §4 "Live
// stacks", Realtime: "join your own channel as soon as the stack exists and keep it for the session"). Names from
// the approved plan: `useLiveStack()` (returns `LiveController`) joins through the existing
// `subscribeLiveStack(code, handlers)` from ./api, which returns the function that leaves the channel.
// While this device holds a live key (after Go live, a hand-off, or a reload with a saved key) and the stack hasn't
// stopped, exactly one channel is open, for the key's code. It is left on Start over (forget), when publishing stops
// for good (status `stopped`), and on unmount. What arrives on it is ignored.
// The API is mocked (never the network, never a real socket); the publisher and the key storage are the real ones.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { supabase } from '../../../lib/supabase'
import { createSession, fillCourts } from '../engine'
import type { Session } from '../types'
import { LiveError, type LiveErrorCode, type LiveHandlers } from './api'
import { loadLiveKey, saveLiveKey, type LiveKey } from './liveKey'
import { useLiveStack } from './useLiveStack'

const goLive = vi.fn()
const publishLiveStack = vi.fn()
const getLiveStack = vi.fn()

/** Every join: the code, the handlers given, and the leave function handed back. */
type Join = { code: string; handlers: LiveHandlers; leave: Mock }
let joins: Join[] = []
const subscribeLiveStack = vi.fn((code: string, handlers: LiveHandlers) => {
  const leave = vi.fn()
  joins.push({ code, handlers, leave })
  return leave
})

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    goLive: (...a: unknown[]) => goLive(...a),
    publishLiveStack: (...a: unknown[]) => publishLiveStack(...a),
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    subscribeLiveStack: (code: string, handlers: LiveHandlers) => subscribeLiveStack(code, handlers),
  }
})

/** The codes whose channel is still open (joined and not left). */
const openChannels = () => joins.filter((j) => j.leave.mock.calls.length === 0).map((j) => j.code)
const joinedCodes = () => joins.map((j) => j.code)

// Node 25's own (file-less) `localStorage` global shadows jsdom's in this test environment and has no methods,
// so each test gets a fresh in-memory Storage on both `globalThis` and `window`.
class MemoryStorage {
  #items = new Map<string, string>()
  get length() {
    return this.#items.size
  }
  key(i: number) {
    return [...this.#items.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.#items.has(k) ? this.#items.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
  clear() {
    this.#items.clear()
  }
}

function session(title = 'Tuesday Open Play', courts = 2): Session {
  return fillCourts(
    createSession({ format: 'fair', courts, title, names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida'] }),
  )
}

const VENUE_KEY: LiveKey = {
  code: 'VENUECODE',
  secret: 'VENUESECRET',
  version: 12,
  venue: { name: 'Claudex Courts', logoPath: 'venue-1/logo.webp' },
}

let hook: { unmount: () => void; rerender: () => void } | null = null
function mount() {
  const rendered = renderHook(() => useLiveStack())
  hook = rendered
  return rendered
}

let channelSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  joins = []
  subscribeLiveStack.mockClear()
  goLive.mockReset()
  publishLiveStack.mockReset()
  getLiveStack.mockReset()
  goLive.mockResolvedValue({ code: 'CODE123', secret: 'SECRET456' })
  publishLiveStack.mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))
  channelSpy = vi.spyOn(supabase, 'channel')
})
afterEach(() => {
  hook?.unmount()
  hook = null
  // The hook joins only through subscribeLiveStack: no test here reaches Supabase's own channel (a real socket).
  expect(channelSpy).not.toHaveBeenCalled()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useLiveStack channel: joined once the key exists (T6.9)', () => {
  it('joins nothing when this device holds no key', async () => {
    mount()
    await new Promise((r) => setTimeout(r, 20))
    expect(subscribeLiveStack).not.toHaveBeenCalled()
  })

  it('joins nothing when Go live fails', async () => {
    goLive.mockRejectedValueOnce(new LiveError('busy'))
    const { result } = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(subscribeLiveStack).not.toHaveBeenCalled()
  })

  it('after Go live, joins live-stack:<code> for the new code, with handlers', async () => {
    const { result } = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(joinedCodes()).toEqual(['CODE123'])
    expect(openChannels()).toEqual(['CODE123'])
    const { handlers } = joins[0]
    expect(typeof handlers.onSnapshot).toBe('function')
    expect(typeof handlers.onStatus).toBe('function')
  })

  it('after a reload with a saved key, joins that code on mount, before any change is published', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    mount()
    expect(joinedCodes()).toEqual(['OLD'])
    expect(openChannels()).toEqual(['OLD'])
    await new Promise((r) => setTimeout(r, 20))
    expect(publishLiveStack).not.toHaveBeenCalled()
    expect(openChannels()).toEqual(['OLD'])
  })

  it('after a hand-off (adopt), joins the adopted code', () => {
    const { result } = mount()
    act(() => result.current.adopt(VENUE_KEY))
    expect(joinedCodes()).toEqual(['VENUECODE'])
    expect(openChannels()).toEqual(['VENUECODE'])
  })
})

describe('useLiveStack channel: one channel per code, not one per publish (T6.9)', () => {
  it('several publishes (each saving a new version) keep the one channel joined after Go live', async () => {
    vi.useFakeTimers()
    const { result } = mount()
    await act(async () => {
      await result.current.goLive('tok', session('one'))
      await vi.advanceTimersByTimeAsync(0)
    })
    act(() => result.current.submit(session('two')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    act(() => result.current.submit(session('three')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(publishLiveStack).toHaveBeenCalledTimes(3)
    expect(loadLiveKey()!.version).toBe(3)
    expect(result.current.key!.version).toBe(3)
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['CODE123'])
    expect(joins[0].leave).not.toHaveBeenCalled()
  })

  it('several publishes from a saved key keep the one channel joined on mount', async () => {
    vi.useFakeTimers()
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    act(() => result.current.submit(session('one')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    act(() => result.current.submit(session('two')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(publishLiveStack).toHaveBeenCalledTimes(2)
    expect(result.current.key!.version).toBe(6)
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['OLD'])
  })

  it('re-rendering the page does not join again', () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { rerender } = mount()
    rerender()
    rerender()
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['OLD'])
  })

  it('Reconnecting (a network failure) is not a stop: the channel stays joined', async () => {
    publishLiveStack.mockRejectedValueOnce(new Error('Failed to fetch'))
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const { result } = mount()
    act(() => result.current.submit(session()))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'reconnecting' }))
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['OLD'])
  })

  it('a hand-off leaves the old code’s channel and joins the new one', () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    expect(openChannels()).toEqual(['OLD'])
    act(() => result.current.adopt(VENUE_KEY))
    expect(joins.find((j) => j.code === 'OLD')!.leave).toHaveBeenCalled()
    expect(openChannels()).toEqual(['VENUECODE'])
    expect(joinedCodes()).toEqual(['OLD', 'VENUECODE'])
  })

  it('Go live from a device holding an older key leaves the old channel and joins the new code', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(openChannels()).toEqual(['CODE123'])
    expect(joinedCodes()).toEqual(['OLD', 'CODE123'])
  })
})

describe('useLiveStack channel: left on Start over (T6.9)', () => {
  it('forget() leaves the channel joined after Go live', async () => {
    const { result } = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    act(() => result.current.forget())
    expect(joins[0].leave).toHaveBeenCalled()
    expect(openChannels()).toEqual([])
  })

  it('forget() leaves the channel joined from a saved key, and later changes join nothing', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    act(() => result.current.forget())
    expect(openChannels()).toEqual([])
    act(() => result.current.submit(session()))
    await new Promise((r) => setTimeout(r, 20))
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual([])
  })

  it('Go live again after Start over joins the new code', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    act(() => result.current.forget())
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(openChannels()).toEqual(['CODE123'])
    expect(joinedCodes()).toEqual(['OLD', 'CODE123'])
  })
})

describe('useLiveStack channel: left when publishing stops for good (T6.9)', () => {
  it('End session (the final board published, status stopped: ended) leaves the channel; the key stays', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const { result } = mount()
    act(() => result.current.end(session('Final')))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'stopped', reason: 'ended' }))
    await waitFor(() => expect(openChannels()).toEqual([]))
    expect(joins[0].leave).toHaveBeenCalled()
    expect(result.current.key).toMatchObject({ code: 'OLD' })
  })

  it.each<LiveErrorCode>(['ended', 'forbidden', 'not_found', 'limit_reached', 'too_large', 'invalid_snapshot'])(
    'a publish refused with %s (a permanent stop) leaves the channel',
    async (code) => {
      publishLiveStack.mockRejectedValueOnce(new LiveError(code))
      saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
      const { result } = mount()
      expect(openChannels()).toEqual(['OLD'])
      act(() => result.current.submit(session()))
      await waitFor(() => expect(result.current.status).toEqual({ state: 'stopped', reason: code }))
      await waitFor(() => expect(openChannels()).toEqual([]))
    },
  )

  it('after a permanent stop, later changes do not join again', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('forbidden'))
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const { result } = mount()
    act(() => result.current.submit(session('one')))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'stopped', reason: 'forbidden' }))
    await waitFor(() => expect(openChannels()).toEqual([]))
    act(() => result.current.submit(session('two')))
    await new Promise((r) => setTimeout(r, 20))
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual([])
  })

  it('a hand-off after a permanent stop joins the adopted code (a new stack that hasn’t stopped)', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('forbidden'))
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const { result } = mount()
    act(() => result.current.submit(session()))
    await waitFor(() => expect(openChannels()).toEqual([]))
    act(() => result.current.adopt(VENUE_KEY))
    expect(openChannels()).toEqual(['VENUECODE'])
  })
})

describe('useLiveStack channel: left on unmount (T6.9)', () => {
  it('unmounting leaves the channel joined from a saved key', () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { unmount } = mount()
    expect(openChannels()).toEqual(['OLD'])
    unmount()
    hook = null
    expect(joins[0].leave).toHaveBeenCalled()
    expect(openChannels()).toEqual([])
  })

  it('unmounting leaves the channel joined after Go live', async () => {
    const { result, unmount } = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(openChannels()).toEqual(['CODE123'])
    unmount()
    hook = null
    expect(joins[0].leave).toHaveBeenCalled()
    expect(openChannels()).toEqual([])
  })
})

describe('useLiveStack channel: the organizer ignores what arrives on it (T6.9)', () => {
  it('a snapshot broadcast or a channel status changes nothing: no status, same key, nothing read or published, no re-join', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    const { handlers } = joins[0]
    act(() => {
      handlers.onSnapshot({ version: 99, snapshot: null, ended: true })
      handlers.onStatus('SUBSCRIBED')
      handlers.onStatus('CHANNEL_ERROR')
      handlers.onStatus('CLOSED')
      handlers.onStatus('TIMED_OUT')
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.status).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.key).toEqual({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    expect(loadLiveKey()).toEqual({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    expect(getLiveStack).not.toHaveBeenCalled()
    expect(publishLiveStack).not.toHaveBeenCalled()
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['OLD'])
  })

  it('an ended broadcast does not stop publishing: the next change still publishes from the key’s version + 1', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const { result } = mount()
    act(() => joins[0].handlers.onSnapshot({ version: 50, snapshot: null, ended: true }))
    act(() => result.current.submit(session()))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishLiveStack.mock.calls[0][0]).toMatchObject({ code: 'OLD', version: 5 })
    await waitFor(() => expect(result.current.status).toEqual({ state: 'live' }))
    expect(openChannels()).toEqual(['OLD'])
  })
})
