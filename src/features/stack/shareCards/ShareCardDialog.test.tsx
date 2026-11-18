// T8.7 Share cards: the preview dialog (TASKS.md T8.7: "A preview before sharing; shared as a file where the browser
// can, otherwise downloaded"; backgrounds built in or the organizer's own photo "with a darkness slider …; the photo
// never leaves the device"). Plan gate, SPEC §6 "T8.7 plan gate" (2026-11-18): story or post, picked in the preview.
//
// Structure the tests rely on (the plan's names; copy keys picked here, see the report):
// - `ShareCardDialog({ session, playerId?, onClose })`: a `dialog` named `share.dialogTitle`; playerId absent is the
//   group card;
// - a preview `img` named `share.previewAlt` whose src is `URL.createObjectURL(<the drawn blob>)`;
// - a radio group `share.sizeLabel` with radios `share.sizes.story` (checked first) and `share.sizes.post`;
// - a radio group `share.backgroundLabel` with one radio per `BACKGROUNDS` label (the first checked first);
// - a file input labelled `share.photoLabel` (accept image/*); the picked file is decoded by
//   `loadPhoto(file)` from `./backgrounds` (mocked here) into `{ kind: 'photo', image }`;
// - a slider named `share.darknessLabel` (0–100, starts at `DEFAULT_DARKNESS`) once a photo is picked;
// - a button `share.shareButton` → `shareOrDownload(blob, share.playerFileName(player.name))` or
//   `shareOrDownload(blob, share.groupFileName)`; a failed draw or share shows `share.failed` (role alert), a cancel
//   shows nothing; a button `share.close` calls `onClose`.
// Every redraw calls `drawPlayerCard(playerCardData(session, playerId, { date }), { size, background, darkness })` or
// `drawGroupCard(groupCardData(session, { date, size }), { size, background, darkness })`.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import { shareOrDownload } from '../shareImage'
import type { Session } from '../types'
import { BACKGROUNDS, DEFAULT_DARKNESS, loadPhoto } from './backgrounds'
import { groupCardData, playerCardData } from './cardData'
import { drawGroupCard, drawPlayerCard } from './drawCard'
import { ShareCardDialog } from './ShareCardDialog'

