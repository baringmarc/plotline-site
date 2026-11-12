// T5.5 review: a download that throws shows the failure message instead of an unhandled rejection.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/paddleStack'
import { createSession, fillCourts, recordScore } from './engine'
import { shareOrDownload } from './shareImage'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

vi.mock('./shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shareImage')>()
  return { ...actual, drawStandingsImage: vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))), shareOrDownload: vi.fn() }
})

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

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  const s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D'] }))
  saveStack({ session: recordScore(s, s.games[0].id, 11, 5), ended: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the failure message when the download itself throws', async () => {
  vi.mocked(shareOrDownload).mockRejectedValue(new Error('createObjectURL failed'))
  render(
    <MemoryRouter>
      <StackPage />
    </MemoryRouter>,
  )
  await userEvent.setup().click(screen.getByRole('button', { name: paddleStack.share.button }))
  expect(await screen.findByRole('alert')).toHaveTextContent(paddleStack.share.failed)
})
