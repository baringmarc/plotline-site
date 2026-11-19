// T6.5 (mine, from the reviewer's minors): focus comes back to "Share my card" when the card's dialog closes, and an
// open card stays open when the stack ends while it is shown (it then draws from the final board).
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import { drawPlayerCard } from '../shareCards/drawCard'
import type { Session } from '../types'
import type { LiveStackView } from './api'
import { PlayerView } from './PlayerView'
import { buildSnapshot } from './snapshot'
import type { ViewerState } from './viewer'

const mocks = vi.hoisted(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }))

vi.mock('../shareCards/drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

const useLiveViewer = vi.fn<(code: string) => ViewerState>()
vi.mock('./useLiveViewer', () => ({ useLiveViewer: (code: string) => useLiveViewer(code) }))

const my = paddleStack.viewer.myCard

function played(): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli'], title: 'Open play' }))
  const g = s.games.find((x) => x.status === 'playing')!
  s = fillCourts(recordScore(s, g.id, 11, 5))
  return s
}

const ready = (s: Session, ended: boolean): ViewerState => ({
  kind: 'ready',
  view: { title: s.title, courts: s.courts, snapshot: buildSnapshot(s), version: ended ? 4 : 3, ended, expiresAt: '2026-11-20T12:00:00Z', venue: null } as LiveStackView,
  mode: 'live',
  updatedAt: new Date('2026-11-19T04:30:00Z'),
})

const tree = () => (
  <MemoryRouter initialEntries={['/paddle-stack/live/AbC_123-x']}>
    <Routes>
      <Route path="paddle-stack/live/:code" element={<PlayerView />} />
    </Routes>
  </MemoryRouter>
)

async function openCard(name: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: my.button }))
  await user.selectOptions(screen.getByRole('combobox', { name: my.pickLabel }), name)
  await user.click(screen.getByRole('button', { name: my.make }))
  return user
}

beforeEach(() => {
  useLiveViewer.mockReset()
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/card'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('PlayerView: Share my card, focus and the stack ending (T6.5)', () => {
  it('returns focus to Share my card when the dialog closes', async () => {
    useLiveViewer.mockReturnValue(ready(played(), false))
    render(tree())
    const user = await openCard('Ben')
    await user.click(await screen.findByRole('button', { name: paddleStack.share.close }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: my.button })).toHaveFocus()
  })

  it('keeps an open card open when the stack ends, and draws it from the final board', async () => {
    const s = played()
    useLiveViewer.mockReturnValue(ready(s, false))
    const { rerender } = render(tree())
    await openCard('Ana')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    const before = vi.mocked(drawPlayerCard).mock.calls.length

    useLiveViewer.mockReturnValue(ready(s, true))
    act(() => rerender(tree()))
    expect(screen.getByRole('heading', { name: paddleStack.viewer.finalStandings })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(drawPlayerCard).mock.calls.length).toBeGreaterThan(before))
  })
})
