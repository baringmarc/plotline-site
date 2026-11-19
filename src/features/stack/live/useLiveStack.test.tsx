// T6.2 Organizer goes live: the page's live controller (TASKS.md T6.2). Names from the approved plan:
// `useLiveStack()` -> `LiveController` { key, status, error, goLive(turnstileToken, session), submit(session),
// end(session), forget() }. goLive calls the API's goLive({ turnstileToken, courts, title }), saves the key
// (version 0), starts a publisher and publishes the session at once; a LiveError sets `error` to its code.
// A key already in storage is loaded on mount with status null (publishing resumes on the next change).
// The API is mocked; the publisher and the key storage are the real ones.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase'
import { createSession, fillCourts } from '../engine'
import type { Session } from '../types'
import { LiveError, type LiveErrorCode } from './api'
import { LIVE_KEY_STORAGE_KEY, loadLiveKey, saveLiveKey } from './liveKey'
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

describe('useLiveStack: before going live (T6.2)', () => {
  it('starts with no key, no status and no error when nothing is stored', () => {
    const result = mount()
    expect(result.current.key).toBeNull()
    expect(result.current.status).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('submit and end do nothing without a key', async () => {
    const result = mount()
    act(() => {
      result.current.submit(session())
      result.current.end(session())
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})

describe('useLiveStack: goLive (T6.2)', () => {
  it('calls the API with the Turnstile token and the session’s courts and title', async () => {
    const result = mount()
    const s = session('Friday Smash', 3)
    await act(async () => {
      await result.current.goLive('turnstile-token-1', s)
    })
    expect(goLive).toHaveBeenCalledTimes(1)
    expect(goLive).toHaveBeenCalledWith({ turnstileToken: 'turnstile-token-1', courts: 3, title: 'Friday Smash' })
  })

  it('on success saves the key in storage and exposes it, with no error', async () => {
    const result = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(result.current.key).toMatchObject({ code: 'CODE123', secret: 'SECRET456' })
    expect(loadLiveKey()).toMatchObject({ code: 'CODE123', secret: 'SECRET456' })
    expect(result.current.error).toBeNull()
  })

  it('on success publishes the session at once as version 1 and shows Live', async () => {
    const result = mount()
    const s = session()
    await act(async () => {
      await result.current.goLive('tok', s)
    })
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    const c = publishArg(0)
    expect(c.code).toBe('CODE123')
    expect(c.secret).toBe('SECRET456')
    expect(c.version).toBe(1)
    expect(c.snapshot).toEqual(buildSnapshot(s))
    expect(c.end ?? false).toBe(false)
    await waitFor(() => expect(result.current.status).toEqual({ state: 'live' }))
  })

  it.each<LiveErrorCode>(['unavailable', 'bot_check_failed', 'busy', 'invalid_input', 'server_error', 'unknown'])(
    'a LiveError %s sets error to its code, keeps no key and publishes nothing',
    async (code) => {
      goLive.mockRejectedValueOnce(new LiveError(code))
      const result = mount()
      await act(async () => {
        await result.current.goLive('tok', session())
      })
      expect(result.current.error).toBe(code)
      expect(result.current.key).toBeNull()
      expect(loadLiveKey()).toBeNull()
      await new Promise((r) => setTimeout(r, 20))
      expect(publishLiveStack).not.toHaveBeenCalled()
    },
  )

  it('a later success clears the earlier error', async () => {
    goLive.mockRejectedValueOnce(new LiveError('busy'))
    const result = mount()
    await act(async () => {
      await result.current.goLive('tok-1', session())
    })
    expect(result.current.error).toBe('busy')
    await act(async () => {
      await result.current.goLive('tok-2', session())
    })
    expect(result.current.error).toBeNull()
    expect(result.current.key).toMatchObject({ code: 'CODE123' })
  })
})

describe('useLiveStack: a key already in storage (T6.2)', () => {
  it('is loaded on mount with status null, and nothing is published until the next change', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const result = mount()
    expect(result.current.key).toMatchObject({ code: 'OLD', secret: 'OLDSECRET' })
    expect(result.current.status).toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('the next change resumes publishing from the stored version + 1 and shows Live', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 4 })
    const result = mount()
    const s = session('Resumed')
    act(() => result.current.submit(s))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0)).toMatchObject({ code: 'OLD', secret: 'OLDSECRET', version: 5 })
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(s))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'live' }))
  })

  it('end(session) publishes the end and shows Stopped (ended)', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const result = mount()
    const s = session('Final')
    act(() => result.current.end(s))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0).end).toBe(true)
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(s))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'stopped', reason: 'ended' }))
  })

  it('a publish refused with forbidden (another device took over) shows Stopped with that reason', async () => {
    publishLiveStack.mockRejectedValueOnce(new LiveError('forbidden'))
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const result = mount()
    act(() => result.current.submit(session()))
    await waitFor(() => expect(result.current.status).toEqual({ state: 'stopped', reason: 'forbidden' }))
  })
})

describe('useLiveStack: forget() (T6.2)', () => {
  it('clears the key from the hook and from storage', async () => {
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 2 })
    const result = mount()
    act(() => result.current.forget())
    expect(result.current.key).toBeNull()
    expect(loadLiveKey()).toBeNull()
    expect(localStorage.getItem(LIVE_KEY_STORAGE_KEY)).toBeNull()
  })

  it('clears the error', async () => {
    goLive.mockRejectedValueOnce(new LiveError('busy'))
    const result = mount()
    await act(async () => {
      await result.current.goLive('tok', session())
    })
    expect(result.current.error).toBe('busy')
    act(() => result.current.forget())
    expect(result.current.error).toBeNull()
  })

  it('stops the publisher: a pending change is never sent, and later changes do nothing', async () => {
    vi.useFakeTimers()
    saveLiveKey({ code: 'OLD', secret: 'OLDSECRET', version: 0 })
    const result = mount()
    act(() => result.current.submit(session('one')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
    act(() => result.current.submit(session('two')))
    act(() => result.current.forget())
    act(() => result.current.submit(session('three')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(publishLiveStack).toHaveBeenCalledTimes(1)
  })
})
