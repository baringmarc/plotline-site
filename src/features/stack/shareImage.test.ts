// T5.5 Standings image to share (TASKS.md T5.5; SPEC §3 `/paddle-stack` row). Acceptance: tests cover the layout
// data (rows, long names cut, empty session name) and the share-or-download fallback; no network request is made
// when sharing. Copy comes from `paddleStack.share` in src/config/site.ts.
//
// Contract the tests rely on (the plan's names):
// - `MAX_ROWS = 10`, `MAX_NAME = 22` (characters, counted as code points, before a name is cut with "…");
// - `standingsImageData(rows, { sessionName?, date })` → `{ title, date, rows: { place, name, record, diff }[],
//   more, footer }`: `title` the trimmed session name or `share.defaultTitle`; `date` the en-PH short date of the
//   organizer's day ("Thu, 12 Nov 2026"; Node's en-PH data may order it "Thu, Nov 12, 2026"); `record` "W–L"
//   (en dash); `diff` signed with "+" and the minus sign "−" (U+2212), zero as "0"; `more` `share.more(n)` past
//   MAX_ROWS, else null; `footer` `share.footer`;
// - `drawStandingsImage(data)` draws on a 1080×1080 canvas from `document.createElement('canvas')` and resolves
//   with the PNG from `canvas.toBlob(…, 'image/png')`; rejects without a 2D context or when toBlob gives null;
// - `shareOrDownload(blob, fileName)` → 'shared' | 'downloaded' | 'cancelled' (Web Share with files when
//   `navigator.canShare` allows it; AbortError is a cancel; anything else, or no file sharing, downloads through
//   an `<a download>` and `URL.createObjectURL`, then revokes the URL).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { MAX_NAME, MAX_ROWS, drawStandingsImage, shareOrDownload, standingsImageData } from './shareImage'
import type { StandingRow } from './types'

const { share } = paddleStack
const MINUS = '−'
const EN_DASH = '–'
const NOON_UTC = new Date('2026-11-12T12:00:00Z') // Thu 12 Nov 2026 from UTC−12 to UTC+11
const THU_12_NOV = /^Thu, (12 Nov|Nov 12,) 2026$/

function row(i: number, over: Partial<StandingRow> = {}): StandingRow {
  return {
    playerId: `p${i}`,
    name: `Player ${i}`,
    place: i,
    wins: 3,
    losses: 1,
    games: 4,
    pointsFor: 40,
    pointsAgainst: 36,
    ...over,
  }
}

const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1))

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

describe('MAX_ROWS and MAX_NAME', () => {
  it('are 10 rows and 22 characters', () => {
    expect(MAX_ROWS).toBe(10)
    expect(MAX_NAME).toBe(22)
  })
})

