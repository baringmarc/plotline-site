// T5.5 "Share standings" on the Stack page (TASKS.md T5.5; SPEC §3 `/paddle-stack` row). StackPage.test.tsx and
// StackPage.tv.test.tsx stay as they are; these are the T5.5 additions. Copy from `paddleStack.share`.
//
// Structure the tests rely on (the plan's names):
// - in the board's standings (the region named `standings.title`) and in the final standings (the region named
//   `ended.title`): a textbox labelled `share.nameLabel` and a button `share.button`;
// - the button is disabled until at least one game is scored (skipped games don't count);
// - clicking it calls `drawStandingsImage(standingsImageData(standings(session), { sessionName, date: new Date() }))`,
//   then `shareOrDownload(blob, share.fileName)`; if drawing fails, `share.failed` shows.
// `./shareImage` is mocked except `standingsImageData`, which stays real.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts, recordScore, skipGame, standings as standingsOf } from './engine'
import { drawStandingsImage, shareOrDownload, standingsImageData } from './shareImage'
import { StackPage } from './StackPage'
import { saveStack } from './storage'
import type { Session } from './types'

const mocks = vi.hoisted(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }))

vi.mock('./shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shareImage')>()
  return {
    ...actual,
    standingsImageData: vi.fn(actual.standingsImageData),
    drawStandingsImage: vi.fn(() => Promise.resolve(mocks.blob)),
    shareOrDownload: vi.fn(() => Promise.resolve('downloaded' as const)),
  }
})

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return {
    ...actual,
    canSpeak: vi.fn(() => false),
    announce: vi.fn(() => false),
    requestWakeLock: vi.fn(() => Promise.resolve(() => {})),
  }
})

const { share, standings, ended } = paddleStack
const SIX = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben']

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/paddle-stack']}>
      <StackPage />
    </MemoryRouter>,
  )
}

/** A started session saved before the page renders; `scored` games get 11–5 on court 1, `skipped` are skipped. */
function seed(opts: { scored?: number; skipped?: number; ended?: boolean } = {}): Session {
  let session = fillCourts(createSession({ format: 'fair', courts: 1, names: SIX }))
  for (let i = 0; i < (opts.skipped ?? 0); i++) {
    const g = session.games.find((x) => x.status === 'playing')!
    session = fillCourts(skipGame(session, g.id))
  }
  for (let i = 0; i < (opts.scored ?? 0); i++) {
    const g = session.games.find((x) => x.status === 'playing')!
    session = fillCourts(recordScore(session, g.id, 11, 5))
  }
  saveStack({ session, ended: opts.ended ?? false })
  return session
}

const boardStandings = () => screen.getByRole('region', { name: standings.title })
const finalStandings = () => screen.getByRole('region', { name: ended.title })
const shareButton = (scope: HTMLElement) => within(scope).getByRole('button', { name: share.button })
const nameBox = (scope: HTMLElement) => within(scope).getByRole('textbox', { name: share.nameLabel })

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
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  vi.mocked(drawStandingsImage).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('downloaded'))
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Share standings on the board (T5.5)', () => {
  it('shows the session name box (with its placeholder) and the share button in the standings', () => {
    seed({ scored: 1 })
    renderPage()
    const box = nameBox(boardStandings())
    expect(box).toHaveAttribute('placeholder', share.namePlaceholder)
    expect(shareButton(boardStandings())).toBeInTheDocument()
  })

  it('keeps the button disabled until a game is scored', () => {
    seed()
    renderPage()
    expect(shareButton(boardStandings())).toBeDisabled()
  })

  it('keeps the button disabled when games were only skipped', () => {
    seed({ skipped: 2 })
    renderPage()
    expect(shareButton(boardStandings())).toBeDisabled()
  })

  it('enables the button once a game is scored', () => {
    seed({ scored: 1 })
    renderPage()
    expect(shareButton(boardStandings())).toBeEnabled()
  })

  it('draws the standings with the typed session name and today’s date, then shares the PNG by file name', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 2 })
    renderPage()
    await user.type(nameBox(boardStandings()), 'Saturday open play')
    const before = Date.now()
    await user.click(shareButton(boardStandings()))

    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(standingsImageData).toHaveBeenCalledTimes(1)
    const [rows, opts] = vi.mocked(standingsImageData).mock.calls[0]
    expect(rows).toEqual(standingsOf(session))
    expect(opts.sessionName).toBe('Saturday open play')
    expect(opts.date).toBeInstanceOf(Date)
    expect(opts.date.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(opts.date.getTime()).toBeLessThanOrEqual(Date.now() + 1000)

    expect(drawStandingsImage).toHaveBeenCalledTimes(1)
    const data = vi.mocked(drawStandingsImage).mock.calls[0][0]
    expect(data.title).toBe('Saturday open play')
    expect(data.footer).toBe(share.footer)
    expect(data.rows.map((r) => r.name)).toEqual(standingsOf(session).slice(0, 10).map((r) => r.name))
    expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.fileName)
  })

  it('uses the default title when the session name is left empty', async () => {
    const user = userEvent.setup()
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await waitFor(() => expect(drawStandingsImage).toHaveBeenCalledTimes(1))
    expect(vi.mocked(drawStandingsImage).mock.calls[0][0].title).toBe(share.defaultTitle)
  })

  it('shows the failure message when the image can’t be drawn, and does not share', async () => {
    const user = userEvent.setup()
    vi.mocked(drawStandingsImage).mockImplementation(() => Promise.reject(new Error('no 2d context')))
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    expect(await screen.findByText(share.failed)).toBeInTheDocument()
    expect(shareOrDownload).not.toHaveBeenCalled()
  })

  it('does not show the failure message when the user cancels the share sheet', async () => {
    const user = userEvent.setup()
    vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('cancelled'))
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(share.failed)).not.toBeInTheDocument()
  })

  it('makes no network request when sharing', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
    vi.stubGlobal('fetch', fetchSpy)
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('Share standings on the final standings (T5.5)', () => {
  it('shows the name box and an enabled share button after the session ends with scores', () => {
    seed({ scored: 2, ended: true })
    renderPage()
    expect(nameBox(finalStandings())).toBeInTheDocument()
    expect(shareButton(finalStandings())).toBeEnabled()
  })

  it('keeps the button disabled when the session ended with no scores', () => {
    seed({ ended: true })
    renderPage()
    expect(shareButton(finalStandings())).toBeDisabled()
  })

  it('draws the final standings with the session name and shares them', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 3, ended: true })
    renderPage()
    await user.type(nameBox(finalStandings()), '  Friday night  ')
    await user.click(shareButton(finalStandings()))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.fileName))
    const [rows, opts] = vi.mocked(standingsImageData).mock.calls[0]
    expect(rows).toEqual(standingsOf(session))
    expect(opts.sessionName?.trim()).toBe('Friday night')
    expect(vi.mocked(drawStandingsImage).mock.calls[0][0].title).toBe('Friday night')
  })
})
