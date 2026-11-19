// T6.2 Organizer goes live: what the page wires (TASKS.md T6.2). The Go live panel sits on the board; every change
// the page commits goes to live.submit(session), End session to live.end(session), Start over to live.forget().
// The publish rules themselves are in live/publisher.test.ts. The live API is mocked (never the network); the hook,
// publisher and key storage are the real ones. Copy from `paddleStack` (src/config/site.ts).
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { LIVE_KEY_STORAGE_KEY, loadLiveKey, saveLiveKey } from './live/liveKey'
import { buildSnapshot } from './live/snapshot'
import { StackPage } from './StackPage'
import { loadStack, saveStack } from './storage'

const { board, end, live: copy } = paddleStack

const goLive = vi.fn()
const publishLiveStack = vi.fn()
const getLiveStack = vi.fn()

/** T6.9: every channel the page joins (through subscribeLiveStack, a stub: no real socket) and its leave function. */
type Join = { code: string; leave: ReturnType<typeof vi.fn> }
let joins: Join[] = []
const subscribeLiveStack = vi.fn((code: string) => {
  const leave = vi.fn()
  joins.push({ code, leave })
  return leave
})
const openChannels = () => joins.filter((j) => j.leave.mock.calls.length === 0).map((j) => j.code)

vi.mock('./live/api', async () => {
  const actual = await vi.importActual<typeof import('./live/api')>('./live/api')
  return {
    ...actual,
    goLive: (...a: unknown[]) => goLive(...a),
    publishLiveStack: (...a: unknown[]) => publishLiveStack(...a),
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    subscribeLiveStack: (code: string) => subscribeLiveStack(code),
  }
})

// qr-creator draws on a real canvas, which jsdom lacks.
vi.mock('qr-creator', () => ({ default: { render: vi.fn() } }))

// Cloudflare's widget, replaced by a button that hands over a token.
vi.mock('../../components/Turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('page-token')}>
      Pass the check
    </button>
  ),
}))

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

function renderPage() {
  return render(
    <MemoryRouter>
      <StackPage />
    </MemoryRouter>,
  )
}

/** A running stack saved on this device: 1 court, Ana Ben Cy Dee on court, Eli and Fay up next. */
function saveRunningStack() {
  const session = fillCourts(
    createSession({ format: 'fair', courts: 1, title: 'Tuesday Open Play', names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] }),
  )
  saveStack({ session, ended: false })
  return session
}

const publishArg = (n: number) => publishLiveStack.mock.calls[n][0] as {
  code: string
  secret: string
  version: number
  snapshot: unknown
  end?: boolean
}

