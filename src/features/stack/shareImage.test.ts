// Share or download (T5.5, kept for T8.7). T8.7 (SPEC §6 "T8.7 plan gate", 2026-11-18) replaces the T5.5 standings
// image with the group card (src/features/stack/shareCards/), so its layout and drawing tests moved to
// shareCards/cardData.test.ts and shareCards/drawCard.test.ts. Acceptance (T8.7): "tests cover … the share-or-download
// fallback; no network request when making or sharing a card".
//
// Contract: `shareOrDownload(blob, fileName)` → 'shared' | 'downloaded' | 'cancelled' (Web Share with files when
// `navigator.canShare` allows it; AbortError is a cancel; anything else, or no file sharing, downloads through an
// `<a download>` and `URL.createObjectURL`, then revokes the URL after `DOWNLOAD_URL_LIFETIME_MS`, at least 60 s, so
// iOS Safari's "Download?" prompt can still read it: test dispute 2026-11-18). The standings image's own functions
// are gone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import * as shareImage from './shareImage'

const { share } = paddleStack
const { shareOrDownload } = shareImage

/** Catches any network use: fetch, XHR and beacons. */
function watchNetwork() {
  const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
  vi.stubGlobal('fetch', fetchSpy)
  const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')
  const beacon = vi.fn(() => true)
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true })
  return () => {
    expect(fetchSpy, 'fetch').not.toHaveBeenCalled()
    expect(xhrOpen, 'XMLHttpRequest').not.toHaveBeenCalled()
    expect(beacon, 'sendBeacon').not.toHaveBeenCalled()
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the T5.5 standings image is replaced by the group card (T8.7)', () => {
  it('no longer exports the standings image functions', () => {
    expect(shareImage).not.toHaveProperty('drawStandingsImage')
    expect(shareImage).not.toHaveProperty('standingsImageData')
    expect(shareImage).not.toHaveProperty('imageHeight')
  })

  it('drops the old single file name for the per-player and group names', () => {
    expect(share).not.toHaveProperty('fileName')
    expect(typeof share.groupFileName).toBe('string')
  })
})

// ---------- share or download ----------

const nav = navigator as Navigator & { canShare?: unknown; share?: unknown }

function setNav(key: 'canShare' | 'share', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true })
}

function stubDownload() {
  const url = 'blob:http://localhost/standings-1'
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true })
  const clicked: { href: string; download: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.getAttribute('href') ?? this.href, download: this.download })
  })
  return { url, createObjectURL, revokeObjectURL, clicked }
}

const FILE_NAME = share.groupFileName
const png = () => new Blob(['png'], { type: 'image/png' })

