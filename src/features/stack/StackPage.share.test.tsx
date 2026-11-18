// T5.5 "Share standings" on the Stack page (TASKS.md T5.5; SPEC §3 `/paddle-stack` row). StackPage.test.tsx and
// StackPage.tv.test.tsx stay as they are; these are the T5.5 additions. Copy from `paddleStack.share`.
// T8.3: the share box's own session name is gone; the image's heading is the session title (`session.title`).
//
// Structure the tests rely on (the plan's names):
// - in the board's standings (the region named `standings.title`) and in the final standings (the region named
//   `ended.title`): a button `share.button` and no text box;
// - the button is disabled until at least one game is scored (skipped games don't count);
// - clicking it calls `drawStandingsImage(standingsImageData(standings(session), { title: session.title, date: new Date() }))`,
//   then `shareOrDownload(blob, share.fileName)`; if drawing fails, `share.failed` shows.
// `./shareImage` is mocked except `standingsImageData`, which stays real (wrapped in a spy).
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
function seed(opts: { scored?: number; skipped?: number; ended?: boolean; title?: string } = {}): Session {
  let session = fillCourts(createSession({ format: 'fair', courts: 1, names: SIX, title: opts.title }))
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
  it('shows the share button in the standings, with no session name box (T8.3)', () => {
    seed({ scored: 1, title: 'Saturday open play' })
    renderPage()
    expect(shareButton(boardStandings())).toBeInTheDocument()
    expect(within(boardStandings()).queryByRole('textbox')).not.toBeInTheDocument()
    expect(share).not.toHaveProperty('nameLabel')
    expect(share).not.toHaveProperty('namePlaceholder')
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

  it('draws the standings with the session title and today’s date, then shares the PNG by file name (T8.3)', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 2, title: 'Saturday open play' })
    renderPage()
    const before = Date.now()
    await user.click(shareButton(boardStandings()))

    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(standingsImageData).toHaveBeenCalledTimes(1)
    const [rows, opts] = vi.mocked(standingsImageData).mock.calls[0]
    expect(rows).toEqual(standingsOf(session))
    expect(opts.title).toBe('Saturday open play')
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

  it('uses the default title when the session has no title', async () => {
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
  it('shows an enabled share button and no name box after the session ends with scores', () => {
    seed({ scored: 2, ended: true })
    renderPage()
    expect(shareButton(finalStandings())).toBeEnabled()
    expect(within(finalStandings()).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('keeps the button disabled when the session ended with no scores', () => {
    seed({ ended: true })
    renderPage()
    expect(shareButton(finalStandings())).toBeDisabled()
  })

  it('draws the final standings with the session title and shares them', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 3, ended: true, title: '  Friday night  ' })
    renderPage()
    await user.click(shareButton(finalStandings()))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.fileName))
    const [rows, opts] = vi.mocked(standingsImageData).mock.calls[0]
    expect(rows).toEqual(standingsOf(session))
    expect(opts.title?.trim()).toBe('Friday night')
    expect(vi.mocked(drawStandingsImage).mock.calls[0][0].title).toBe('Friday night')
  })
})