const mocks = vi.hoisted(() => ({
  blob: new Blob(['png'], { type: 'image/png' }),
  image: { width: 1200, height: 1600, naturalWidth: 1200, naturalHeight: 1600, tag: 'decoded-photo' },
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
  return { ...actual, loadPhoto: vi.fn(() => Promise.resolve(mocks.image as unknown as CanvasImageSource)) }
})

const { share } = paddleStack

/** Six players, three scored games on one court, titled. */
function played(title = 'Saturday open play'): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben'], title }))
  for (const [a, b] of [
    [11, 5],
    [7, 11],
    [11, 9],
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

let urls: string[]
beforeEach(() => {
  urls = []
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => {
      const url = `blob:http://localhost/card-${++n}`
      urls.push(url)
      return url
    }),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.mocked(drawPlayerCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(drawGroupCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('shared'))
  vi.mocked(loadPhoto).mockImplementation(() => Promise.resolve(mocks.image as unknown as CanvasImageSource))
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ShareCardDialog: the player card preview', () => {
  it('opens as a dialog and draws that player’s card for the preview', async () => {
    const s = played()
    const id = idOf(s, 'Maria')
    render(<ShareCardDialog session={s} playerId={id} onClose={() => {}} />)
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    expect(drawGroupCard).not.toHaveBeenCalled()
    const [data] = lastCall(drawPlayerCard)
    expect(data).toEqual(playerCardData(s, id, { date: new Date() }))
    expect(data.name).toBe('Maria')
  })

  it('shows the drawn card as the preview image', async () => {
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    const img = await within(dialog()).findByRole('img', { name: share.previewAlt })
    await waitFor(() => expect(img).toHaveAttribute('src', urls[urls.length - 1]))
    expect(URL.createObjectURL).toHaveBeenCalledWith(mocks.blob)
  })

  it('starts on the story size and the first built-in background', async () => {
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    const sizes = within(dialog()).getByRole('radiogroup', { name: share.sizeLabel })
    expect(within(sizes).getByRole('radio', { name: share.sizes.story })).toBeChecked()
    expect(within(sizes).getByRole('radio', { name: share.sizes.post })).not.toBeChecked()
    const bgs = within(dialog()).getByRole('radiogroup', { name: share.backgroundLabel })
    expect(within(bgs).getByRole('radio', { name: BACKGROUNDS[0].label })).toBeChecked()
    const [, opts] = lastCall(drawPlayerCard)
    expect(opts.size).toBe('story')
    expect(opts.background).toEqual({ kind: 'builtin', id: BACKGROUNDS[0].id })
  })

  it('redraws the preview at the post size when post is picked', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('radio', { name: share.sizes.post }))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].size).toBe('post'))
  })

  it('offers every built-in background and redraws with the one picked', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    const bgs = within(dialog()).getByRole('radiogroup', { name: share.backgroundLabel })
    for (const b of BACKGROUNDS) expect(within(bgs).getByRole('radio', { name: b.label })).toBeInTheDocument()
    await user.click(within(bgs).getByRole('radio', { name: BACKGROUNDS[2].label }))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'builtin', id: BACKGROUNDS[2].id }))
  })

  it('uses the organizer’s photo as the background, at the default darkness', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    const input = within(dialog()).getByLabelText(share.photoLabel) as HTMLInputElement
    expect(input).toHaveAttribute('type', 'file')
    expect(input.getAttribute('accept') ?? '').toMatch(/image\//)
    const file = new File(['jpeg-bytes'], 'court.jpg', { type: 'image/jpeg' })
    await user.upload(input, file)
    await waitFor(() => expect(loadPhoto).toHaveBeenCalledWith(file))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'photo', image: mocks.image }))
    expect(lastCall(drawPlayerCard)[1].darkness).toBe(DEFAULT_DARKNESS)
  })

  it('redraws with the darkness from the slider', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), new File(['x'], 'me.png', { type: 'image/png' }))
    const slider = await within(dialog()).findByRole('slider', { name: share.darknessLabel })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '100')
    expect(Number((slider as HTMLInputElement).value)).toBe(DEFAULT_DARKNESS)
    expect(DEFAULT_DARKNESS).toBe(50) // SPEC §2: "Darken the photo" slider 0–100, default 50
    const target = (DEFAULT_DARKNESS as number) === 80 ? 30 : 80
    fireEvent.change(slider, { target: { value: String(target) } })
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].darkness).toBe(target))
    expect(lastCall(drawPlayerCard)[1].background).toEqual({ kind: 'photo', image: mocks.image })
  })

  it('shares the card by the player’s file name', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Juan')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.playerFileName('Juan'))
  })

  it('shares the card with the size and background picked', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Juan')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('radio', { name: share.sizes.post }))
    await user.click(within(dialog()).getByRole('radio', { name: BACKGROUNDS[3].label }))
    const postBlob = new Blob(['post'], { type: 'image/png' })
    vi.mocked(drawPlayerCard).mockImplementation((_d, o) => Promise.resolve(o.size === 'post' && o.background.kind === 'builtin' && o.background.id === BACKGROUNDS[3].id ? postBlob : mocks.blob))
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    // Whether the share reuses the preview's blob or draws again, it is the card picked.
    const shared = vi.mocked(shareOrDownload).mock.calls[0][0]
    const last = lastCall(drawPlayerCard)[1]
    expect(last.size).toBe('post')
    expect(last.background).toEqual({ kind: 'builtin', id: BACKGROUNDS[3].id })
    expect([postBlob, mocks.blob]).toContain(shared)
  })

  it('shows the failure message when the card can’t be drawn, and shares nothing', async () => {
    const user = userEvent.setup()
    vi.mocked(drawPlayerCard).mockImplementation(() => Promise.reject(new Error('no 2d context')))
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(share.failed)
    const btn = within(dialog()).getByRole('button', { name: share.shareButton })
    if (!btn.hasAttribute('disabled')) await user.click(btn)
    expect(shareOrDownload).not.toHaveBeenCalled()
  })

  it('shows the failure message when the share or download throws', async () => {
    const user = userEvent.setup()
    vi.mocked(shareOrDownload).mockRejectedValue(new Error('createObjectURL failed'))
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(share.failed)
  })

  it('shows no failure when the user cancels the share sheet', async () => {
    const user = userEvent.setup()
    vi.mocked(shareOrDownload).mockResolvedValue('cancelled')
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(share.failed)).not.toBeInTheDocument()
  })

  it('calls onClose from the Close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={onClose} />)
    await user.click(within(dialog()).getByRole('button', { name: share.close }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(shareOrDownload).not.toHaveBeenCalled()
  })

  it('makes no network request when previewing, picking a photo and sharing (the photo stays on the device)', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
    vi.stubGlobal('fetch', fetchSpy)
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const s = played()
    render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), new File(['x'], 'me.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(lastCall(drawPlayerCard)[1].background.kind).toBe('photo'))
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpen).not.toHaveBeenCalled()
  })
})

