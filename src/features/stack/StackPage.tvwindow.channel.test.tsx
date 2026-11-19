// T6.9 (mine): the `?tv=1` window never publishes, so it doesn't join the stack's channel; the organizer's own
// page, with the same saved key, does. The live API is mocked (never the network, never a real socket).
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { supabase } from '../../lib/supabase'
import { createSession, fillCourts } from './engine'
import { saveLiveKey } from './live/liveKey'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

const subscribeLiveStack = vi.fn<(code: string, handlers: unknown) => () => void>(() => () => {})

vi.mock('./live/api', async () => {
  const actual = await vi.importActual<typeof import('./live/api')>('./live/api')
  return {
    ...actual,
    goLive: vi.fn(),
    publishLiveStack: vi.fn(),
    getLiveStack: vi.fn(),
    subscribeLiveStack: (code: string, handlers: unknown) => subscribeLiveStack(code, handlers),
  }
})
vi.mock('qr-creator', () => ({ default: { render: vi.fn() } }))
vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => true), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})
vi.mock('../../components/Turnstile', () => ({ Turnstile: () => null }))

// Node 25's own (file-less) `localStorage` global shadows jsdom's here, so each test gets an in-memory Storage.
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackPage />
    </MemoryRouter>,
  )
}

describe('T6.9: the ?tv=1 window and the live channel', () => {
  beforeEach(() => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
    vi.spyOn(supabase, 'channel')
    subscribeLiveStack.mockClear()
    saveStack({
      session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] })),
      ended: false,
    })
    saveLiveKey({ code: 'TVCODE', secret: 'TVSECRET', version: 3 })
  })
  afterEach(() => {
    expect(supabase.channel).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('the ?tv=1 window shows the TV board and joins no channel', () => {
    renderAt('/paddle-stack?tv=1')
    expect(screen.getByRole('button', { name: paddleStack.tv.exit })).toBeInTheDocument()
    expect(subscribeLiveStack).not.toHaveBeenCalled()
  })

  it('the organizer’s page with the same saved key joins live-stack:<code> once', () => {
    renderAt('/paddle-stack')
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(subscribeLiveStack.mock.calls[0][0]).toBe('TVCODE')
  })
})
