// T6.3 Hand-off from a venue: the live controller takes over a venue's key (TASKS.md T6.3). Name from the approved
// plan: `LiveController.adopt(key: LiveKey): void`. It stops this device's publisher (a change still waiting for the
// old key is never sent), saves the key (with its venue when given) to storage and to the hook, clears status and
// error, and publishes nothing by itself; the next change publishes with the adopted key from its version + 1.
// The API is mocked (never the network); the publisher and the key storage are the real ones.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase'
import { createSession, fillCourts } from '../engine'
import type { Session } from '../types'
import { LiveError } from './api'
import { LIVE_KEY_STORAGE_KEY, loadLiveKey, saveLiveKey, type LiveKey } from './liveKey'
import { buildSnapshot } from './snapshot'
import { useLiveStack } from './useLiveStack'

const goLive = vi.fn()
const publishLiveStack = vi.fn()
const getLiveStack = vi.fn()

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    goLive: (...a: unknown[]) => goLive(...a),
    publishLiveStack: (...a: unknown[]) => publishLiveStack(...a),
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    // T6.9: the hook joins its own channel; the stub keeps every test off a real socket.
    subscribeLiveStack: vi.fn(() => () => {}),
  }
})

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

const publishArg = (n: number) => publishLiveStack.mock.calls[n][0] as {
  code: string
  secret: string
  version: number
  snapshot: unknown
  end?: boolean
}

const VENUE_KEY: LiveKey = {
  code: 'VENUECODE',
  secret: 'VENUESECRET',
  version: 12,
  venue: { name: 'Claudex Courts', logoPath: 'venue-1/logo.webp' },
}

let hook: { unmount: () => void } | null = null
function mount() {
  const rendered = renderHook(() => useLiveStack())
  hook = rendered
  return rendered.result
}

beforeEach(() => {
  vi.spyOn(supabase, 'channel')
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  goLive.mockReset()
  publishLiveStack.mockReset()
  getLiveStack.mockReset()
  goLive.mockResolvedValue({ code: 'CODE123', secret: 'SECRET456' })
  publishLiveStack.mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))
})
afterEach(() => {
  // T6.9: no test here opens a real Realtime socket (Supabase's own channel is never reached).
  expect(supabase.channel).not.toHaveBeenCalled()
  hook?.unmount()
  hook = null
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useLiveStack: adopt(key) (T6.3)', () => {
  it('saves the key with its venue to storage and exposes it on the hook', () => {
    const result = mount()
    act(() => result.current.adopt(VENUE_KEY))
    expect(result.current.key).toEqual(VENUE_KEY)
    expect(loadLiveKey()).toEqual(VENUE_KEY)
  })

  it('saves a key given without a venue with no venue', () => {
    const result = mount()
    act(() => result.current.adopt({ code: 'PLAINCODE', secret: 'PLAINSECRET', version: 0 }))
    expect(result.current.key).toEqual({ code: 'PLAINCODE', secret: 'PLAINSECRET', version: 0 })
    expect(loadLiveKey()).toEqual({ code: 'PLAINCODE', secret: 'PLAINSECRET', version: 0 })
    expect(loadLiveKey()!.venue).toBeUndefined()
  })

  it('replaces a key already stored on this device', () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const result = mount()
    act(() => result.current.adopt(VENUE_KEY))
    expect(result.current.key).toEqual(VENUE_KEY)
    expect(JSON.parse(localStorage.getItem(LIVE_KEY_STORAGE_KEY)!)).toMatchObject({ code: 'VENUECODE', secret: 'VENUESECRET', version: 12 })
  })

  it('publishes nothing by itself', async () => {
    const result = mount()
    act(() => result.current.adopt(VENUE_KEY))
    await new Promise((r) => setTimeout(r, 30))
    expect(publishLiveStack).not.toHaveBeenCalled()
    expect(result.current.status).toBeNull()
  })

  it('clears the error left by a failed Go live', async () => {
    goLive.mockRejectedValueOnce(new LiveError('busy'))
    const result = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(result.current.error).toBe('busy')
    act(() => result.current.adopt(VENUE_KEY))
    expect(result.current.error).toBeNull()
  })

  it('clears the status of the earlier stack', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const result = mount()
    act(() => result.current.submit(session()))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'live' }))
    act(() => result.current.adopt(VENUE_KEY))
    expect(result.current.status).toBeNull()
  })

  it('the next change publishes with the adopted key, from its version + 1', async () => {
    const result = mount()
    act(() => result.current.adopt(VENUE_KEY))
    const s = session('Venue night', 3)
    act(() => result.current.submit(s))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0)).toMatchObject({ code: 'VENUECODE', secret: 'VENUESECRET', version: 13 })
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(s))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'live' }))
  })

  it('a publish after adopting keeps the venue in the stored key', async () => {
    const result = mount()
    act(() => result.current.adopt(VENUE_KEY))
    act(() => result.current.submit(session()))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(loadLiveKey()!.version).toBe(13))
    expect(loadLiveKey()!.venue).toEqual(VENUE_KEY.venue)
    expect(result.current.key!.venue).toEqual(VENUE_KEY.venue)
  })

  it('stops the old publisher: a change waiting for the old key is never sent with it', async () => {
    vi.useFakeTimers()
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const result = mount()
    act(() => result.current.submit(session('one')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    expect(publishArg(0).code).toBe('OLD')
    // Inside the 2 s gap: this change waits for the old publisher.
    act(() => result.current.submit(session('two')))
    act(() => result.current.adopt(VENUE_KEY))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(publishLiveStack.mock.calls.map((c) => (c[0] as { code: string }).code)).toEqual(['OLD'])
  })
})
