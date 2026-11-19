// T6.3 Hand-off from a venue (TASKS.md T6.3; court-booking-system docs/PLATFORM.md §4 "Live stacks", "Hand-off from
// a venue's /admin/open-play"). A venue's /admin/open-play opens `/paddle-stack?live=<code>#key=<secret>`. On mount
// (not in the `?tv=1` window) the page parses it with parseHandoff, removes the query and the fragment from the
// address bar at once (history.replaceState to `/paddle-stack`) whatever happens next, then reads the stack with
// getLiveStack(code):
// - a link that doesn't parse: `handoff.bad`, and no read;
// - null (unknown or expired): `handoff.expired`, no key stored, no session started;
// - an error: `handoff.failed`, no key stored;
// - otherwise: the key (code, secret, version = view.version, the venue when there is one) is stored and a session
//   starts with the view's title and courts (fillCourts(createSession({ format: 'fair', courts, title }))). Starting
//   it is the first change, so it is published once, as version view.version + 1. The board shows the venue's name
//   (`handoff.venueOf(name)`) and its logo (an img with alt="" from venue-media), only when the key has a venue.
// A session already running on this device asks first (`handoff.ask`, `handoff.replace`, `handoff.keep`); an ended
// one is replaced without asking. The live API is mocked (never the network); the hook, publisher and key storage
// are the real ones. Copy from `paddleStack.handoff` (src/config/paddleStack.ts, re-exported by src/config/site.ts).
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { LiveError, type LiveStackView } from './live/api'
import { loadLiveKey, saveLiveKey } from './live/liveKey'
import { buildSnapshot } from './live/snapshot'
import { StackPage } from './StackPage'
import { loadStack, saveStack } from './storage'

const { board, live: liveCopy } = paddleStack
/** Read lazily so a missing key fails the test that uses it, not the whole file. */
const copy = () => paddleStack.handoff

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

