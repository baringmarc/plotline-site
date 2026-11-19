// T6.4 Player view (TASKS.md T6.4): `/paddle-stack/live/<code>`, view-only: the board, Up next, on a break and the
// standings, with a "Last updated" line. A venue stack shows its logo, name and Book a court
// (`https://<slug>.plotline.fit/book`). Ended shows the final standings; unknown or expired says "This stack has ended".
// Plan names: `PlayerView` in src/features/stack/live/PlayerView.tsx reads `code` from the route params and calls
// `useLiveViewer(code)` (mocked here, so each state is set directly); the board is rebuilt with
// `sessionFromSnapshot` and the standings come from the engine's `standings()`.
// Copy: `paddleStack.viewer` (src/config/paddleStack.ts, re-exported by src/config/site.ts) with the keys
// loading, notFound, error, notStarted, lastUpdated, bookCourt, finalStandings; the board's own copy is reused
// (`board.court`, `board.upNext`).
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { addPlayers, createSession, fillCourts, recordScore, standings, timeOut } from '../engine'
import type { Session } from '../types'
import type { LiveStackView } from './api'
import { venueLogoUrl } from './handoff'
import { PlayerView } from './PlayerView'
import { buildSnapshot } from './snapshot'
import type { ViewerState } from './viewer'

const { board } = paddleStack
/** Read lazily so a missing key fails the test that uses it, not the whole file. */
const copy = () => paddleStack.viewer

const useLiveViewer = vi.fn<(code: string) => ViewerState>()
vi.mock('./useLiveViewer', () => ({ useLiveViewer: (code: string) => useLiveViewer(code) }))

const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kit', 'Lu']

/** Mid-play: 2 courts in play, one game scored, a line waiting, one player on a break. */
function midSession(): Session {
  let s = createSession({ format: 'fair', courts: 2, title: 'Tuesday Open Play' })
  s = addPlayers(s, NAMES)
  s = fillCourts(s)
  s = recordScore(s, s.games[0].id, 11, 7)
  s = fillCourts(s)
  const waiting = s.players.find((p) => p.status === 'waiting')
  if (!waiting) throw new Error('expected a waiting player')
  return timeOut(s, waiting.id)
}

const nameOf = (s: Session, id: string) => s.players.find((p) => p.id === id)!.name

function viewOf(s: Session, over: Partial<LiveStackView> = {}): LiveStackView {
  return {
    title: s.title,
    courts: s.courts,
    snapshot: buildSnapshot(s),
    version: 5,
    ended: false,
    expiresAt: '2026-11-20T12:00:00Z',
    venue: null,
    ...over,
  }
}

const readyState = (view: LiveStackView, mode: 'live' | 'polling' = 'live', updatedAt = new Date('2026-11-19T04:30:00Z')): ViewerState => ({
  kind: 'ready',
  view,
  mode,
  updatedAt,
})

function renderAt(code = 'AbC_123-x') {
  return render(
    <MemoryRouter initialEntries={[`/paddle-stack/live/${code}`]}>
      <Routes>
        <Route path="paddle-stack/live/:code" element={<PlayerView />} />
      </Routes>
    </MemoryRouter>,
  )
}

let savedTz: string | undefined
beforeEach(() => {
  useLiveViewer.mockReset()
  savedTz = process.env.TZ
})
afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

// ---------- the states ----------

describe('PlayerView: states (T6.4)', () => {
  it('reads the code from the route and passes it to useLiveViewer', () => {
    useLiveViewer.mockReturnValue({ kind: 'loading' })
    renderAt('AbC_123-x')
    expect(useLiveViewer).toHaveBeenCalledWith('AbC_123-x')
  })

  it('loading shows the loading message', () => {
    useLiveViewer.mockReturnValue({ kind: 'loading' })
    renderAt()
    expect(copy().loading.trim()).not.toBe('')
    expect(screen.getByText(copy().loading)).toBeInTheDocument()
  })

  it('an unknown or expired code says "This stack has ended"', () => {
    expect(copy().notFound).toContain('This stack has ended')
    useLiveViewer.mockReturnValue({ kind: 'not_found' })
    renderAt()
    expect(screen.getByText(copy().notFound)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('a failed read shows the error message, not the ended one', () => {
    useLiveViewer.mockReturnValue({ kind: 'error' })
    renderAt()
    expect(copy().error.trim()).not.toBe('')
    expect(copy().error).not.toBe(copy().notFound)
    expect(screen.getByText(copy().error)).toBeInTheDocument()
    expect(screen.queryByText(copy().notFound)).not.toBeInTheDocument()
  })

  it('a stack not published yet says the board is on its way, with no board', () => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s, { snapshot: null, version: 0 })))
    renderAt()
    expect(screen.getByText(copy().notStarted)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  })
})

// ---------- the live board ----------

