// T8.7 In-app browsers (user, 2026-11-18; SPEC §6 row of that date): "opened inside Messenger, Facebook or Instagram
// (user agent with FBAN, FBAV, FB_IAB or Instagram), the share dialog shows a note above Share that this browser can't
// save or share images, to press and hold the card to save it, or to open the page in Safari or Chrome (••• → Open in
// browser); in other browsers on a touch screen (`pointer: coarse`) a small 'press and hold the card to save it' hint
// shows under the preview; tests cover the detection and both notes."
//
// The plan's names: the dialog reads `navigator.userAgent` and `window.matchMedia('(pointer: coarse)')` (guarded when
// matchMedia is missing); copy `paddleStack.share.inAppNote` (above the Share button) and `paddleStack.share.holdHint`
// (under the preview).
import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import type { Session } from '../types'
import { drawPlayerCard } from './drawCard'
import { ShareCardDialog } from './ShareCardDialog'

const mocks = vi.hoisted(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }))

vi.mock('./drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

vi.mock('../shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shareImage')>()
  return { ...actual, shareOrDownload: vi.fn(() => Promise.resolve('shared' as const)) }
})

const { share } = paddleStack

const UA = {
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/437.0.0.33.116;FBBV/545432040;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.231205.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/444.0.0.36.118;]',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPhone14,2; iOS 17_1; en_US; en; scale=3.00; 1170x2532; 532277016)',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

function played(): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben'], title: 'Saturday' }))
  const g = s.games.find((x) => x.status === 'playing')!
  s = fillCourts(recordScore(s, g.id, 11, 5))
  return s
}

const dialog = () => screen.getByRole('dialog', { name: share.dialogTitle })

/** Sets the user agent and whether the pointer is coarse (`null`: no matchMedia at all). */
function device(userAgent: string, coarse: boolean | null) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  if (coarse === null) {
    vi.stubGlobal('matchMedia', undefined)
    return
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('pointer: coarse') ? coarse : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  )
}

async function open() {
  const s = played()
  render(<ShareCardDialog session={s} playerId={s.players[0].id} onClose={() => {}} />)
  await waitFor(() => expect(drawPlayerCard).toHaveBeenCalled())
  return dialog()
}

/** True when `a` comes before `b` in the document. */
const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  let n = 0
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => `blob:http://localhost/card-${++n}`), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
})
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('share copy for in-app browsers (config)', () => {
  it('the in-app note says to press and hold the card, or open the page in Safari or Chrome', () => {
    expect(typeof share.inAppNote).toBe('string')
    expect(share.inAppNote).toMatch(/hold/i)
    expect(share.inAppNote).toMatch(/Safari/)
    expect(share.inAppNote).toMatch(/Chrome/)
  })

  it('the hold hint says to press and hold the card to save it', () => {
    expect(typeof share.holdHint).toBe('string')
    expect(share.holdHint).toMatch(/hold/i)
    expect(share.holdHint).toMatch(/save/i)
    expect(share.holdHint).not.toBe(share.inAppNote)
  })
})

describe('ShareCardDialog in Messenger, Facebook or Instagram: the in-app note above Share', () => {
  for (const [name, ua] of [
    ['Messenger on iOS', UA.messengerIos],
    ['Facebook on Android', UA.facebookAndroid],
    ['Instagram on iOS', UA.instagramIos],
  ] as const) {
    it(`shows the in-app note above the Share button in ${name}`, async () => {
      device(ua, true)
      const d = await open()
      const note = within(d).getByText(share.inAppNote)
      const shareBtn = within(d).getByRole('button', { name: share.shareButton })
      expect(before(note, shareBtn)).toBe(true)
    })
  }

  it('shows the in-app note instead of the hold hint (not both) on a touch screen', async () => {
    device(UA.messengerIos, true)
    const d = await open()
    expect(within(d).getByText(share.inAppNote)).toBeInTheDocument()
    expect(within(d).queryByText(share.holdHint)).not.toBeInTheDocument()
  })

  it('still shows the in-app note when the browser has no matchMedia', async () => {
    device(UA.facebookAndroid, null)
    const d = await open()
    expect(within(d).getByText(share.inAppNote)).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: share.shareButton })).toBeInTheDocument()
  })
})

describe('ShareCardDialog in other browsers: the hold hint on a touch screen', () => {
  it('shows the hold hint under the preview in Safari on a touch screen, and no in-app note', async () => {
    device(UA.safariIos, true)
    const d = await open()
    const hint = within(d).getByText(share.holdHint)
    const img = await within(d).findByRole('img', { name: share.previewAlt })
    expect(before(img, hint)).toBe(true)
    expect(within(d).queryByText(share.inAppNote)).not.toBeInTheDocument()
  })

  it('shows the hold hint in Chrome on Android (coarse pointer)', async () => {
    device(UA.chromeAndroid, true)
    const d = await open()
    expect(within(d).getByText(share.holdHint)).toBeInTheDocument()
    expect(within(d).queryByText(share.inAppNote)).not.toBeInTheDocument()
  })

  it('asks matchMedia about a coarse pointer', async () => {
    device(UA.chromeAndroid, true)
    await open()
    expect(window.matchMedia).toHaveBeenCalledWith('(pointer: coarse)')
  })

  it('shows neither note on a fine pointer outside in-app browsers', async () => {
    device(UA.chromeMac, false)
    const d = await open()
    expect(within(d).queryByText(share.holdHint)).not.toBeInTheDocument()
    expect(within(d).queryByText(share.inAppNote)).not.toBeInTheDocument()
  })

  it('opens without error and shows no in-app note when the browser has no matchMedia', async () => {
    device(UA.chromeMac, null)
    const d = await open()
    expect(within(d).getByRole('button', { name: share.shareButton })).toBeInTheDocument()
    expect(within(d).queryByText(share.inAppNote)).not.toBeInTheDocument()
  })
})
