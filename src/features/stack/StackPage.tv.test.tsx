// T5.4 TV mode and call-outs on the Stack page (TASKS.md T5.4; SPEC §3 `/paddle-stack` row). StackPage.test.tsx
// (T5.3) stays as is; these are the T5.4 additions. Copy from `paddleStack.tv` / `paddleStack.voice`.
//
// Structure the tests rely on (the plan's names):
// - on the board, a button `tv.open` switches to `TvBoard` (footer `tv.footer`, button `tv.exit`), asks for full
//   screen (`document.documentElement.requestFullscreen`, when it exists) and `requestWakeLock()`; leaving TV mode
//   (`tv.exit` or Escape) shows the board again and calls the release function;
// - a checkbox labelled `voice.label`, kept with `loadVoicePref` / `saveVoicePref`, and a `voice.test` button;
// - with voice on, each newly filled court is announced once with `announce(callOutText(...))`;
// - when `canSpeak()` is false the checkbox is disabled and `voice.unsupported` shows.
// Added (user, 2026-11-12, after review round 1; SPEC §6 rows 2026-11-12):
// - on the organizer's board, a button `tv.openWindow` calls `window.open('/paddle-stack?tv=1', tv.windowName)`;
// - with `?tv=1` in the URL (React Router's `useSearchParams`) the page renders only `TvBoard` for the saved
//   session, and its Exit calls `window.close()`; with nothing saved it shows the normal start screen;
// - every StackPage listens on `window` for `storage` events: one with key `STACK_STORAGE_KEY` reloads the state
//   with `loadStack()`, other keys are ignored; in the `?tv=1` window a game that appears this way sets the
//   "Next up on Court N" banner; a storage event never calls `announce`;
// - `fullscreenchange` (on `document`) with no `document.fullscreenElement`, after TV mode asked for full screen,
//   closes in-page TV mode; unmounting while TV mode is open releases the wake lock.
// `./voice` is mocked, except `callOutText`, which stays real.
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts, recordScore } from './engine'
import { StackPage } from './StackPage'
import { STACK_STORAGE_KEY, clearStack, loadStack, loadVoicePref, saveStack, saveVoicePref } from './storage'
import type { Session } from './types'
import { announce, callOutText, canSpeak, requestWakeLock } from './voice'

const mocks = vi.hoisted(() => ({ release: vi.fn() }))

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return {
    ...actual,
    canSpeak: vi.fn(() => true),
    announce: vi.fn(() => true),
    requestWakeLock: vi.fn(() => Promise.resolve(mocks.release)),
  }
})

const { start, board, tv, voice, venueCta } = paddleStack
const SIX = '1. Andrew\n2. Maria\n3. Juan\n4. Jose\n5. Ana\n6. Ben'
const EIGHT = `${SIX}\n7. Carla\n8. Dino`

type User = ReturnType<typeof userEvent.setup>

function renderPage(path = '/paddle-stack') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackPage />
    </MemoryRouter>,
  )
}

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

async function startStack(user: User, opts: { courts?: number; names?: string } = {}) {
  const control = screen.getByLabelText(start.courtsLabel)
  if (control.tagName === 'SELECT') {
    await user.selectOptions(control, String(opts.courts ?? 1))
  } else {
    await user.clear(control)
    await user.type(control, String(opts.courts ?? 1))
  }
  const fair = paddleStack.formats.find((f) => f.id === 'fair')!.label
  const radio = screen.queryByRole('radio', { name: re(fair) })
  if (radio) await user.click(radio)
  else await user.selectOptions(screen.getByRole('combobox', { name: start.formatLabel }), screen.getByRole('option', { name: re(fair) }))
  const box = screen.getByRole('textbox', { name: start.namesLabel })
  await user.click(box)
  await user.paste(opts.names ?? SIX)
  await user.click(screen.getByRole('button', { name: start.submit }))
}

const court = (n: number) => screen.getByRole('region', { name: `${board.court} ${n}` })

async function enterScore(user: User, n: number, a: number, b: number) {
  const c = court(n)
  await user.click(within(c).getByRole('button', { name: board.enterScore }))
  const inputs = within(c).getAllByLabelText(re(board.scoreFor))
  await user.type(inputs[0], String(a))
  await user.type(inputs[1], String(b))
  await user.click(within(c).getByRole('button', { name: board.saveScore }))
}

/** The call-out for the game now playing on court `n`, read from the saved session. */
function expectedCallOut(n: number): string {
  const s = loadStack()!.session
  const g = s.games.find((x) => x.status === 'playing' && x.court === n)!
  const name = (id: string) => s.players.find((p) => p.id === id)!.name
  return callOutText(n, [name(g.teamA[0]), name(g.teamA[1])], [name(g.teamB[0]), name(g.teamB[1])])
}

