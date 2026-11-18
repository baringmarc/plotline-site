// Sharing from the Stack page. T5.5 added "Share standings"; T8.7 (TASKS.md T8.7; SPEC §6 "T8.7 plan gate",
// 2026-11-18) turns it into share cards: "Per player from the standings ("Share card" on a row) and the group from the
// standings and the final standings". The group card replaces the T5.5 standings image behind "Share standings"
// (reverses the 2026-11-13 "every player" row for the shared image; the page's standings still list everyone).
// T8.3: there's no session-name box; the card's heading is the session title.
//
// Structure the tests rely on (the plan's names):
// - in the board's standings (the region named `standings.title`) and in the final standings (the region named
//   `ended.title`): a button `share.button`, disabled until a game is scored (skipped games don't count), and no text
//   box; each standings row has a button whose name contains `share.cardButton`;
// - "Share standings" opens `ShareCardDialog` for the group card (a dialog named `share.dialogTitle`), a row's button
//   opens it for that player; nothing is shared until the dialog's `share.shareButton`; `share.close` closes it.
// `./shareCards/drawCard` and `shareOrDownload` are mocked; the dialog and the card data are real.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts, recordScore, skipGame, standings as standingsOf } from './engine'
import { groupCardData, playerCardData } from './shareCards/cardData'
import { drawGroupCard, drawPlayerCard } from './shareCards/drawCard'
import { shareOrDownload } from './shareImage'
import { StackPage } from './StackPage'
import { saveStack } from './storage'
import type { Session } from './types'

const mocks = vi.hoisted(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }))

vi.mock('./shareCards/drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

vi.mock('./shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shareImage')>()
  return { ...actual, shareOrDownload: vi.fn(() => Promise.resolve('downloaded' as const)) }
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
const dialog = () => screen.getByRole('dialog', { name: share.dialogTitle })
const hasCardName = (name: string) => name.includes(share.cardButton)

/** The standings row for `name` (its row in the table, not the header). */
function rowOf(scope: HTMLElement, name: string): HTMLElement {
  const cells = (r: HTMLElement) => [...within(r).queryAllByRole('rowheader'), ...within(r).queryAllByRole('cell')]
  const rows = within(scope).getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0)
  // A cell's own text, without any button in it (the Share card button may sit in the name cell).
  const ownText = (c: HTMLElement) => {
    const copy = c.cloneNode(true) as HTMLElement
    copy.querySelectorAll('button').forEach((b) => b.remove())
    return copy.textContent?.trim()
  }
  const row = rows.find((r) => cells(r).some((c) => ownText(c) === name))
  expect(row, `standings row for ${name}`).toBeDefined()
  return row!
}
const cardButton = (row: HTMLElement) => within(row).getByRole('button', { name: hasCardName })

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
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/card'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.mocked(drawPlayerCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(drawGroupCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('downloaded'))
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Share standings on the board (T5.5, T8.7)', () => {
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

  it('opens the share dialog with the group card instead of sharing straight away (T8.7)', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 2, title: 'Saturday open play' })
    renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(shareButton(boardStandings()))
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    expect(drawPlayerCard).not.toHaveBeenCalled()
    expect(shareOrDownload).not.toHaveBeenCalled()
    const [data, opts] = vi.mocked(drawGroupCard).mock.calls[0]
    expect(data).toEqual(groupCardData(session, { date: new Date(), size: opts.size }))
    expect(data.title).toBe('Saturday open play')
  })

  it('shares the group card from the dialog by the group file name', async () => {
    const user = userEvent.setup()
    seed({ scored: 2 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.groupFileName))
  })

  it('uses the default heading on the group card when the session has no title', async () => {
    const user = userEvent.setup()
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    expect(vi.mocked(drawGroupCard).mock.calls[0][0].title).toBe(share.defaultTitle)
  })

  it('closes the dialog with Close', async () => {
    const user = userEvent.setup()
    seed({ scored: 1 })
    renderPage()
    await user.click(shareButton(boardStandings()))
    await user.click(within(dialog()).getByRole('button', { name: share.close }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(shareOrDownload).not.toHaveBeenCalled()
  })

  it('still lists every player in the page’s standings (only the card cuts rows)', () => {
    const session = seed({ scored: 2 })
    renderPage()
    for (const r of standingsOf(session)) expect(rowOf(boardStandings(), r.name)).toBeInTheDocument()
  })
})

