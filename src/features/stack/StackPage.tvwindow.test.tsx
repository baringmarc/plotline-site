// The `?tv=1` window (T5.4 review round 2): it asks for the wake lock again when it becomes visible, and Exit
// falls back to the organizer's board when the browser refuses to close a window the script didn't open.
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/paddleStack'
import { createSession, fillCourts } from './engine'
import { StackPage } from './StackPage'
import { saveStack } from './storage'
import { requestWakeLock } from './voice'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => true), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

// Node 25's own `localStorage` global has no methods in this test environment, so use an in-memory one.
class MemoryStorage {
  #items = new Map<string, string>()
  getItem(k: string) {
    return this.#items.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
}

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.pathname + loc.search}</output>
}

function renderTvWindow() {
  return render(
    <MemoryRouter initialEntries={['/paddle-stack?tv=1']}>
      <Routes>
        <Route path="/paddle-stack" element={<><StackPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  saveStack({ session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D', 'E'] })), ended: false })
  vi.mocked(requestWakeLock).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the ?tv=1 window', () => {
  it('asks for the wake lock again when the page becomes visible', async () => {
    renderTvWindow()
    expect(requestWakeLock).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(requestWakeLock).toHaveBeenCalledTimes(2)
  })

  it('Exit goes back to the board when the browser refuses to close the window', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
    renderTvWindow()
    await userEvent.setup().click(screen.getByRole('button', { name: paddleStack.tv.exit }))
    expect(window.close).toHaveBeenCalled()
    await screen.findByRole('button', { name: paddleStack.tv.open }, { timeout: 1000 })
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/paddle-stack$/)
  })
})