const voiceBox = () => screen.getByRole('checkbox', { name: voice.label })

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

const root = document.documentElement as unknown as { requestFullscreen?: unknown }
const doc = document as unknown as { fullscreenElement?: unknown }

const TEN = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Fred']

/** Saves a started session, as the organizer's window would, before the page under test renders. */
function saveSession(courts: number, names: string[]): Session {
  const session = fillCourts(createSession({ format: 'fair', courts, names }))
  saveStack({ session, ended: false })
  return session
}

/** The other window on this device: changes the saved session and refills the courts, like the page's actions. */
function otherWindowScores(n: number, a = 11, b = 5): Session {
  const cur = loadStack()!
  const g = cur.session.games.find((x) => x.status === 'playing' && x.court === n)!
  const session = fillCourts(recordScore(cur.session, g.id, a, b))
  saveStack({ ...cur, session })
  return session
}

/** The `storage` event the browser fires in this window after another window wrote `key`. */
function fireStorage(key: string | null = STACK_STORAGE_KEY) {
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key, newValue: key ? localStorage.getItem(key) : null }),
    )
  })
}

const tick = () => act(() => new Promise((r) => setTimeout(r, 0)))

function setFullscreenElement(el: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true })
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  vi.mocked(canSpeak).mockReset().mockReturnValue(true)
  vi.mocked(announce).mockReset().mockReturnValue(true)
  vi.mocked(requestWakeLock).mockReset().mockResolvedValue(mocks.release)
  mocks.release.mockReset()
})
afterEach(() => {
  delete root.requestFullscreen
  delete doc.fullscreenElement
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('StackPage TV mode (T5.4)', () => {
  it('a TV mode button on the board opens the TV board', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByRole('button', { name: tv.open })).not.toBeInTheDocument()
    await startStack(user, { courts: 1 })
    await user.click(screen.getByRole('button', { name: tv.open }))
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: tv.exit })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: `${tv.court} 1` })).toHaveTextContent('Andrew')
    // The organizer's controls are not on the TV.
    expect(screen.queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
  })

  it('asks for full screen and the screen wake lock when TV mode opens', async () => {
    const user = userEvent.setup()
    const requestFullscreen = vi.fn(() => Promise.resolve())
    root.requestFullscreen = requestFullscreen
    renderPage()
    await startStack(user)
    expect(requestWakeLock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: tv.open }))
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(requestWakeLock).toHaveBeenCalledTimes(1)
  })

  it('opens without errors where full screen is unsupported', async () => {
    const user = userEvent.setup()
    expect(root.requestFullscreen).toBeUndefined()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
  })

  it('opens without errors when full screen is refused', async () => {
    const user = userEvent.setup()
    root.requestFullscreen = vi.fn(() => Promise.reject(new TypeError('Permissions check failed')))
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
  })

  it('exit shows the board again and releases the wake lock', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    await user.click(screen.getByRole('button', { name: tv.exit }))
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
    expect(within(court(1)).getByRole('button', { name: board.enterScore })).toBeInTheDocument()
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('Escape leaves TV mode', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    await user.keyboard('{Escape}')
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: tv.open })).toBeInTheDocument()
  })
})

describe('StackPage voice switch (T5.4 off switch, voice off by default)', () => {
  it('is off by default, and turning it on is saved', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expect(voiceBox()).not.toBeChecked()
    expect(voiceBox()).toBeEnabled()
    await user.click(voiceBox())
    expect(voiceBox()).toBeChecked()
    expect(loadVoicePref()).toBe(true)
    await user.click(voiceBox())
    expect(voiceBox()).not.toBeChecked()
    expect(loadVoicePref()).toBe(false)
  })

  it('starts checked when the saved preference is on', async () => {
    const user = userEvent.setup()
    saveVoicePref(true)
    renderPage()
    await startStack(user)
    expect(voiceBox()).toBeChecked()
  })

  it('"Test the voice" speaks the sample call-out', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    vi.mocked(announce).mockClear()
    await user.click(screen.getByRole('button', { name: voice.test }))
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(callOutText(voice.sample.court, voice.sample.a, voice.sample.b))
  })
})