const CODE = 'VENUECODE_1-x'
const SECRET = 'VenueSecret_42-abc'
const LINK = `/paddle-stack?live=${CODE}#key=${SECRET}`
const LOGO_PATH = 'venue-1/logo.webp'
const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/venue-media/${LOGO_PATH}`

function view(over: Partial<LiveStackView> = {}): LiveStackView {
  return {
    title: 'Claudex Open Play',
    courts: 3,
    snapshot: null,
    version: 5,
    ended: false,
    expiresAt: '2026-11-20T10:00:00Z',
    venue: { name: 'Claudex Courts', slug: 'claudex', logoPath: LOGO_PATH },
    ...over,
  }
}

/** The session the hand-off starts: the view's title and courts, nobody yet. */
const handoffSession = (v: LiveStackView = view()) =>
  fillCourts(createSession({ format: 'fair', courts: v.courts, title: v.title }))

/** Opens the page at `url`, as both the browser's address bar and the router see it. */
function openAt(url: string) {
  window.history.replaceState(null, '', url)
  return render(
    <MemoryRouter initialEntries={[url]}>
      <StackPage />
    </MemoryRouter>,
  )
}

/** A running stack saved on this device: 1 court, Ana Ben Cy Dee on court, Eli and Fay up next. */
function saveRunningStack(ended = false) {
  const session = fillCourts(
    createSession({ format: 'fair', courts: 1, title: 'Tuesday Open Play', names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] }),
  )
  saveStack({ session, ended })
  return session
}

const publishArg = (n: number) => publishLiveStack.mock.calls[n][0] as {
  code: string
  secret: string
  version: number
  snapshot: unknown
  end?: boolean
}

const settle = () => new Promise((r) => setTimeout(r, 50))

function expectAddressBarClean() {
  expect(window.location.pathname).toBe('/paddle-stack')
  expect(window.location.search).toBe('')
  expect(window.location.hash).toBe('')
  expect(window.location.href).not.toContain(SECRET)
}

/** The board of the hand-off session is showing: its title and its three courts. */
async function expectHandoffBoard(v: LiveStackView = view()) {
  expect(await screen.findByRole('heading', { name: v.title })).toBeInTheDocument()
  for (let n = 1; n <= v.courts; n++) {
    expect(screen.getByRole('heading', { name: `${board.court} ${n}` })).toBeInTheDocument()
  }
}

/** The page published the hand-off session exactly once, as version view.version + 1, with the venue's key. */
async function expectOnePublishOfHandoff(v: LiveStackView = view()) {
  await waitFor(() => expect(publishLiveStack).toHaveBeenCalledTimes(1))
  await settle()
  expect(publishLiveStack).toHaveBeenCalledTimes(1)
  expect(publishArg(0)).toMatchObject({ code: CODE, secret: SECRET, version: v.version + 1 })
  expect(publishArg(0).end ?? false).toBe(false)
  expect(publishArg(0).snapshot).toEqual(buildSnapshot(handoffSession(v)))
}

const venueLogo = (container: HTMLElement) => container.querySelector(`img[src="${LOGO_URL}"]`)

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  goLive.mockReset()
  publishLiveStack.mockReset().mockImplementation(async (input: { version: number }) => ({
    version: input.version,
    expiresAt: '2026-11-20T10:00:00Z',
  }))
  getLiveStack.mockReset().mockResolvedValue(view())
})
afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('StackPage hand-off: the address bar (T6.3)', () => {
  it('removes the query and the secret fragment at once, before the stack is read', () => {
    getLiveStack.mockReset().mockReturnValue(new Promise(() => {}))
    openAt(LINK)
    expectAddressBarClean()
  })

  it('removes them after a good hand-off', async () => {
    openAt(LINK)
    await expectHandoffBoard()
    expectAddressBarClean()
  })

  it('removes them for a link that does not parse', async () => {
    openAt(`/paddle-stack?live=${CODE}#key=bad/secret`)
    await screen.findByText(copy().bad)
    expectAddressBarClean()
    expect(window.location.href).not.toContain('bad/secret')
  })

  it('removes them for an expired code', async () => {
    getLiveStack.mockReset().mockResolvedValue(null)
    openAt(LINK)
    await screen.findByText(copy().expired)
    expectAddressBarClean()
  })

  it('removes them when reading the stack fails', async () => {
    getLiveStack.mockReset().mockRejectedValue(new LiveError('server_error'))
    openAt(LINK)
    await screen.findByText(copy().failed)
    expectAddressBarClean()
  })

  it('removes them while asking about a running session', async () => {
    saveRunningStack()
    openAt(LINK)
    await screen.findByText(copy().ask)
    expectAddressBarClean()
  })
})

