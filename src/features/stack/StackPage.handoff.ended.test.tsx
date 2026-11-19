// T6.3 review fix (mine): a hand-off link to a stack that has already ended says so, and stores nothing and starts no
// session (get_live_stack still returns an ended stack until it expires; PLATFORM.md §4).
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { paddleStack } from '../../config/paddleStack'
import { LIVE_KEY_STORAGE_KEY } from './live/liveKey'
import { StackPage } from './StackPage'
import { STACK_STORAGE_KEY } from './storage'

const getLiveStack = vi.fn()
vi.mock('./live/api', async () => {
  const actual = await vi.importActual<typeof import('./live/api')>('./live/api')
  return { ...actual, getLiveStack: (...a: unknown[]) => getLiveStack(...a), publishLiveStack: vi.fn(), goLive: vi.fn(),
    // T6.9: the page joins its own channel; the stub keeps every test off a real socket.
    subscribeLiveStack: vi.fn(() => () => {}) }
})
vi.mock('qr-creator', () => ({ default: { render: vi.fn() } }))

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

beforeEach(() => {
  vi.spyOn(supabase, 'channel')
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  window.history.replaceState(null, '', '/paddle-stack?live=ENDEDCODE#key=ENDEDSECRET')
  getLiveStack.mockReset().mockResolvedValue({
    title: 'Done',
    courts: 2,
    snapshot: null,
    version: 9,
    ended: true,
    expiresAt: '2026-11-20T10:00:00Z',
    venue: null,
  })
})
afterEach(() => {
  // T6.9: no test here opens a real Realtime socket (Supabase's own channel is never reached).
  expect(supabase.channel).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('StackPage hand-off to an ended stack (T6.3 review)', () => {
  it('says the stack has ended, stores no key and starts no session', async () => {
    render(
      <MemoryRouter>
        <StackPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(paddleStack.handoff.expired)).toBeInTheDocument()
    expect(localStorage.getItem(LIVE_KEY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(STACK_STORAGE_KEY)).toBeNull()
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.location.hash).toBe('')
  })
})