describe('StackPage call-outs (T5.4 a court is announced once when it fills)', () => {
  it('with voice on, announces each court filled at the start once, with the four names', async () => {
    const user = userEvent.setup()
    saveVoicePref(true)
    renderPage()
    await startStack(user, { courts: 2, names: EIGHT })
    expect(announce).toHaveBeenCalledTimes(2)
    // Fair rotation, positions 1 & 3 against 2 & 4.
    expect(announce).toHaveBeenCalledWith('Court 1: Andrew and Juan, versus Maria and Jose.')
    expect(announce).toHaveBeenCalledWith('Court 2: Ana and Carla, versus Ben and Dino.')
  })

  it('announces the next game when a court refills after a score, and nothing else', async () => {
    const user = userEvent.setup()
    saveVoicePref(true)
    renderPage()
    await startStack(user, { courts: 1 })
    expect(announce).toHaveBeenCalledTimes(1)
    await enterScore(user, 1, 11, 7)
    expect(announce).toHaveBeenCalledTimes(2)
    expect(announce).toHaveBeenLastCalledWith(expectedCallOut(1))
    expect(expectedCallOut(1)).not.toBe('Court 1: Andrew and Juan, versus Maria and Jose.')
    // A change that fills no court is not announced.
    const waiting = within(screen.getByRole('region', { name: board.upNext })).getAllByRole('listitem')[0]
    await user.click(within(waiting).getByRole('button', { name: re(board.timeOut) }))
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('announces a court filled after a skipped game', async () => {
    const user = userEvent.setup()
    saveVoicePref(true)
    renderPage()
    await startStack(user, { courts: 1 })
    await user.click(within(court(1)).getByRole('button', { name: board.skipScore }))
    expect(announce).toHaveBeenCalledTimes(2)
    expect(announce).toHaveBeenLastCalledWith(expectedCallOut(1))
  })

  it('with voice off, nothing is announced', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { courts: 2, names: EIGHT })
    await enterScore(user, 1, 11, 4)
    expect(announce).not.toHaveBeenCalled()
  })

  it('turning voice off stops the call-outs', async () => {
    const user = userEvent.setup()
    saveVoicePref(true)
    renderPage()
    await startStack(user, { courts: 1 })
    expect(announce).toHaveBeenCalledTimes(1)
    await user.click(voiceBox())
    await enterScore(user, 1, 11, 9)
    expect(announce).toHaveBeenCalledTimes(1)
  })

  it('turning voice on does not repeat games already on court; the next fill is announced', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { courts: 1 })
    await user.click(voiceBox())
    expect(announce).not.toHaveBeenCalled()
    await enterScore(user, 1, 11, 9)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(expectedCallOut(1))
  })
})

describe('StackPage without speechSynthesis (T5.4 missing speechSynthesis)', () => {
  it('disables the switch, says why, and never announces', async () => {
    const user = userEvent.setup()
    vi.mocked(canSpeak).mockReturnValue(false)
    vi.mocked(announce).mockReturnValue(false)
    saveVoicePref(true)
    renderPage()
    await startStack(user, { courts: 1 })
    expect(voiceBox()).toBeDisabled()
    expect(voiceBox()).not.toBeChecked()
    expect(screen.getByText(voice.unsupported)).toBeInTheDocument()
    await enterScore(user, 1, 11, 3)
    expect(announce).not.toHaveBeenCalled()
  })

  it('does not show the unsupported note when the browser can speak', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expect(screen.queryByText(voice.unsupported)).not.toBeInTheDocument()
  })
})

describe('StackPage TV in a new window (T5.4, user 2026-11-12: the new-window button)', () => {
  it('the organizer\'s board has a button that opens /paddle-stack?tv=1 in the named TV window', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderPage()
    expect(screen.queryByRole('button', { name: tv.openWindow })).not.toBeInTheDocument()
    await startStack(user, { courts: 1 })
    await user.click(screen.getByRole('button', { name: tv.openWindow }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('/paddle-stack?tv=1', tv.windowName)
    // The organizer's window keeps its board.
    expect(within(court(1)).getByRole('button', { name: board.enterScore })).toBeInTheDocument()
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
  })

  it('the TV window keeps the names from config', () => {
    expect(tv.openWindow).toBe('Open TV in a new window')
    expect(tv.windowName).toBe('paddle-stack-tv')
  })
})

describe('StackPage ?tv=1 window (T5.4, user 2026-11-12: the ?tv=1 window shows the TV board)', () => {
  it('shows only the TV board for the saved session', () => {
    saveSession(2, TEN)
    renderPage('/paddle-stack?tv=1')
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    const c1 = screen.getByRole('region', { name: `${tv.court} 1` })
    for (const name of ['Andrew', 'Maria', 'Juan', 'Jose']) expect(c1, name).toHaveTextContent(name)
    expect(screen.getByRole('region', { name: `${tv.court} 2` })).toHaveTextContent('Ana')
    expect(screen.getByRole('button', { name: tv.exit })).toBeInTheDocument()
    // None of the organizer's controls.
    expect(screen.queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: tv.open })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: tv.openWindow })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: voice.label })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: start.submit })).not.toBeInTheDocument()
  })

  it('Exit closes the TV window', async () => {
    const user = userEvent.setup()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    saveSession(1, TEN)
    renderPage('/paddle-stack?tv=1')
    await user.click(screen.getByRole('button', { name: tv.exit }))
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('with nothing saved, shows the normal start screen', () => {
    renderPage('/paddle-stack?tv=1')
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: venueCta.link })).toBeInTheDocument()
  })

  it('without ?tv=1 a saved session opens on the organizer\'s board, not the TV board', () => {
    saveSession(1, TEN)
    renderPage('/paddle-stack')
    expect(within(court(1)).getByRole('button', { name: board.enterScore })).toBeInTheDocument()
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
  })
})