describe('standingsImageData: layout data (T5.5)', () => {
  it('maps each standings row to place, name, W–L record and signed point difference', () => {
    const data = standingsImageData(
      [
        row(1, { name: 'Andrew', place: 1, wins: 3, losses: 1, pointsFor: 44, pointsAgainst: 40 }),
        row(2, { name: 'Maria', place: 2, wins: 2, losses: 2, pointsFor: 38, pointsAgainst: 38 }),
        row(3, { name: 'Juan', place: 2, wins: 2, losses: 2, pointsFor: 38, pointsAgainst: 38 }),
        row(4, { name: 'Jose', place: 4, wins: 0, losses: 4, pointsFor: 20, pointsAgainst: 22 }),
      ],
      { sessionName: 'Saturday open play', date: NOON_UTC },
    )
    expect(data.rows).toEqual([
      { place: 1, name: 'Andrew', record: `3${EN_DASH}1`, diff: '+4' },
      { place: 2, name: 'Maria', record: `2${EN_DASH}2`, diff: '0' },
      { place: 2, name: 'Juan', record: `2${EN_DASH}2`, diff: '0' },
      { place: 4, name: 'Jose', record: `0${EN_DASH}4`, diff: `${MINUS}2` },
    ])
  })

  it('uses the minus sign (U+2212), not a hyphen, for a negative difference', () => {
    const data = standingsImageData([row(1, { pointsFor: 10, pointsAgainst: 21 })], { date: NOON_UTC })
    expect(data.rows[0].diff).toBe(`${MINUS}11`)
    expect(data.rows[0].diff).not.toContain('-')
  })

  it('keeps the standings order and places as given (ties share a place)', () => {
    const input = [row(1, { place: 1 }), row(2, { place: 1 }), row(3, { place: 3 })]
    const data = standingsImageData(input, { date: NOON_UTC })
    expect(data.rows.map((r) => r.place)).toEqual([1, 1, 3])
    expect(data.rows.map((r) => r.name)).toEqual(['Player 1', 'Player 2', 'Player 3'])
  })

  it('shows every row and no "more" line when there are exactly MAX_ROWS players', () => {
    const data = standingsImageData(rowsOf(10), { date: NOON_UTC })
    expect(data.rows).toHaveLength(10)
    expect(data.more).toBeNull()
  })

  it('shows the top MAX_ROWS and "+n more" when there are more players', () => {
    const data = standingsImageData(rowsOf(13), { date: NOON_UTC })
    expect(data.rows).toHaveLength(MAX_ROWS)
    expect(data.rows.map((r) => r.name)).toEqual(rowsOf(10).map((r) => r.name))
    expect(data.more).toBe(share.more(3))
    expect(data.more).toBe('+3 more')
  })

  it('shows "+1 more" for 11 players', () => {
    expect(standingsImageData(rowsOf(11), { date: NOON_UTC }).more).toBe(share.more(1))
  })

  it('handles no rows: an empty list and no "more" line', () => {
    const data = standingsImageData([], { date: NOON_UTC })
    expect(data.rows).toEqual([])
    expect(data.more).toBeNull()
  })

  it('keeps a name of exactly MAX_NAME characters as typed', () => {
    const name = 'Abcdefghij Klmnopqrstu' // 22
    expect(name).toHaveLength(MAX_NAME)
    expect(standingsImageData([row(1, { name })], { date: NOON_UTC }).rows[0].name).toBe(name)
  })

  it('cuts a long name with "…" and keeps its start as typed', () => {
    const name = 'Maria Clara de los Santos Villanueva' // 36
    const cut = standingsImageData([row(1, { name })], { date: NOON_UTC }).rows[0].name
    expect(cut.endsWith('…')).toBe(true)
    const kept = cut.slice(0, -1)
    expect(name.startsWith(kept)).toBe(true)
    expect(Array.from(kept).length).toBeGreaterThanOrEqual(MAX_NAME - 1)
    expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_NAME + 1)
  })

  it('cuts a 23-character name (one over the limit)', () => {
    const name = 'Abcdefghij Klmnopqrstuv' // 23
    const cut = standingsImageData([row(1, { name })], { date: NOON_UTC }).rows[0].name
    expect(cut).not.toBe(name)
    expect(cut.endsWith('…')).toBe(true)
  })

  it('counts characters, not UTF-16 units, so an emoji or ñ is never split', () => {
    const name = 'Señor 🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓' // 26 characters, 46 UTF-16 units
    const cut = standingsImageData([row(1, { name })], { date: NOON_UTC }).rows[0].name
    expect(cut.endsWith('…')).toBe(true)
    // No lone surrogate left behind by the cut.
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    expect(Array.from(cut.slice(0, -1)).length).toBeGreaterThanOrEqual(MAX_NAME - 1)
    // A name that is short in characters but long in UTF-16 units stays whole.
    const short = '🏓'.repeat(MAX_NAME) // 22 characters, 44 units
    expect(standingsImageData([row(1, { name: short })], { date: NOON_UTC }).rows[0].name).toBe(short)
  })

  it('uses the trimmed session name as the title', () => {
    const data = standingsImageData(rowsOf(4), { sessionName: '  Saturday open play  ', date: NOON_UTC })
    expect(data.title).toBe('Saturday open play')
  })

  it('falls back to the default title for a missing, empty or blank session name', () => {
    expect(standingsImageData(rowsOf(4), { date: NOON_UTC }).title).toBe(share.defaultTitle)
    expect(standingsImageData(rowsOf(4), { sessionName: '', date: NOON_UTC }).title).toBe(share.defaultTitle)
    expect(standingsImageData(rowsOf(4), { sessionName: '   ', date: NOON_UTC }).title).toBe(share.defaultTitle)
  })

  it('formats the date for en-PH as weekday, day, month and year', () => {
    expect(standingsImageData(rowsOf(4), { date: NOON_UTC }).date).toMatch(THU_12_NOV)
  })

  it('carries the footer from config', () => {
    expect(standingsImageData(rowsOf(4), { date: NOON_UTC }).footer).toBe(share.footer)
  })

  describe('in Manila (UTC+8)', () => {
    let savedTz: string | undefined
    beforeEach(() => {
      savedTz = process.env.TZ
      process.env.TZ = 'Asia/Manila'
    })
    afterEach(() => {
      if (savedTz === undefined) delete process.env.TZ
      else process.env.TZ = savedTz
    })

    it('dates a 7:30 AM session to that day, though it is still the day before in UTC', () => {
      const morning = new Date('2026-11-11T23:30:00Z') // Thu 12 Nov, 7:30 AM in Manila
      expect(standingsImageData(rowsOf(4), { date: morning }).date).toMatch(THU_12_NOV)
    })

    it('dates an 11:30 PM session to that day, not the next', () => {
      const night = new Date('2026-11-12T15:30:00Z') // Thu 12 Nov, 11:30 PM in Manila
      expect(standingsImageData(rowsOf(4), { date: night }).date).toMatch(THU_12_NOV)
    })
  })
})

