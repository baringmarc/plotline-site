// T8.2 Paddle Stack typeface (TASKS.md T8.2): the face loads only on `/paddle-stack`. `StackPage` calls
// `loadStackFonts()` (src/features/stack/fonts.ts) when it mounts, on the start screen, the board and the `?tv=1`
// window alike. `./fonts` is mocked so the call is counted; its constants stay real.
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/paddleStack'
import { createSession, fillCourts } from './engine'
import { loadStackFonts } from './fonts'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

vi.mock('./fonts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fonts')>()
  return { ...actual, loadStackFonts: vi.fn() }
})

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => false), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  vi.mocked(loadStackFonts).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StackPage loads the Paddle Stack fonts (T8.2)', () => {
  it('calls loadStackFonts when it mounts on the start screen', () => {
    const { getByRole } = renderAt('/paddle-stack')
    expect(getByRole('heading', { level: 1, name: paddleStack.title })).toBeInTheDocument()
    expect(loadStackFonts).toHaveBeenCalled()
  })

  it('calls loadStackFonts on the board', () => {
    saveStack({ session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D', 'E'] })), ended: false })
    renderAt('/paddle-stack')
    expect(loadStackFonts).toHaveBeenCalled()
  })

  it('calls loadStackFonts in the ?tv=1 window (the TV board alone)', () => {
    saveStack({ session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D', 'E'] })), ended: false })
    const { container } = renderAt('/paddle-stack?tv=1')
    expect(container.querySelector('.stack-tv')).not.toBeNull()
    expect(loadStackFonts).toHaveBeenCalled()
  })

  it('renders inside .paddle-stack, where --stack-display is scoped', () => {
    const { container } = renderAt('/paddle-stack')
    expect(container.querySelector('.paddle-stack')).not.toBeNull()
  })
})