describe('StackPage follows the other window (T5.4, user 2026-11-12: following a change saved by the other window)', () => {
  it('the ?tv=1 window shows a score saved by the organizer\'s window, with the "Next up on Court N" banner', () => {
    saveSession(2, TEN)
    renderPage('/paddle-stack?tv=1')
    const c1 = () => screen.getByRole('region', { name: `${tv.court} 1` })
    expect(c1()).not.toHaveTextContent('Ella')
    // Court 1 finishes in the other window; Ella and Fred (first in line) go on.
    otherWindowScores(1)
    fireStorage()
    expect(c1()).toHaveTextContent('Ella')
    expect(c1()).toHaveTextContent('Fred')
    expect(document.body).toHaveTextContent(`${tv.nowOn} 1`)
    expect(document.body).not.toHaveTextContent(`${tv.nowOn} 2`)
    // Still the TV board, not the organizer's.
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
  })

  it('the organizer\'s board follows a change saved by another window', () => {
    saveSession(1, TEN.slice(0, 6))
    renderPage()
    expect(court(1)).not.toHaveTextContent('Ana')
    otherWindowScores(1)
    fireStorage()
    expect(court(1)).toHaveTextContent('Ana')
    expect(court(1)).toHaveTextContent('Ben')
  })

  it('in-page TV mode follows a change saved by another window without closing', async () => {
    const user = userEvent.setup()
    saveSession(1, TEN.slice(0, 6))
    renderPage()
    await user.click(screen.getByRole('button', { name: tv.open }))
    otherWindowScores(1)
    fireStorage()
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: `${tv.court} 1` })).toHaveTextContent('Ana')
  })

  it('a session started in another window replaces the start screen', () => {
    renderPage()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    saveSession(1, TEN.slice(0, 6))
    fireStorage()
    expect(screen.queryByRole('button', { name: start.submit })).not.toBeInTheDocument()
    expect(court(1)).toHaveTextContent('Andrew')
  })

  it('a session cleared in another window goes back to the start screen', () => {
    saveSession(1, TEN.slice(0, 6))
    renderPage()
    expect(court(1)).toBeInTheDocument()
    clearStack()
    fireStorage()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: `${board.court} 1` })).not.toBeInTheDocument()
  })

  it('ignores storage events for other keys', () => {
    saveSession(1, TEN.slice(0, 6))
    renderPage()
    otherWindowScores(1)
    fireStorage('some.other.key')
    expect(court(1)).not.toHaveTextContent('Ana')
    expect(court(1)).toHaveTextContent('Andrew')
  })

  it('a change from another window is never called out, in either window', () => {
    saveVoicePref(true)
    saveSession(1, TEN.slice(0, 6))
    const organizer = renderPage()
    otherWindowScores(1)
    fireStorage()
    expect(court(1)).toHaveTextContent('Ana')
    organizer.unmount()
    renderPage('/paddle-stack?tv=1')
    otherWindowScores(1)
    fireStorage()
    expect(announce).not.toHaveBeenCalled()
  })

  it('stops following once unmounted', () => {
    saveSession(1, TEN.slice(0, 6))
    const { unmount } = renderPage()
    const remove = vi.spyOn(window, 'removeEventListener')
    unmount()
    expect(remove.mock.calls.some(([type]) => type === 'storage')).toBe(true)
    otherWindowScores(1)
    expect(() => fireStorage()).not.toThrow()
  })
})

describe('StackPage leaving full screen and leaving the page (T5.4 wake lock released, leaving full screen closes TV mode)', () => {
  it('leaving full screen closes in-page TV mode and releases the wake lock', async () => {
    const user = userEvent.setup()
    root.requestFullscreen = vi.fn(() => {
      setFullscreenElement(document.documentElement)
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    await tick()
    // Entering full screen does not close it.
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    setFullscreenElement(null)
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    await tick()
    expect(screen.queryByText(tv.footer)).not.toBeInTheDocument()
    expect(within(court(1)).getByRole('button', { name: board.enterScore })).toBeInTheDocument()
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it('a fullscreenchange while TV mode never asked for full screen leaves it open', async () => {
    const user = userEvent.setup()
    expect(root.requestFullscreen).toBeUndefined()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    setFullscreenElement(null)
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
  })

  it('unmounting the page while TV mode is open releases the wake lock', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: tv.open }))
    await tick()
    expect(mocks.release).not.toHaveBeenCalled()
    unmount()
    await new Promise((r) => setTimeout(r, 0))
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })
})