describe('Share card on a standings row (T8.7)', () => {
  it('puts a Share card button on every standings row', () => {
    const session = seed({ scored: 2 })
    renderPage()
    for (const r of standingsOf(session)) expect(cardButton(rowOf(boardStandings(), r.name)), r.name).toBeInTheDocument()
  })

  it('gives each row’s button a name that says whose card it is', () => {
    seed({ scored: 2 })
    renderPage()
    const maria = cardButton(rowOf(boardStandings(), 'Maria'))
    const juan = cardButton(rowOf(boardStandings(), 'Juan'))
    expect(maria).toHaveAccessibleName(expect.stringContaining('Maria'))
    expect(juan).toHaveAccessibleName(expect.stringContaining('Juan'))
  })

  it('opens the dialog with that player’s card', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 2, title: 'Friday night' })
    renderPage()
    await user.click(cardButton(rowOf(boardStandings(), 'Maria')))
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    expect(drawGroupCard).not.toHaveBeenCalled()
    const [data] = vi.mocked(drawPlayerCard).mock.calls[0]
    const id = session.players.find((p) => p.name === 'Maria')!.id
    expect(data).toEqual(playerCardData(session, id, { date: new Date() }))
    expect(data.name).toBe('Maria')
    expect(data.title).toBe('Friday night')
    expect(shareOrDownload).not.toHaveBeenCalled()
  })

  it('shares that player’s card by the player’s file name', async () => {
    const user = userEvent.setup()
    seed({ scored: 2 })
    renderPage()
    await user.click(cardButton(rowOf(boardStandings(), 'Juan')))
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.playerFileName('Juan')))
  })

  it('makes a card for a player with no scored games yet', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 1 }) // 4 played, Ana and Ben waited
    renderPage()
    const waited = standingsOf(session).find((r) => r.games === 0)!
    await user.click(cardButton(rowOf(boardStandings(), waited.name)))
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    const [data] = vi.mocked(drawPlayerCard).mock.calls[0]
    expect(data.name).toBe(waited.name)
    expect(data.games).toBe(0)
    expect(data.winRate).toBeNull()
  })

  it('makes no network request when making and sharing a card', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
    vi.stubGlobal('fetch', fetchSpy)
    seed({ scored: 1 })
    renderPage()
    await user.click(cardButton(rowOf(boardStandings(), 'Andrew')))
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('Sharing from the final standings (T5.5, T8.7)', () => {
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

  it('opens the group card for the final standings, with the session title', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 3, ended: true, title: '  Friday night  ' })
    renderPage()
    await user.click(shareButton(finalStandings()))
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    const [data, opts] = vi.mocked(drawGroupCard).mock.calls[0]
    expect(data).toEqual(groupCardData(session, { date: new Date(), size: opts.size }))
    expect(data.title).toBe('Friday night')
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.groupFileName))
  })

  it('puts a Share card button on each final standings row that opens that player’s card', async () => {
    const user = userEvent.setup()
    const session = seed({ scored: 3, ended: true })
    renderPage()
    for (const r of standingsOf(session)) expect(cardButton(rowOf(finalStandings(), r.name)), r.name).toBeInTheDocument()
    await user.click(cardButton(rowOf(finalStandings(), 'Jose')))
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    expect(vi.mocked(drawPlayerCard).mock.calls[0][0].name).toBe('Jose')
  })
})
