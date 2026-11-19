// T6.5 Share my card on the player view (TASKS.md T6.5): `PlayerView` shows `ShareMyCard` under the standings on the
// live board and under the final standings once ended, and not while there is no board. The card is the T8.7 player
// card, made on the phone from the session rebuilt from the snapshot (`sessionFromSnapshot`) for the picked player.
// `useLiveViewer` is mocked as in PlayerView.test.tsx; the real `ShareCardDialog` and card data are used, with
// `../shareCards/drawCard` and `../shareImage` mocked as in StackPage.share.test.tsx.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import { playerCardData } from '../shareCards/cardData'
import { drawGroupCard, drawPlayerCard } from '../shareCards/drawCard'
import { shareOrDownload } from '../shareImage'
import type { Session } from '../types'
import type { LiveStackView } from './api'
import { PlayerView } from './PlayerView'
import { buildSnapshot, sessionFromSnapshot } from './snapshot'
import type { ViewerState } from './viewer'

const mocks = vi.hoisted(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }))

vi.mock('../shareCards/drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

vi.mock('../shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shareImage')>()
  return { ...actual, shareOrDownload: vi.fn(() => Promise.resolve('downloaded' as const)) }
})

const useLiveViewer = vi.fn<(code: string) => ViewerState>()
vi.mock('./useLiveViewer', () => ({ useLiveViewer: (code: string) => useLiveViewer(code) }))

const { share } = paddleStack
/** Read lazily so a missing key fails the test that uses it, not the whole file. */
const my = () => paddleStack.viewer.myCard

const NAMES = ['Maria', 'Ben', 'Andrew', 'Juan', 'Cy', 'Ana']

function played(): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES, title: 'Tuesday Open Play' }))
  for (const [a, b] of [
    [11, 5],
    [7, 11],
  ]) {
    const g = s.games.find((x) => x.status === 'playing')!
    s = fillCourts(recordScore(s, g.id, a, b))
  }
  return s
}

function viewOf(s: Session | null, over: Partial<LiveStackView> = {}): LiveStackView {
  return {
    title: s?.title ?? '',
    courts: s?.courts ?? 1,
    snapshot: s ? buildSnapshot(s) : null,
    version: 3,
    ended: false,
    expiresAt: '2026-11-20T12:00:00Z',
    venue: null,
    ...over,
  }
}

const ready = (view: LiveStackView): ViewerState => ({ kind: 'ready', view, mode: 'live', updatedAt: new Date('2026-11-19T04:30:00Z') })

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/paddle-stack/live/AbC_123-x']}>
      <Routes>
        <Route path="paddle-stack/live/:code" element={<PlayerView />} />
      </Routes>
    </MemoryRouter>,
  )
}

const shareMine = () => screen.queryByRole('button', { name: my().button })
const idOf = (s: Session, name: string) => s.players.find((p) => p.name === name)!.id

/** True when `a` comes before `b` in document order. */
const isBefore = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  useLiveViewer.mockReset()
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/card'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.mocked(drawPlayerCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(drawGroupCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('downloaded'))
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('PlayerView: Share my card placement (T6.5)', () => {
  it('shows Share my card under the standings on the live board', () => {
    useLiveViewer.mockReturnValue(ready(viewOf(played())))
    renderAt()
    const btn = shareMine()
    expect(btn).toBeInTheDocument()
    expect(btn).toBeEnabled()
    expect(isBefore(screen.getByRole('table', { name: paddleStack.standings.title }), btn!)).toBe(true)
  })

  it('shows Share my card under the final standings once ended', () => {
    useLiveViewer.mockReturnValue(ready(viewOf(played(), { ended: true })))
    renderAt()
    const btn = shareMine()
    expect(btn).toBeInTheDocument()
    expect(btn).toBeEnabled()
    expect(isBefore(screen.getByRole('table', { name: paddleStack.viewer.finalStandings }), btn!)).toBe(true)
  })

  it('does not show it when there is no board yet', () => {
    useLiveViewer.mockReturnValue(ready(viewOf(null, { version: 0 })))
    renderAt()
    expect(shareMine()).not.toBeInTheDocument()
  })

  it('does not show it for an ended stack that never had a board', () => {
    useLiveViewer.mockReturnValue(ready(viewOf(null, { ended: true })))
    renderAt()
    expect(shareMine()).not.toBeInTheDocument()
  })

  it.each([{ kind: 'loading' }, { kind: 'not_found' }, { kind: 'error' }] as ViewerState[])('does not show it while $kind', (state) => {
    useLiveViewer.mockReturnValue(state)
    renderAt()
    expect(shareMine()).not.toBeInTheDocument()
  })
})

describe('PlayerView: pick a name, the card is made from the snapshot (T6.5)', () => {
  it.each([false, true])('draws the picked player’s T8.7 card from the snapshot’s session (ended: %s)', async (ended) => {
    const user = userEvent.setup()
    const original = played()
    const view = viewOf(original, { ended })
    const fromSnapshot = sessionFromSnapshot(view.snapshot!)
    useLiveViewer.mockReturnValue(ready(view))
    renderAt()

    await user.click(shareMine()!)
    const picker = screen.getByRole('combobox', { name: my().pickLabel })
    await user.selectOptions(picker, within(picker).getByRole('option', { name: 'Juan' }))
    await user.click(screen.getByRole('button', { name: my().make }))

    const dialog = screen.getByRole('dialog', { name: share.dialogTitle })
    expect(dialog).toBeInTheDocument()
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    expect(drawGroupCard).not.toHaveBeenCalled()
    expect(shareOrDownload).not.toHaveBeenCalled()
    const [data] = vi.mocked(drawPlayerCard).mock.calls[0]
    expect(data).toEqual(playerCardData(fromSnapshot, idOf(fromSnapshot, 'Juan'), { date: new Date() }))
    expect(data.name).toBe('Juan')
  })

  it('shares the card by the player’s file name from the dialog', async () => {
    const user = userEvent.setup()
    useLiveViewer.mockReturnValue(ready(viewOf(played())))
    renderAt()
    await user.click(shareMine()!)
    const picker = screen.getByRole('combobox', { name: my().pickLabel })
    await user.selectOptions(picker, within(picker).getByRole('option', { name: 'Ana' }))
    await user.click(screen.getByRole('button', { name: my().make }))
    const dialog = screen.getByRole('dialog', { name: share.dialogTitle })
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.playerFileName('Ana')))
  })

  it('Close in the dialog closes it and leaves the board', async () => {
    const user = userEvent.setup()
    useLiveViewer.mockReturnValue(ready(viewOf(played())))
    renderAt()
    await user.click(shareMine()!)
    const picker = screen.getByRole('combobox', { name: my().pickLabel })
    await user.selectOptions(picker, within(picker).getByRole('option', { name: 'Cy' }))
    await user.click(screen.getByRole('button', { name: my().make }))
    const dialog = screen.getByRole('dialog', { name: share.dialogTitle })
    await user.click(within(dialog).getByRole('button', { name: share.close }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('table', { name: paddleStack.standings.title })).toBeInTheDocument()
  })
})