describe('shareOrDownload (T5.5; T8.7 shares the cards through it)', () => {
  let saved: { canShare: unknown; share: unknown; create: unknown; revoke: unknown }
  beforeEach(() => {
    saved = { canShare: nav.canShare, share: nav.share, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  })
  afterEach(() => {
    setNav('canShare', saved.canShare)
    setNav('share', saved.share)
    Object.defineProperty(URL, 'createObjectURL', { value: saved.create, configurable: true, writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: saved.revoke, configurable: true, writable: true })
  })

  it('shares the PNG as a file with the Web Share API when the browser can share files', async () => {
    const dl = stubDownload()
    const canShare = vi.fn(() => true)
    const shareFn = vi.fn(() => Promise.resolve())
    setNav('canShare', canShare)
    setNav('share', shareFn)

    await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('shared')

    expect(canShare).toHaveBeenCalledTimes(1)
    const asked = (canShare.mock.calls[0] as unknown[])[0] as { files: File[] }
    expect(asked.files).toHaveLength(1)
    expect(shareFn).toHaveBeenCalledTimes(1)
    const shared = (shareFn.mock.calls[0] as unknown[])[0] as { files: File[] }
    expect(shared.files).toHaveLength(1)
    const file = shared.files[0]
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe(FILE_NAME)
    expect(file.type).toBe('image/png')
    expect(dl.clicked).toHaveLength(0)
    expect(dl.createObjectURL).not.toHaveBeenCalled()
  })

  it('returns "cancelled" and does not download when the user cancels the share sheet', async () => {
    const dl = stubDownload()
    setNav('canShare', vi.fn(() => true))
    setNav('share', vi.fn(() => Promise.reject(new DOMException('Share canceled', 'AbortError'))))

    await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('cancelled')
    expect(dl.clicked).toHaveLength(0)
    expect(dl.createObjectURL).not.toHaveBeenCalled()
  })

  it('falls back to a download when sharing fails for another reason', async () => {
    const dl = stubDownload()
    setNav('canShare', vi.fn(() => true))
    setNav('share', vi.fn(() => Promise.reject(new DOMException('Not allowed', 'NotAllowedError'))))

    await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('downloaded')
    expect(dl.clicked).toEqual([{ href: dl.url, download: FILE_NAME }])
  })

  it('downloads when the browser can’t share files (canShare false)', async () => {
    const dl = stubDownload()
    const shareFn = vi.fn(() => Promise.resolve())
    setNav('canShare', vi.fn(() => false))
    setNav('share', shareFn)

    await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('downloaded')
    expect(shareFn).not.toHaveBeenCalled()
    expect(dl.clicked).toEqual([{ href: dl.url, download: FILE_NAME }])
  })

  it('downloads through <a download> and an object URL, then revokes it, when there is no Web Share', async () => {
    vi.useFakeTimers()
    try {
      const dl = stubDownload()
      setNav('canShare', undefined)
      setNav('share', undefined)
      const blob = png()

      await expect(shareOrDownload(blob, FILE_NAME)).resolves.toBe('downloaded')
      expect(dl.createObjectURL).toHaveBeenCalledWith(blob)
      expect(dl.clicked).toEqual([{ href: dl.url, download: FILE_NAME }])
      // Revoked eventually, not right away (how long it stays alive is the next test).
      expect(dl.revokeObjectURL).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(dl.revokeObjectURL).toHaveBeenCalledWith(dl.url)
    } finally {
      vi.useRealTimers()
    }
  })

  // Test dispute (T8.7, 2026-11-18): iOS Safari asks "Download?" and reads the blob URL only after the tap, so a
  // revoke right after the click killed the download on the user's iPhone. The URL stays alive for
  // DOWNLOAD_URL_LIFETIME_MS (about a minute), then is revoked so it doesn't leak.
  it('keeps the download’s object URL alive for DOWNLOAD_URL_LIFETIME_MS (at least 60 s), then revokes it', async () => {
    const lifetime = (shareImage as { DOWNLOAD_URL_LIFETIME_MS?: unknown }).DOWNLOAD_URL_LIFETIME_MS
    expect(typeof lifetime).toBe('number')
    const ms = lifetime as number
    expect(ms).toBeGreaterThanOrEqual(60_000)

    vi.useFakeTimers()
    try {
      const dl = stubDownload()
      setNav('canShare', undefined)
      setNav('share', undefined)

      await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('downloaded')
      expect(dl.clicked).toEqual([{ href: dl.url, download: FILE_NAME }])

      vi.advanceTimersByTime(1_000)
      expect(dl.revokeObjectURL, 'still alive 1 s after the click').not.toHaveBeenCalled()
      vi.advanceTimersByTime(ms - 1_000 - 1)
      expect(dl.revokeObjectURL, 'still alive just before the lifetime ends').not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(dl.revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(dl.revokeObjectURL).toHaveBeenCalledWith(dl.url)
    } finally {
      vi.useRealTimers()
    }
  })

  it('downloads when share exists but canShare does not (no file sharing check)', async () => {
    const dl = stubDownload()
    const shareFn = vi.fn(() => Promise.resolve())
    setNav('canShare', undefined)
    setNav('share', shareFn)

    await expect(shareOrDownload(png(), FILE_NAME)).resolves.toBe('downloaded')
    expect(shareFn).not.toHaveBeenCalled()
    expect(dl.clicked).toHaveLength(1)
  })

  it('makes no network request when sharing or downloading', async () => {
    const check = watchNetwork()
    stubDownload()
    setNav('canShare', vi.fn(() => true))
    setNav('share', vi.fn(() => Promise.resolve()))
    await shareOrDownload(png(), FILE_NAME)
    setNav('canShare', undefined)
    setNav('share', undefined)
    await shareOrDownload(png(), FILE_NAME)
    check()
  })

  it('shares a player card under its own file name', async () => {
    const dl = stubDownload()
    const shareFn = vi.fn(() => Promise.resolve())
    setNav('canShare', vi.fn(() => true))
    setNav('share', shareFn)
    await expect(shareOrDownload(png(), share.playerFileName('Maria'))).resolves.toBe('shared')
    const file = ((shareFn.mock.calls[0] as unknown[])[0] as { files: File[] }).files[0]
    expect(file.name).toBe(share.playerFileName('Maria'))
    expect(file.type).toBe('image/png')
    expect(dl.clicked).toHaveLength(0)
  })

  it('downloads a player card under its own file name when the browser can’t share files', async () => {
    const dl = stubDownload()
    setNav('canShare', undefined)
    setNav('share', undefined)
    await expect(shareOrDownload(png(), share.playerFileName('Maria'))).resolves.toBe('downloaded')
    expect(dl.clicked).toEqual([{ href: dl.url, download: share.playerFileName('Maria') }])
  })
})