beforeEach(() => {
  joins = []
  subscribeLiveStack.mockClear()
  vi.spyOn(supabase, 'channel')
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  goLive.mockReset().mockResolvedValue({ code: 'PAGECODE', secret: 'PAGESECRET' })
  publishLiveStack.mockReset().mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))
  getLiveStack.mockReset()
})
afterEach(() => {
  // T6.9: no test here opens a real Realtime socket (Supabase's own channel is never reached).
  expect(supabase.channel).not.toHaveBeenCalled()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('StackPage live wiring (T6.2)', () => {
  it('the start screen has no Go live; the board does', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: copy.goLive })).not.toBeInTheDocument()
  })

  it('Go live on the board sends the session’s courts and title, then publishes the board and shows the link', async () => {
    const user = userEvent.setup()
    const session = saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await waitFor(() => expect(goLive).toHaveBeenCalledTimes(1))
    expect(goLive).toHaveBeenCalledWith({ turnstileToken: 'page-token', courts: 1, title: 'Tuesday Open Play' })
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0)).toMatchObject({ code: 'PAGECODE', secret: 'PAGESECRET', version: 1 })
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(session))
    const field = (await screen.findByLabelText(copy.linkLabel)) as HTMLInputElement
    expect(field.value).toBe(`${window.location.origin}/paddle-stack/live/PAGECODE`)
    expect(loadLiveKey()).toMatchObject({ code: 'PAGECODE', secret: 'PAGESECRET' })
  })

  it('with a stored key, opening the page publishes nothing until a change', async () => {
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    expect(await screen.findByLabelText(copy.linkLabel)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 30))
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('with a stored key, a change on the board publishes the new board', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    await user.click(screen.getByRole('button', { name: `${board.timeOut} Eli` }))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0)).toMatchObject({ code: 'KEPT', secret: 'KEPTSECRET', version: 4 })
    expect(publishArg(0).end ?? false).toBe(false)
    // The published board is the one the page just saved (Eli on a break).
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(loadStack()!.session))
    await waitFor(() => expect(screen.getByLabelText(copy.status.label)).toHaveTextContent(copy.status.live))
  })

  it('without a key, changes publish nothing', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: `${board.timeOut} Eli` }))
    await new Promise((r) => setTimeout(r, 30))
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('End session publishes the final board with end: true', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    expect(publishArg(0).end).toBe(true)
    expect(publishArg(0)).toMatchObject({ code: 'KEPT', secret: 'KEPTSECRET', version: 4 })
    expect(publishArg(0).snapshot).toEqual(buildSnapshot(loadStack()!.session))
  })

  it('Start over forgets the live key and publishes nothing', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    await user.click(screen.getByRole('button', { name: paddleStack.restart }))
    expect(loadLiveKey()).toBeNull()
    expect(localStorage.getItem(LIVE_KEY_STORAGE_KEY)).toBeNull()
    await new Promise((r) => setTimeout(r, 30))
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('unavailable says Go live is off and the board keeps working', async () => {
    const { LiveError } = await vi.importActual<typeof import('./live/api')>('./live/api')
    goLive.mockReset().mockRejectedValue(new LiveError('unavailable'))
    const user = userEvent.setup()
    saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    expect(await screen.findByText(copy.errors.unavailable)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.goLive })).toBeEnabled()
    // The board still works: a change is saved on this device, and nothing is published.
    await user.click(screen.getByRole('button', { name: `${board.timeOut} Eli` }))
    expect(loadStack()!.session.players.find((p) => p.name === 'Eli')!.status).toBe('out')
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})

describe('StackPage joins its own live channel (T6.9)', () => {
  it('without a key, the page joins no channel', async () => {
    saveRunningStack()
    renderPage()
    await new Promise((r) => setTimeout(r, 30))
    expect(subscribeLiveStack).not.toHaveBeenCalled()
  })

  it('Go live joins live-stack:<code> for the new code, once, and keeps it after the first publish', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await waitFor(() => expect(openChannels()).toEqual(['PAGECODE']))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    // The publish moved the stored version on; the channel is the same one.
    await waitFor(() => expect(loadLiveKey()!.version).toBe(1))
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
    expect(openChannels()).toEqual(['PAGECODE'])
  })

  it('with a stored key (a reload), opening the page joins that code', async () => {
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    expect(await screen.findByLabelText(copy.linkLabel)).toBeInTheDocument()
    expect(openChannels()).toEqual(['KEPT'])
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
  })

  it('Start over leaves the channel', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    expect(openChannels()).toEqual(['KEPT'])
    await user.click(screen.getByRole('button', { name: paddleStack.restart }))
    expect(openChannels()).toEqual([])
    expect(subscribeLiveStack).toHaveBeenCalledTimes(1)
  })

  it('End session (publishing stops for good) leaves the channel', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    expect(openChannels()).toEqual(['KEPT'])
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))
    await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(openChannels()).toEqual([]))
  })

  it('leaving the page (unmount) leaves the channel', () => {
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    const { unmount } = renderPage()
    expect(openChannels()).toEqual(['KEPT'])
    unmount()
    expect(openChannels()).toEqual([])
  })
})