// ---------- drawing ----------

interface FakeCanvas {
  canvas: HTMLCanvasElement
  texts: string[]
  fonts: string[]
  toBlob: ReturnType<typeof vi.fn>
}

/** A 2D context that records the text drawn and the fonts set, and a canvas whose toBlob hands back `blob`. */
function fakeCanvas(opts: { context?: boolean; blob?: Blob | null } = {}): FakeCanvas {
  const realCreate = document.createElement.bind(document)
  const canvas = realCreate('canvas') as HTMLCanvasElement
  const texts: string[] = []
  const fonts: string[] = []
  const gradient = { addColorStop: vi.fn() }
  const state: Record<string | symbol, unknown> = { canvas }
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (prop === 'fillText' || prop === 'strokeText') return (t: string) => texts.push(String(t))
      if (prop === 'measureText') return (t: string) => ({ width: String(t).length * 20, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      if (prop === 'isPointInPath') return () => false
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return vi.fn()
    },
    set(target, prop, value) {
      if (prop === 'font') fonts.push(String(value))
      target[prop] = value
      return true
    },
  })
  const blob = opts.blob === undefined ? new Blob(['png'], { type: 'image/png' }) : opts.blob
  Object.defineProperty(canvas, 'getContext', {
    value: vi.fn((kind: string) => (opts.context === false || kind !== '2d' ? null : ctx)),
  })
  const toBlob = vi.fn((cb: BlobCallback) => setTimeout(() => cb(blob), 0))
  Object.defineProperty(canvas, 'toBlob', { value: toBlob })
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) =>
    tag.toLowerCase() === 'canvas' ? canvas : realCreate(tag, o)) as typeof document.createElement)
  return { canvas, texts, fonts, toBlob }
}

const sample = () =>
  standingsImageData(
    [
      row(1, { name: 'Andrew', wins: 3, losses: 1, pointsFor: 44, pointsAgainst: 40 }),
      row(2, { name: 'Maria', place: 2, wins: 1, losses: 3, pointsFor: 30, pointsAgainst: 41 }),
      ...rowsOf(12).slice(2),
    ],
    { sessionName: 'Saturday open play', date: NOON_UTC },
  )

describe('drawStandingsImage (T5.5)', () => {
  it('draws on a 1080×1080 canvas and resolves with its PNG', async () => {
    const fake = fakeCanvas()
    const blob = await drawStandingsImage(sample())
    expect(fake.canvas.width).toBe(1080)
    expect(fake.canvas.height).toBe(1080)
    expect(fake.toBlob).toHaveBeenCalledTimes(1)
    expect(fake.toBlob.mock.calls[0][1]).toBe('image/png')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/png')
  })

  it('draws the title, date, every row, the "more" line and the footer', async () => {
    const fake = fakeCanvas()
    const data = sample()
    await drawStandingsImage(data)
    const drawn = fake.texts.join('\n')
    expect(drawn).toContain(data.title)
    expect(drawn).toContain(data.date)
    for (const r of data.rows) {
      expect(drawn, r.name).toContain(r.name)
      expect(drawn, `${r.name} record`).toContain(r.record)
      expect(drawn, `${r.name} diff`).toContain(r.diff)
    }
    expect(drawn).toContain(data.more!)
    expect(drawn).toContain(share.footer)
  })

  it('uses the brand fonts, Fraunces and DM Sans', async () => {
    const fake = fakeCanvas()
    await drawStandingsImage(sample())
    expect(fake.fonts.some((f) => f.includes('Fraunces'))).toBe(true)
    expect(fake.fonts.some((f) => f.includes('DM Sans'))).toBe(true)
  })

  it('rejects when the browser gives no 2D context', async () => {
    fakeCanvas({ context: false })
    await expect(drawStandingsImage(sample())).rejects.toBeDefined()
  })

  it('rejects when toBlob gives null', async () => {
    fakeCanvas({ blob: null })
    await expect(drawStandingsImage(sample())).rejects.toBeDefined()
  })

  it('makes no network request', async () => {
    const check = watchNetwork()
    fakeCanvas()
    await drawStandingsImage(sample())
    check()
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

const FILE_NAME = share.fileName
const png = () => new Blob(['png'], { type: 'image/png' })

describe('shareOrDownload (T5.5)', () => {
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
    const dl = stubDownload()
    setNav('canShare', undefined)
    setNav('share', undefined)
    const blob = png()

    await expect(shareOrDownload(blob, FILE_NAME)).resolves.toBe('downloaded')
    expect(dl.createObjectURL).toHaveBeenCalledWith(blob)
    expect(dl.clicked).toEqual([{ href: dl.url, download: FILE_NAME }])
    await vi.waitFor(() => expect(dl.revokeObjectURL).toHaveBeenCalledWith(dl.url))
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
})