describe('ShareCardDialog: the group card preview', () => {
  it('draws the group card when no player is given', async () => {
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    expect(drawPlayerCard).not.toHaveBeenCalled()
    const [data, opts] = lastCall(drawGroupCard)
    expect(opts.size).toBe('story')
    expect(data).toEqual(groupCardData(s, { date: new Date(), size: 'story' }))
    expect(data.title).toBe('Saturday open play')
  })

  it('takes the rows that fit the post size when post is picked', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('radio', { name: share.sizes.post }))
    await waitFor(() => expect(lastCall(drawGroupCard)[1].size).toBe('post'))
    expect(lastCall(drawGroupCard)[0]).toEqual(groupCardData(s, { date: new Date(), size: 'post' }))
  })

  it('uses the default heading when the session has no title', async () => {
    const s = played('')
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    expect(lastCall(drawGroupCard)[0].title).toBe(share.defaultTitle)
  })

  it('shares the group card by the group file name', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledWith(mocks.blob, share.groupFileName))
  })

  it('takes a photo background and darkness for the group card too', async () => {
    const user = userEvent.setup()
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await user.upload(within(dialog()).getByLabelText(share.photoLabel), new File(['x'], 'court.jpg', { type: 'image/jpeg' }))
    const slider = await within(dialog()).findByRole('slider', { name: share.darknessLabel })
    fireEvent.change(slider, { target: { value: '65' } })
    await waitFor(() => expect(lastCall(drawGroupCard)[1]).toEqual({ size: 'story', background: { kind: 'photo', image: mocks.image }, darkness: 65 }))
  })
})

describe('share copy (config)', () => {
  it('names the files for a player and the group as PNGs', () => {
    expect(share.playerFileName('Maria')).toMatch(/\.png$/)
    expect(share.playerFileName('Maria')).not.toBe(share.playerFileName('Juan'))
    expect(share.groupFileName).toMatch(/\.png$/)
    expect(share.playerFileName('Maria')).not.toBe(share.groupFileName)
  })

  it('makes a file name safe from a name with spaces, slashes or accents', () => {
    const name = share.playerFileName('María / Clara de los Santos')
    expect(name).toMatch(/\.png$/)
    expect(name).not.toMatch(/[\s/\\:*?"<>|]/)
  })

  it('counts the players left off the group card', () => {
    expect(share.more(5)).toContain('5')
    expect(share.more(12)).toContain('12')
  })
})