describe('PlayerView: the board, live (T6.4)', () => {
  it.each(['live', 'polling'] as const)('shows the title and each court with the players on it (mode %s)', (mode) => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s), mode))
    renderAt()
    expect(screen.getByRole('heading', { name: 'Tuesday Open Play' })).toBeInTheDocument()
    const playing = s.games.filter((g) => g.status === 'playing')
    expect(playing).toHaveLength(2)
    for (const g of playing) {
      const court = screen.getByRole('region', { name: new RegExp(`^${board.court} ${g.court}\\b`) })
      for (const id of [...g.teamA, ...g.teamB]) expect(within(court).getByText(new RegExp(nameOf(s, id)))).toBeInTheDocument()
    }
  })

  it('shows Up next with the waiting players, front of the line first', () => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s)))
    renderAt()
    const upNext = screen.getByRole('region', { name: board.upNext })
    const text = upNext.textContent ?? ''
    const names = s.line.map((id) => nameOf(s, id))
    expect(names.length).toBeGreaterThanOrEqual(2)
    let at = -1
    for (const n of names) {
      const i = text.indexOf(n)
      expect(i, `${n} in Up next`).toBeGreaterThan(at)
      at = i
    }
  })

  it('shows who is on a break, outside Up next and the courts', () => {
    const s = midSession()
    const out = s.players.find((p) => p.status === 'out')!
    useLiveViewer.mockReturnValue(readyState(viewOf(s)))
    renderAt()
    const upNext = screen.getByRole('region', { name: board.upNext })
    expect(within(upNext).queryByText(out.name)).not.toBeInTheDocument()
    // In the standings table too, so look outside it.
    const table = screen.getByRole('table')
    const elsewhere = screen.getAllByText(new RegExp(`\\b${out.name}\\b`)).filter((el) => !table.contains(el) && !upNext.contains(el))
    expect(elsewhere.length).toBeGreaterThanOrEqual(1)
  })

  it('shows the standings worked out from the snapshot, leader first', () => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s)))
    renderAt()
    expect(screen.getByRole('heading', { name: paddleStack.standings.title })).toBeInTheDocument()
    const rows = standings(s)
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(rows.length)
    expect(within(bodyRows[0]).getByText(rows[0].name)).toBeInTheDocument()
    expect(rows[0].wins).toBe(1)
  })

  it('is view-only: no score, time out, remove, back in line, add or end controls', () => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s)))
    renderAt()
    for (const name of [board.enterScore, board.skipScore, board.timeOut, board.remove, board.backInLine, board.addSubmit, paddleStack.end.button, paddleStack.live.goLive]) {
      expect(screen.queryByRole('button', { name: new RegExp(name) })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

// ---------- last updated ----------

describe('PlayerView: Last updated (T6.4)', () => {
  it('shows a "Last updated" line with the time', () => {
    expect(copy().lastUpdated).toMatch(/Last updated/)
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession())))
    const { container } = renderAt()
    const escaped = copy().lastUpdated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(container.textContent ?? '').toMatch(new RegExp(`${escaped}\\D{0,12}\\d{1,2}:\\d{2}`))
  })

  it('late at night in Manila (15:05 UTC) shows 11:05 PM local time, not the UTC hour', () => {
    process.env.TZ = 'Asia/Manila'
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession()), 'live', new Date('2026-11-19T15:05:00Z')))
    const { container } = renderAt()
    const text = container.textContent ?? ''
    expect(text).toContain(copy().lastUpdated)
    expect(text).toMatch(/\b(11:05|23:05)\b/)
    expect(text).not.toMatch(/\b15:05\b/)
  })

  it('early morning in Manila (7:07 AM, the previous day in UTC) shows 7:07 local time', () => {
    process.env.TZ = 'Asia/Manila'
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession()), 'polling', new Date('2026-11-18T23:07:00Z')))
    const { container } = renderAt()
    const text = container.textContent ?? ''
    expect(text).toMatch(/\b0?7:07\b/)
    expect(text).not.toMatch(/\b23:07\b/)
  })
})

// ---------- venue ----------

describe('PlayerView: a venue stack (T6.4)', () => {
  const venue = { name: 'Acme Courts', slug: 'acme-courts', logoPath: 'v1/logo.png' }

  it('shows the venue’s logo and name', () => {
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession(), { venue })))
    const { container } = renderAt()
    expect(screen.getAllByText(/Acme Courts/).length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector(`img[src="${venueLogoUrl('v1/logo.png')}"]`)).not.toBeNull()
  })

  it('links Book a court to https://<slug>.plotline.fit/book', () => {
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession(), { venue })))
    renderAt()
    const link = screen.getByRole('link', { name: new RegExp(copy().bookCourt) })
    expect(link).toHaveAttribute('href', 'https://acme-courts.plotline.fit/book')
  })

  it('a venue with no logo shows its name and no broken image', () => {
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession(), { venue: { ...venue, logoPath: null } })))
    const { container } = renderAt()
    expect(screen.getAllByText(/Acme Courts/).length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('img[src*="venue-media"]')).toBeNull()
  })

  it('a plotline.fit stack (no venue) has no Book a court link and no venue logo', () => {
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession())))
    const { container } = renderAt()
    expect(screen.queryByRole('link', { name: new RegExp(copy().bookCourt) })).not.toBeInTheDocument()
    expect(container.querySelector('img[src*="venue-media"]')).toBeNull()
  })
})

// ---------- ended ----------

describe('PlayerView: an ended stack (T6.4)', () => {
  it('shows the final standings and no Up next or courts in play', () => {
    const s = midSession()
    useLiveViewer.mockReturnValue(readyState(viewOf(s, { ended: true })))
    renderAt()
    expect(screen.getByRole('heading', { name: copy().finalStandings })).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(standings(s).length)
    expect(screen.queryByRole('region', { name: board.upNext })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: new RegExp(`^${board.court} 1\\b`) })).not.toBeInTheDocument()
  })

  it('an ended venue stack still offers Book a court', () => {
    const venue = { name: 'Acme Courts', slug: 'acme-courts', logoPath: null }
    useLiveViewer.mockReturnValue(readyState(viewOf(midSession(), { ended: true, venue })))
    renderAt()
    expect(screen.getByRole('link', { name: new RegExp(copy().bookCourt) })).toHaveAttribute('href', 'https://acme-courts.plotline.fit/book')
  })
})
