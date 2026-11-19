// T6.6 Join QR on the TV board: what the Stack page passes to the TV board (TASKS.md T6.6). The QR shows only while
// live: in-page TV mode passes the live key's code while this device has a key and the live status isn't `stopped`;
// the `?tv=1` window reads the key with `loadLiveKey()` and follows `storage` events on `LIVE_KEY_STORAGE_KEY`.
// The live API is mocked (never the network); the hook, publisher and key storage are the real ones.
// The TV's QR is found by its label `paddleStack.tv.join.qrLabel` inside the TV board's `.stack-tv-qr` slot.
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { joinUrl, shortJoinLink } from './live/joinLink'
import { clearLiveKey, LIVE_KEY_STORAGE_KEY, saveLiveKey } from './live/liveKey'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

const { board, tv, live: copy } = paddleStack

const goLive = vi.fn()
const publishLiveStack = vi.fn()
const getLiveStack = vi.fn()

vi.mock('./live/api', async () => {
  const actual = await vi.importActual<typeof import('./live/api')>('./live/api')
  return {
    ...actual,
    goLive: (...a: unknown[]) => goLive(...a),
    publishLiveStack: (...a: unknown[]) => publishLiveStack(...a),
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
  }
})

// qr-creator draws on a real canvas, which jsdom lacks.
const qrRender = vi.fn()
vi.mock('qr-creator', () => ({ default: { render: (...a: unknown[]) => qrRender(...a) } }))

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => true), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

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

function renderPage(path = '/paddle-stack') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackPage />
    </MemoryRouter>,
  )
}

/** A running stack saved on this device: 1 court, Ana Ben Cy Dee on court, Eli and Fay up next. */
function saveRunningStack() {
  saveStack({
    session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] })),
    ended: false,
  })
}

/** The TV board on screen (found by its Exit button). */
function tvBoard(): HTMLElement {
  const exit = screen.getByRole('button', { name: tv.exit })
  const root = exit.closest<HTMLElement>('.stack-tv')
  expect(root, 'the TV board').not.toBeNull()
  return root!
}

function tvSlot(): HTMLElement {
  const el = tvBoard().querySelector<HTMLElement>('.stack-tv-qr')
  expect(el, 'the TV board’s .stack-tv-qr slot').not.toBeNull()
  return el!
}

/** Asserts the TV shows the join QR for `code`: the canvas drawn with joinUrl(code) and the short link. */
function expectJoinQr(code: string) {
  const slot = tvSlot()
  const canvas = within(slot).getByLabelText(tv.join.qrLabel)
  const calls = qrRender.mock.calls.filter((c) => c[1] === canvas)
  expect(calls.length, 'QrCreator.render on the TV canvas').toBeGreaterThanOrEqual(1)
  expect(calls[calls.length - 1][0]).toMatchObject({ text: joinUrl(code) })
  expect(slot).toHaveTextContent(shortJoinLink(code))
  expect(slot).toHaveTextContent(tv.join.title)
}

function expectNoJoinQr() {
  const slot = tvSlot()
  expect(slot).toBeEmptyDOMElement()
  expect(within(tvBoard()).queryByLabelText(tv.join.qrLabel)).not.toBeInTheDocument()
  expect(tvBoard()).not.toHaveTextContent('/paddle-stack/live/')
}

/** The `storage` event the browser fires in this window after another window wrote `key`. */
function fireStorage(key: string) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }))
  })
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  goLive.mockReset().mockResolvedValue({ code: 'PAGECODE', secret: 'PAGESECRET' })
  publishLiveStack.mockReset().mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))
  getLiveStack.mockReset()
  qrRender.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('in-page TV mode: the join QR only while live (T6.6)', () => {
  it('with a live key on this device, TV mode shows the QR and short link for its code', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    await user.click(screen.getByRole('button', { name: tv.open }))
    expectJoinQr('KEPT')
  })

  it('without a live key, TV mode keeps the slot empty', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: tv.open }))
    expectNoJoinQr()
  })

  it('after Go live on the board, TV mode shows the QR for the new code', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    renderPage()
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await screen.findByLabelText(copy.linkLabel)
    await waitFor(() => expect(screen.getByLabelText(copy.status.label)).toHaveTextContent(copy.status.live))
    await user.click(screen.getByRole('button', { name: tv.open }))
    expectJoinQr('PAGECODE')
  })

  it('once publishing has stopped, TV mode shows no QR even with the key still on this device', async () => {
    const { LiveError } = await vi.importActual<typeof import('./live/api')>('./live/api')
    publishLiveStack.mockReset().mockRejectedValue(new LiveError('forbidden'))
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage()
    // A change publishes; the server answers forbidden (another device took over), so publishing stops.
    await user.click(screen.getByRole('button', { name: `${board.timeOut} Eli` }))
    await waitFor(() => expect(screen.getByLabelText(copy.status.label)).toHaveTextContent(copy.status.stopped))
    expect(localStorage.getItem(LIVE_KEY_STORAGE_KEY)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: tv.open }))
    expectNoJoinQr()
  })
})

describe('the ?tv=1 window: the join QR follows the live key on this device (T6.6)', () => {
  it('with a live key saved, the window shows the QR for its code', () => {
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage('/paddle-stack?tv=1')
    expectJoinQr('KEPT')
  })

  it('without a live key, the slot stays empty', () => {
    saveRunningStack()
    renderPage('/paddle-stack?tv=1')
    expectNoJoinQr()
  })

  it('a key saved by the organizer’s window makes the QR appear', () => {
    saveRunningStack()
    renderPage('/paddle-stack?tv=1')
    expectNoJoinQr()
    saveLiveKey({ code: 'NEWCODE', secret: 'NEWSECRET', version: 0 })
    fireStorage(LIVE_KEY_STORAGE_KEY)
    expectJoinQr('NEWCODE')
  })

  it('a key cleared by the organizer’s window makes the QR go', () => {
    saveRunningStack()
    saveLiveKey({ code: 'KEPT', secret: 'KEPTSECRET', version: 3 })
    renderPage('/paddle-stack?tv=1')
    expectJoinQr('KEPT')
    clearLiveKey()
    fireStorage(LIVE_KEY_STORAGE_KEY)
    expectNoJoinQr()
  })

  it('a different key (a hand-off) replaces the QR with the new code', () => {
    saveRunningStack()
    saveLiveKey({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    renderPage('/paddle-stack?tv=1')
    expectJoinQr('OLDCODE')
    saveLiveKey({ code: 'HANDOFF', secret: 'HANDSECRET', version: 0 })
    fireStorage(LIVE_KEY_STORAGE_KEY)
    expectJoinQr('HANDOFF')
    expect(tvSlot()).not.toHaveTextContent(shortJoinLink('OLDCODE'))
  })
})