describe('StackPage hand-off: a bad or expired link (T6.3)', () => {
  it.each([
    ['no secret fragment', `/paddle-stack?live=${CODE}`],
    ['an empty secret', `/paddle-stack?live=${CODE}#key=`],
    ['a secret with a slash', `/paddle-stack?live=${CODE}#key=ab/cd`],
    ['a code with a space', `/paddle-stack?live=ab%20cd#key=${SECRET}`],
    ['an empty code', `/paddle-stack?live=#key=${SECRET}`],
  ])('a link that does not parse (%s) says so and reads nothing', async (_label, url) => {
    openAt(url)
    expect(await screen.findByText(copy().bad)).toBeInTheDocument()
    await settle()
    expect(getLiveStack).not.toHaveBeenCalled()
    expect(loadLiveKey()).toBeNull()
    expect(loadStack()).toBeNull()
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('an unknown or expired code says so, stores no key and starts no session', async () => {
    getLiveStack.mockReset().mockResolvedValue(null)
    openAt(LINK)
    expect(await screen.findByText(copy().expired)).toBeInTheDocument()
    expect(getLiveStack).toHaveBeenCalledWith(CODE)
    await settle()
    expect(loadLiveKey()).toBeNull()
    expect(loadStack()).toBeNull()
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it.each([
    ['a LiveError', () => new LiveError('server_error')],
    ['an invalid snapshot', () => new LiveError('invalid_snapshot')],
    ['a network error', () => new TypeError('Failed to fetch')],
  ])('reading the stack failing (%s) says so and stores no key', async (_label, makeError) => {
    getLiveStack.mockReset().mockRejectedValue(makeError())
    openAt(LINK)
    expect(await screen.findByText(copy().failed)).toBeInTheDocument()
    await settle()
    expect(loadLiveKey()).toBeNull()
    expect(loadStack()).toBeNull()
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('the plain page (no live parameter) reads nothing and shows no hand-off message', async () => {
    openAt('/paddle-stack')
    await settle()
    expect(getLiveStack).not.toHaveBeenCalled()
    expect(screen.queryByText(copy().bad)).not.toBeInTheDocument()
    expect(screen.queryByText(copy().ask)).not.toBeInTheDocument()
  })

  it('the ?tv=1 window does not take a hand-off', async () => {
    const running = saveRunningStack()
    openAt(`/paddle-stack?tv=1&live=${CODE}#key=${SECRET}`)
    await settle()
    expect(getLiveStack).not.toHaveBeenCalled()
    expect(loadLiveKey()).toBeNull()
    expect(loadStack()!.session).toEqual(running)
    expect(publishLiveStack).not.toHaveBeenCalled()
  })
})

describe('StackPage hand-off: no session on this device (T6.3)', () => {
  it('reads the stack by its code, once', async () => {
    openAt(LINK)
    await expectHandoffBoard()
    expect(getLiveStack).toHaveBeenCalledTimes(1)
    expect(getLiveStack).toHaveBeenCalledWith(CODE)
  })

  it('stores the secret on this device with the code, the venue and the stack’s version', async () => {
    openAt(LINK)
    await expectHandoffBoard()
    // Version 5 is stored, then the first publish (version 6) moves it on.
    await waitFor(() =>
      expect(loadLiveKey()).toEqual({
        code: CODE,
        secret: SECRET,
        version: 6,
        venue: { name: 'Claudex Courts', logoPath: LOGO_PATH },
      }),
    )
  })

  it('starts a session with the stack’s title and courts, saved on this device', async () => {
    openAt(LINK)
    await expectHandoffBoard()
    expect(loadStack()).toEqual({ session: handoffSession(), ended: false })
  })

  it('publishes the new session once, as the stack’s version + 1', async () => {
    openAt(LINK)
    await expectHandoffBoard()
    await expectOnePublishOfHandoff()
  })

  it('shows the board as live, with the players’ link for the venue’s code', async () => {
    openAt(LINK)
    const field = (await screen.findByLabelText(liveCopy.linkLabel)) as HTMLInputElement
    expect(field.value).toBe(`${window.location.origin}/paddle-stack/live/${CODE}`)
  })

  it('shows the venue’s name and its logo', async () => {
    const { container } = openAt(LINK)
    expect(await screen.findByText(copy().venueOf('Claudex Courts'))).toBeInTheDocument()
    const logo = venueLogo(container)
    expect(logo).not.toBeNull()
    expect(logo!.getAttribute('alt')).toBe('')
  })

  it('a venue with no logo shows its name and no logo', async () => {
    getLiveStack.mockReset().mockResolvedValue(view({ venue: { name: 'Claudex Courts', slug: 'claudex', logoPath: null } }))
    const { container } = openAt(LINK)
    expect(await screen.findByText(copy().venueOf('Claudex Courts'))).toBeInTheDocument()
    expect(container.querySelector('img[src*="venue-media"]')).toBeNull()
    await waitFor(() => expect(loadLiveKey()?.venue).toEqual({ name: 'Claudex Courts', logoPath: null }))
  })

  it('a stack with no venue stores the key without one and shows no venue header', async () => {
    const plain = view({ venue: null })
    getLiveStack.mockReset().mockResolvedValue(plain)
    const { container } = openAt(LINK)
    await expectHandoffBoard(plain)
    await expectOnePublishOfHandoff(plain)
    expect(loadLiveKey()).toMatchObject({ code: CODE, secret: SECRET })
    expect(loadLiveKey()!.venue).toBeUndefined()
    expect(screen.queryByText(copy().venueOf('Claudex Courts'))).not.toBeInTheDocument()
    expect(container.querySelector('img[src*="venue-media"]')).toBeNull()
  })
})

describe('StackPage hand-off: a session already on this device (T6.3)', () => {
  it('a running session asks before replacing it, with Replace and Keep', async () => {
    saveRunningStack()
    openAt(LINK)
    expect(await screen.findByText(copy().ask)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy().replace })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy().keep })).toBeInTheDocument()
  })

  it('while asking, nothing is stored or published', async () => {
    const running = saveRunningStack()
    saveLiveKey({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    openAt(LINK)
    await screen.findByText(copy().ask)
    await settle()
    expect(loadLiveKey()).toEqual({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    expect(loadStack()).toEqual({ session: running, ended: false })
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('Keep leaves the running session and the stored key untouched, and publishes nothing', async () => {
    const user = userEvent.setup()
    const running = saveRunningStack()
    saveLiveKey({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    openAt(LINK)
    await user.click(await screen.findByRole('button', { name: copy().keep }))
    expect(screen.queryByText(copy().ask)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tuesday Open Play' })).toBeInTheDocument()
    await settle()
    expect(loadStack()).toEqual({ session: running, ended: false })
    expect(loadLiveKey()).toEqual({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    expect(publishLiveStack).not.toHaveBeenCalled()
    expect(screen.queryByText(copy().venueOf('Claudex Courts'))).not.toBeInTheDocument()
  })

  it('Keep with no stored key stores none', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    openAt(LINK)
    await user.click(await screen.findByRole('button', { name: copy().keep }))
    await settle()
    expect(loadLiveKey()).toBeNull()
    expect(publishLiveStack).not.toHaveBeenCalled()
  })

  it('Replace stores the venue’s key, starts the hand-off session and publishes it once', async () => {
    const user = userEvent.setup()
    saveRunningStack()
    saveLiveKey({ code: 'OLDCODE', secret: 'OLDSECRET', version: 3 })
    const { container } = openAt(LINK)
    await user.click(await screen.findByRole('button', { name: copy().replace }))
    await expectHandoffBoard()
    expect(screen.queryByText(copy().ask)).not.toBeInTheDocument()
    expect(loadStack()).toEqual({ session: handoffSession(), ended: false })
    await expectOnePublishOfHandoff()
    await waitFor(() =>
      expect(loadLiveKey()).toEqual({
        code: CODE,
        secret: SECRET,
        version: 6,
        venue: { name: 'Claudex Courts', logoPath: LOGO_PATH },
      }),
    )
    expect(screen.getByText(copy().venueOf('Claudex Courts'))).toBeInTheDocument()
    expect(venueLogo(container)).not.toBeNull()
  })

  it('an ended session on this device is replaced without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveRunningStack(true)
    openAt(LINK)
    await expectHandoffBoard()
    expect(screen.queryByText(copy().ask)).not.toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    expect(loadStack()).toEqual({ session: handoffSession(), ended: false })
    await expectOnePublishOfHandoff()
    expect(loadLiveKey()).toMatchObject({ code: CODE, secret: SECRET })
  })
})

describe('StackPage hand-off: the venue header after a reload (T6.3)', () => {
  it('a stored key with a venue shows the venue’s name and logo on the board', async () => {
    saveRunningStack()
    saveLiveKey({ code: CODE, secret: SECRET, version: 6, venue: { name: 'Claudex Courts', logoPath: LOGO_PATH } })
    const { container } = openAt('/paddle-stack')
    expect(await screen.findByText(copy().venueOf('Claudex Courts'))).toBeInTheDocument()
    expect(venueLogo(container)).not.toBeNull()
  })

  it('a stored key without a venue shows no venue header', async () => {
    saveRunningStack()
    saveLiveKey({ code: 'PLAIN', secret: 'PLAINSECRET', version: 2 })
    const { container } = openAt('/paddle-stack')
    expect(await screen.findByLabelText(liveCopy.linkLabel)).toBeInTheDocument()
    expect(screen.queryByText(copy().venueOf('Claudex Courts'))).not.toBeInTheDocument()
    expect(container.querySelector('img[src*="venue-media"]')).toBeNull()
  })
})
