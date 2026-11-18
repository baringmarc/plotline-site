// T5.5 review, carried into T8.7's share dialog: a download that throws shows the failure message instead of an
// unhandled rejection.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/paddleStack'
import { createSession, fillCourts, recordScore } from './engine'
import { drawGroupCard } from './shareCards/drawCard'
import { shareOrDownload } from './shareImage'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

vi.mock('./shareCards/drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))),
  drawGroupCard: vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))),
}))

vi.mock('./shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./shareImage')>()
  return { ...actual, shareOrDownload: vi.fn() }
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
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/card'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  const s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D'] }))
  saveStack({ session: recordScore(s, s.games[0].id, 11, 5), ended: false })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the failure message in the share dialog when the download itself throws', async () => {
  vi.mocked(shareOrDownload).mockRejectedValue(new Error('createObjectURL failed'))
  render(
    <MemoryRouter>
      <StackPage />
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: paddleStack.share.button }))
  const dialog = screen.getByRole('dialog', { name: paddleStack.share.dialogTitle })
  await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
  await user.click(within(dialog).getByRole('button', { name: paddleStack.share.shareButton }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(paddleStack.share.failed)
})
