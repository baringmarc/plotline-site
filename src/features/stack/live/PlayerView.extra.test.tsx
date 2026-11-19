// T6.4 (mine, from the review): an ended stack that never had a board says only that it ended, and every state has
// the page's h1.
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/paddleStack'
import { PlayerView } from './PlayerView'
import type { ViewerState } from './viewer'

const { viewer } = paddleStack
const useLiveViewer = vi.fn<(code: string) => ViewerState>()
vi.mock('./useLiveViewer', () => ({ useLiveViewer: (code: string) => useLiveViewer(code) }))

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/paddle-stack/live/C']}>
      <Routes>
        <Route path="paddle-stack/live/:code" element={<PlayerView />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => useLiveViewer.mockReset())

describe('PlayerView (T6.4, review)', () => {
  it('an ended stack with no board shows the ended note and not "the board appears"', () => {
    useLiveViewer.mockReturnValue({
      kind: 'ready',
      mode: 'live',
      updatedAt: new Date(),
      view: { title: '', courts: 1, snapshot: null, version: 1, ended: true, expiresAt: '2026-11-20T12:00:00Z', venue: null },
    })
    renderAt()
    expect(screen.getByText(viewer.endedNote)).toBeInTheDocument()
    expect(screen.queryByText(viewer.notStarted)).not.toBeInTheDocument()
  })

  it.each([{ kind: 'loading' }, { kind: 'not_found' }, { kind: 'error' }] as ViewerState[])('$kind has the page heading', (state) => {
    useLiveViewer.mockReturnValue(state)
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: viewer.heading })).toBeInTheDocument()
  })
})
