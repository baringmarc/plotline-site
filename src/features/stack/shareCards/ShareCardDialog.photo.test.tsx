// T8.7 Share cards: the dialog's own-photo path when things go wrong, and freeing the photo (reviewer round 2: the
// failure path when a photo won't load, and `releasePhoto` on replace and unmount, had no tests).
//
// Contract (ShareCardDialog.tsx with ./backgrounds mocked):
// - when `loadPhoto(file)` rejects, the `share.failed` alert shows and the card stays on the built-in background
//   (no photo choice, no darkness slider);
// - when a second photo replaces the first, `releasePhoto(first)` is called (and not the new one);
// - when the dialog unmounts, `releasePhoto(current)` is called.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import type { Session } from '../types'
import { BACKGROUNDS, loadPhoto, releasePhoto } from './backgrounds'
import { drawGroupCard, drawPlayerCard } from './drawCard'
import { ShareCardDialog } from './ShareCardDialog'

const mocks = vi.hoisted(() => ({
  blob: new Blob(['png'], { type: 'image/png' }),
  first: { width: 1200, height: 1600, tag: 'first-photo' },
  second: { width: 1600, height: 1200, tag: 'second-photo' },
}))

vi.mock('./drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

vi.mock('../shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shareImage')>()
  return { ...actual, shareOrDownload: vi.fn(() => Promise.resolve('shared' as const)) }
})

vi.mock('./backgrounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./backgrounds')>()
  return { ...actual, loadPhoto: vi.fn(), releasePhoto: vi.fn() }
})

const { share } = paddleStack
const first = mocks.first as unknown as CanvasImageSource
const second = mocks.second as unknown as CanvasImageSource

function played(): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben'], title: 'Saturday open play' }))
  for (const [a, b] of [
    [11, 5],
    [7, 11],
  ]) {
    const g = s.games.find((x) => x.status === 'playing')!
    s = fillCourts(recordScore(s, g.id, a, b))
  }
  return s
}

const idOf = (s: Session, name: string) => s.players.find((p) => p.name === name)!.id
const dialog = () => screen.getByRole('dialog', { name: share.dialogTitle })
const lastCall = <T extends (...args: never[]) => unknown>(fn: T) => {
  const calls = vi.mocked(fn).mock.calls
  return calls[calls.length - 1] as Parameters<T>
}
const file = (name = 'court.jpg') => new File(['jpeg-bytes'], name, { type: 'image/jpeg' })

beforeEach(() => {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => `blob:http://localhost/card-${++n}`), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.mocked(drawPlayerCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(drawGroupCard).mockImplementation(() => Promise.resolve(mocks.blob))
  // Reset, not just clear: the last test's unmount (Testing Library cleanup) may release its photo after afterEach ran,
  // and a leftover mockResolvedValueOnce must not leak into the next test.
  vi.mocked(loadPhoto).mockReset().mockImplementation(() => Promise.resolve(first))
  vi.mocked(releasePhoto).mockReset().mockImplementation(() => {})
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('ShareCardDialog: a photo that won’t load', () => {
  it('shows the failure alert and keeps the built-in background when loadPhoto rejects', async () => {
    const user = userEvent.setup()
    vi.mocked(loadPhoto).mockRejectedValue(new DOMException('The source image cannot be decoded.', 'EncodingError'))
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()

    const bad = file('court.heic')
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), bad)
    await waitFor(() => expect(loadPhoto).toHaveBeenCalledWith(bad))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(share.failed)
    const bgs = within(dialog()).getByRole('radiogroup', { name: share.backgroundLabel })
    expect(within(bgs).getByRole('radio', { name: BACKGROUNDS[0].label })).toBeChecked()
    expect(within(bgs).queryByRole('radio', { name: share.photoChoice })).not.toBeInTheDocument()
    expect(within(dialog()).queryByRole('slider', { name: share.darknessLabel })).not.toBeInTheDocument()
    for (const [, opts] of vi.mocked(drawPlayerCard).mock.calls) {
      expect(opts.background).toEqual({ kind: 'builtin', id: BACKGROUNDS[0].id })
    }
    expect(releasePhoto).not.toHaveBeenCalled()
  })

  it('keeps a built-in background picked before the failed photo', async () => {
    const user = userEvent.setup()
    vi.mocked(loadPhoto).mockRejectedValue(new Error('unsupported'))
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('radio', { name: BACKGROUNDS[2].label }))
    await waitFor(() => expect(lastCall(drawGroupCard)[1].background).toEqual({ kind: 'builtin', id: BACKGROUNDS[2].id }))
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), file())
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(share.failed)
    expect(within(dialog()).getByRole('radio', { name: BACKGROUNDS[2].label })).toBeChecked()
    expect(lastCall(drawGroupCard)[1].background).toEqual({ kind: 'builtin', id: BACKGROUNDS[2].id })
  })
})

describe('ShareCardDialog: freeing the decoded photo', () => {
  it('releases the first photo when a second one replaces it, and not the new one', async () => {
    const user = userEvent.setup()
    vi.mocked(loadPhoto).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    const input = within(dialog()).getByLabelText(share.photoLabel)

    await user.upload(input, file('one.jpg'))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'photo', image: first }))
    expect(releasePhoto).not.toHaveBeenCalled()

    await user.upload(input, file('two.jpg'))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'photo', image: second }))
    expect(releasePhoto).toHaveBeenCalledTimes(1)
    expect(releasePhoto).toHaveBeenCalledWith(first)
    expect(releasePhoto).not.toHaveBeenCalledWith(second)
  })

  it('releases the current photo when the dialog unmounts', async () => {
    const user = userEvent.setup()
    const s = played()
    const { unmount } = render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), file())
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'photo', image: first }))
    expect(releasePhoto).not.toHaveBeenCalled()
    unmount()
    expect(releasePhoto).toHaveBeenCalledTimes(1)
    expect(releasePhoto).toHaveBeenCalledWith(first)
  })

  it('releases both photos over a replace then an unmount, each once', async () => {
    const user = userEvent.setup()
    vi.mocked(loadPhoto).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const s = played()
    const { unmount } = render(<ShareCardDialog session={s} onClose={() => {}} />)
    const input = within(dialog()).getByLabelText(share.photoLabel)
    await user.upload(input, file('one.jpg'))
    await waitFor(() => expect(lastCall(drawGroupCard)[1].background).toEqual({ kind: 'photo', image: first }))
    await user.upload(input, file('two.jpg'))
    await waitFor(() => expect(lastCall(drawGroupCard)[1].background).toEqual({ kind: 'photo', image: second }))
    unmount()
    expect(vi.mocked(releasePhoto).mock.calls).toEqual([[first], [second]])
  })

  it('releases nothing on unmount when no photo was picked', async () => {
    const s = played()
    const { unmount } = render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    unmount()
    expect(releasePhoto).not.toHaveBeenCalled()
  })
})
