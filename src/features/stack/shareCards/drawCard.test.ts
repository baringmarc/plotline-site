// T8.7 Share cards: drawing (TASKS.md T8.7). Acceptance: "tests cover each card's layout data …, the background
// choice and darkness, and the share-or-download fallback; no network request when making or sharing a card, uploaded
// photo included". Plan gate, SPEC §6 "T8.7 plan gate" (2026-11-18): story 1080×1920 and post 1080×1350; four
// built-in backgrounds drawn on the canvas (no image files); the organizer's photo under a darkness overlay; the group
// card shows the rows that fit, then "+N more". T8.2: names and headings in the Paddle Stack face, after it loads.
//
// Contract (the plan's names): `drawPlayerCard(data, { size, background, darkness })` and
// `drawGroupCard(data, { size, background, darkness })` draw on a `document.createElement('canvas')` of
// `CARD_SIZES[size]` and resolve with its PNG (`toBlob(…, 'image/png')`); they reject without a 2D context or when
// toBlob gives null. A photo background is drawn with `drawImage`, covering the card without stretching, then a
// full-card shade of effective alpha `overlayAlpha(darkness)`. Copy (the place line is gone since T8.7c):
// `share.winRateLabel`, `share.streakLabel`, `share.record`, `share.diff`, `share.more(n)`, `share.footer`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { STACK_DISPLAY } from '../fonts'
import { BACKGROUNDS, overlayAlpha, type CardBackground } from './backgrounds'
import { CARD_SIZES, type CardSize, type GroupCardData, type PlayerCardData } from './cardData'
import { drawGroupCard, drawPlayerCard } from './drawCard'

const { share } = paddleStack

// ---------- a recording canvas ----------

interface Op {
  op: string
  args: unknown[]
  alpha: number
  fillStyle: unknown
  font: string
}

interface Fake {
  canvas: HTMLCanvasElement
  ops: Op[]
  texts: { text: string; font: string }[]
  stops: string[]
  toBlob: ReturnType<typeof vi.fn>
  created: string[]
}

function fakeCanvas(opts: { context?: boolean; blob?: Blob | null } = {}): Fake {
  const realCreate = document.createElement.bind(document)
  const canvas = realCreate('canvas') as HTMLCanvasElement
  const ops: Op[] = []
  const texts: { text: string; font: string }[] = []
  const stops: string[] = []
  const created: string[] = []
  const state: Record<string | symbol, unknown> = { canvas, globalAlpha: 1, fillStyle: '#000000', strokeStyle: '#000000', font: '10px sans-serif' }
  const saved: Record<string | symbol, unknown>[] = []
  const KEEP = ['globalAlpha', 'fillStyle', 'strokeStyle', 'font', 'globalCompositeOperation', 'textAlign', 'textBaseline']
  const record = (op: string, args: unknown[]) =>
    ops.push({ op, args, alpha: Number(state.globalAlpha), fillStyle: state.fillStyle, font: String(state.font) })
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      if (prop === 'save') return () => saved.push(Object.fromEntries(KEEP.map((k) => [k, target[k]])))
      if (prop === 'restore') return () => Object.assign(target, saved.pop() ?? {})
      if (prop === 'fillText' || prop === 'strokeText')
        return (t: string, ...rest: unknown[]) => {
          texts.push({ text: String(t), font: String(target.font) })
          record(prop, [t, ...rest])
        }
      // Like a real canvas, the width grows with the font size (half the size per character).
      if (prop === 'measureText')
        return (t: string) => ({
          width: String(t).length * Number.parseFloat(String(target.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '40') * 0.5,
          actualBoundingBoxAscent: 20,
          actualBoundingBoxDescent: 5,
        })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient')
        return (...args: unknown[]) => {
          record(prop, args)
          return { addColorStop: (o: number, c: string) => stops.push(`${o}:${c}`) }
        }
      if (prop === 'createPattern') return (...args: unknown[]) => (record(prop, args), {})
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      if (prop === 'isPointInPath' || prop === 'isPointInStroke') return () => false
      return (...args: unknown[]) => record(prop, args)
    },
    set(target, prop, value) {
      target[prop] = value
      if (typeof prop === 'string') record(`set:${prop}`, [typeof value === 'object' ? '[object]' : value])
      return true
    },
  })
  Object.defineProperty(canvas, 'getContext', { value: vi.fn((kind: string) => (opts.context === false || kind !== '2d' ? null : ctx)) })
  const blob = opts.blob === undefined ? new Blob(['png'], { type: 'image/png' }) : opts.blob
  const toBlob = vi.fn((cb: BlobCallback) => setTimeout(() => cb(blob), 0))
  Object.defineProperty(canvas, 'toBlob', { value: toBlob })
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) => {
    created.push(tag.toLowerCase())
    return tag.toLowerCase() === 'canvas' ? canvas : realCreate(tag, o)
  }) as typeof document.createElement)
  return { canvas, ops, texts, stops, toBlob, created }
}

/** Alpha of a CSS colour string: rgba()/hsla()/#rrggbbaa, 1 for any other colour, null for a gradient or pattern. */
function styleAlpha(style: unknown): number | null {
  if (typeof style !== 'string') return null
  const s = style.trim().toLowerCase()
  const fn = s.match(/^(rgba?|hsla?)\((.*)\)$/)
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 4) return 1
    const a = parts[3]
    return a.endsWith('%') ? Number.parseFloat(a) / 100 : Number.parseFloat(a)
  }
  if (/^#[0-9a-f]{8}$/.test(s)) return Number.parseInt(s.slice(7, 9), 16) / 255
  if (/^#[0-9a-f]{4}$/.test(s)) return Number.parseInt(s[4] + s[4], 16) / 255
  if (s === 'transparent') return 0
  return 1
}

/** Full-card fills after the photo is drawn, with their effective alpha. */
function shadesAfterPhoto(fake: Fake, w: number, h: number): number[] {
  const first = fake.ops.findIndex((o) => o.op === 'drawImage')
  if (first < 0) return []
  return fake.ops
    .slice(first + 1)
    .filter((o) => o.op === 'fillRect')
    .filter((o) => {
      const [x, y, rw, rh] = o.args as number[]
      return x <= 0 && y <= 0 && x + rw >= w && y + rh >= h
    })
    .map((o) => {
      const a = styleAlpha(o.fillStyle)
      return a === null ? -1 : a * o.alpha
    })
}

/** A stand-in for the decoded photo: 3000×2000 (landscape), never fetched. */
const photo = () =>
  ({ width: 3000, height: 2000, naturalWidth: 3000, naturalHeight: 2000 }) as unknown as CanvasImageSource

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
  delete (document as unknown as { fonts?: unknown }).fonts
})

// ---------- data ----------

const playerData = (over: Partial<PlayerCardData> = {}): PlayerCardData => ({
  name: 'Andrew Santos',
  place: 2,
  of: 14,
  wins: 9,
  losses: 3,
  games: 12,
  record: '9–3',
  winRate: 75,
  streak: 7,
  diff: '+23',
  title: 'Saturday open play',
  date: 'Thu, 12 Nov 2026',
  footer: share.footer,
  ...over,
})

const groupData = (over: Partial<GroupCardData> = {}): GroupCardData => ({
  title: 'Saturday open play',
  date: 'Thu, 12 Nov 2026',
  rows: [
    { place: 1, name: 'Andrew Santos', record: '4–0', diff: '+18' },
    { place: 2, name: 'Maria Clara', record: '3–1', diff: '+6' },
    { place: 2, name: 'Juan dela Cruz', record: '3–1', diff: '+6' },
    { place: 4, name: 'Jose Rizal', record: '0–4', diff: '−30' },
  ],
  more: 0,
  footer: share.footer,
  ...over,
})

const builtin = (i = 0): CardBackground => ({ kind: 'builtin', id: BACKGROUNDS[i].id })
const SIZES: CardSize[] = ['story', 'post']
const joined = (fake: Fake) => fake.texts.map((t) => t.text).join('\n')

// ---------- player card ----------

describe('drawPlayerCard', () => {
  for (const size of SIZES) {
    it(`draws on a ${CARD_SIZES[size].width}×${CARD_SIZES[size].height} canvas for ${size} and resolves with its PNG`, async () => {
      const fake = fakeCanvas()
      const blob = await drawPlayerCard(playerData(), { size, background: builtin(), darkness: 50 })
      expect(fake.canvas.width).toBe(CARD_SIZES[size].width)
      expect(fake.canvas.height).toBe(CARD_SIZES[size].height)
      expect(fake.toBlob).toHaveBeenCalledTimes(1)
      expect(fake.toBlob.mock.calls[0][1]).toBe('image/png')
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/png')
    })
  }

  it('draws the name, W–L, win %, best streak, point difference, title, date and footer, and no place (T8.7c)', async () => {
    const fake = fakeCanvas()
    const data = playerData()
    await drawPlayerCard(data, { size: 'story', background: builtin(), darkness: 50 })
    const drawn = joined(fake)
    expect(drawn).toContain(data.name)
    expect(drawn).not.toContain(`of ${data.of}`)
    expect(drawn).toContain(data.record)
    expect(drawn).toContain('75%')
    expect(drawn).toContain('7')
    expect(drawn).toContain(data.diff)
    expect(drawn).toContain(data.title)
    expect(drawn).toContain(data.date)
    expect(drawn).toContain(share.footer)
  })

  it('labels the stats with the config copy', async () => {
    const fake = fakeCanvas()
    await drawPlayerCard(playerData(), { size: 'post', background: builtin(), darkness: 50 })
    const drawn = joined(fake)
    for (const label of [share.winRateLabel, share.streakLabel, share.record, share.diff]) {
      expect(typeof label).toBe('string')
      expect(drawn, label).toContain(label)
    }
  })

  it('draws no title line when the session has none (no empty text, no standings heading)', async () => {
    const fake = fakeCanvas()
    const data = playerData({ title: '' })
    await drawPlayerCard(data, { size: 'story', background: builtin(), darkness: 50 })
    expect(fake.texts.length).toBeGreaterThan(0)
    for (const t of fake.texts) expect(t.text.trim(), 'empty text drawn').not.toBe('')
    expect(joined(fake)).not.toContain(share.defaultTitle)
    expect(joined(fake)).toContain(data.name)
    expect(joined(fake)).toContain(data.date)
  })

  it('draws a player with no scored games without NaN, null or undefined', async () => {
    const fake = fakeCanvas()
    const data = playerData({ wins: 0, losses: 0, games: 0, record: '0–0', winRate: null, streak: 0, diff: '0' })
    const blob = await drawPlayerCard(data, { size: 'post', background: builtin(), darkness: 50 })
    expect(blob.type).toBe('image/png')
    const drawn = joined(fake)
    expect(drawn).toContain(data.name)
    expect(drawn).toContain('0–0')
    expect(drawn).not.toMatch(/NaN|null|undefined|Infinity/)
    expect(drawn).not.toContain('0%')
  })

  it('draws the name in the Paddle Stack face at a bold weight', async () => {
    const fake = fakeCanvas()
    const data = playerData()
    await drawPlayerCard(data, { size: 'story', background: builtin(), darkness: 50 })
    const name = fake.texts.find((t) => t.text === data.name)
    expect(name, 'the name drawn on its own').toBeDefined()
    expect(name!.font).toContain(STACK_DISPLAY)
    expect(name!.font).toMatch(/^(700|800)\s/)
  })

  it('rejects when the browser gives no 2D context', async () => {
    fakeCanvas({ context: false })
    await expect(drawPlayerCard(playerData(), { size: 'story', background: builtin(), darkness: 50 })).rejects.toBeDefined()
  })

  it('rejects when toBlob gives null', async () => {
    fakeCanvas({ blob: null })
    await expect(drawPlayerCard(playerData(), { size: 'story', background: builtin(), darkness: 50 })).rejects.toBeDefined()
  })
})

// ---------- group card ----------

describe('drawGroupCard', () => {
  for (const size of SIZES) {
    it(`draws on a ${CARD_SIZES[size].width}×${CARD_SIZES[size].height} canvas for ${size} and resolves with its PNG`, async () => {
      const fake = fakeCanvas()
      const blob = await drawGroupCard(groupData(), { size, background: builtin(1), darkness: 50 })
      expect(fake.canvas.width).toBe(CARD_SIZES[size].width)
      expect(fake.canvas.height).toBe(CARD_SIZES[size].height)
      expect(fake.toBlob.mock.calls[0][1]).toBe('image/png')
      expect(blob.type).toBe('image/png')
    })
  }

  it('draws the title, date, each row’s place, name, record and difference, and the footer', async () => {
    const fake = fakeCanvas()
    const data = groupData()
    await drawGroupCard(data, { size: 'post', background: builtin(), darkness: 50 })
    const drawn = joined(fake)
    expect(drawn).toContain(data.title)
    expect(drawn).toContain(data.date)
    for (const r of data.rows) {
      expect(drawn, r.name).toContain(r.name)
      expect(drawn, `${r.name} record`).toContain(r.record)
      expect(drawn, `${r.name} diff`).toContain(r.diff)
    }
    expect(fake.texts.some((t) => t.text.trim() === '4'), 'place 4 drawn').toBe(true)
    expect(drawn).toContain(share.footer)
  })

  it('draws "+N more" when players did not fit', async () => {
    const fake = fakeCanvas()
    await drawGroupCard(groupData({ more: 9 }), { size: 'post', background: builtin(), darkness: 50 })
    expect(joined(fake)).toContain(share.more(9))
  })

  it('draws no "more" line when everyone fits', async () => {
    const fake = fakeCanvas()
    await drawGroupCard(groupData({ more: 0 }), { size: 'story', background: builtin(), darkness: 50 })
    expect(joined(fake)).not.toContain(share.more(0))
    expect(joined(fake)).not.toMatch(/\+\s?\d+\s+more/i)
  })

  it('draws the names in the Paddle Stack face', async () => {
    const fake = fakeCanvas()
    const data = groupData()
    await drawGroupCard(data, { size: 'post', background: builtin(), darkness: 50 })
    for (const r of data.rows) {
      const t = fake.texts.find((x) => x.text === r.name)
      expect(t, r.name).toBeDefined()
      expect(t!.font, r.name).toContain(STACK_DISPLAY)
    }
  })

  it('rejects when the browser gives no 2D context', async () => {
    fakeCanvas({ context: false })
    await expect(drawGroupCard(groupData(), { size: 'post', background: builtin(), darkness: 50 })).rejects.toBeDefined()
  })

  it('rejects when toBlob gives null', async () => {
    fakeCanvas({ blob: null })
    await expect(drawGroupCard(groupData(), { size: 'post', background: builtin(), darkness: 50 })).rejects.toBeDefined()
  })
})

// ---------- backgrounds ----------

describe('built-in backgrounds (plan gate: drawn on the canvas, no image files)', () => {
  it('draws each of the four without an image, and each one differently', async () => {
    const logs: string[] = []
    for (let i = 0; i < BACKGROUNDS.length; i++) {
      const fake = fakeCanvas()
      await drawPlayerCard(playerData(), { size: 'story', background: builtin(i), darkness: 50 })
      expect(fake.ops.some((o) => o.op === 'drawImage'), `${BACKGROUNDS[i].id} uses drawImage`).toBe(false)
      expect(fake.created, `${BACKGROUNDS[i].id} creates an <img>`).not.toContain('img')
      logs.push(JSON.stringify([fake.ops.map((o) => [o.op, o.args, typeof o.fillStyle === 'string' ? o.fillStyle : '[g]']), fake.stops]))
      vi.restoreAllMocks()
    }
    expect(new Set(logs).size, 'four different drawings').toBe(4)
  })

  it('draws the group card on each built-in too', async () => {
    for (let i = 0; i < BACKGROUNDS.length; i++) {
      const fake = fakeCanvas()
      const blob = await drawGroupCard(groupData(), { size: 'post', background: builtin(i), darkness: 50 })
      expect(blob.type, BACKGROUNDS[i].id).toBe('image/png')
      expect(fake.ops.some((o) => o.op === 'drawImage')).toBe(false)
      vi.restoreAllMocks()
    }
  })
})

describe('the organizer’s photo and the darkness', () => {
  for (const size of SIZES) {
    it(`draws the photo over the whole ${size} card without stretching it`, async () => {
      const fake = fakeCanvas()
      const image = photo()
      const { width: W, height: H } = CARD_SIZES[size]
      await drawPlayerCard(playerData(), { size, background: { kind: 'photo', image }, darkness: 50 })
      const draws = fake.ops.filter((o) => o.op === 'drawImage')
      expect(draws.length).toBeGreaterThanOrEqual(1)
      const call = draws.find((o) => o.args[0] === image)
      expect(call, 'drawImage with the photo').toBeDefined()
      const n = call!.args.slice(1).map(Number)
      const [dx, dy, dw, dh] = n.length === 8 ? n.slice(4) : n
      expect(dx).toBeLessThanOrEqual(0)
      expect(dy).toBeLessThanOrEqual(0)
      expect(dx + dw).toBeGreaterThanOrEqual(W)
      expect(dy + dh).toBeGreaterThanOrEqual(H)
      const srcRatio = n.length === 8 ? n[2] / n[3] : 3000 / 2000
      expect(dw / dh).toBeCloseTo(srcRatio, 2)
    })
  }

  for (const darkness of [20, 70, 100]) {
    it(`shades the photo with overlayAlpha(${darkness}) so the text reads`, async () => {
      const fake = fakeCanvas()
      const { width: W, height: H } = CARD_SIZES.story
      await drawPlayerCard(playerData(), { size: 'story', background: { kind: 'photo', image: photo() }, darkness })
      const shades = shadesAfterPhoto(fake, W, H)
      const want = overlayAlpha(darkness)
      expect(
        shades.some((a) => Math.abs(a - want) < 0.02),
        `a full-card shade of alpha ${want} after the photo; found ${JSON.stringify(shades)}`,
      ).toBe(true)
    })
  }

  it('shades the group card’s photo by the darkness too', async () => {
    const fake = fakeCanvas()
    const { width: W, height: H } = CARD_SIZES.post
    await drawGroupCard(groupData(), { size: 'post', background: { kind: 'photo', image: photo() }, darkness: 60 })
    expect(shadesAfterPhoto(fake, W, H).some((a) => Math.abs(a - overlayAlpha(60)) < 0.02)).toBe(true)
  })

  it('draws the text after the photo and its shade, on top', async () => {
    const fake = fakeCanvas()
    const data = playerData()
    await drawPlayerCard(data, { size: 'story', background: { kind: 'photo', image: photo() }, darkness: 50 })
    const photoAt = fake.ops.findIndex((o) => o.op === 'drawImage')
    const nameAt = fake.ops.findIndex((o) => o.op === 'fillText' && o.args[0] === data.name)
    expect(photoAt).toBeGreaterThanOrEqual(0)
    expect(nameAt).toBeGreaterThan(photoAt)
  })

  it('makes no network request when drawing either card, photo included', async () => {
    const check = watchNetwork()
    fakeCanvas()
    await drawPlayerCard(playerData(), { size: 'story', background: { kind: 'photo', image: photo() }, darkness: 40 })
    vi.mocked(document.createElement).mockRestore()
    fakeCanvas()
    await drawGroupCard(groupData({ more: 3 }), { size: 'post', background: { kind: 'photo', image: photo() }, darkness: 40 })
    vi.mocked(document.createElement).mockRestore()
    fakeCanvas()
    await drawGroupCard(groupData(), { size: 'story', background: builtin(2), darkness: 40 })
    check()
  })
})

// ---------- fonts (T8.2, carried over from the standings image) ----------

function fakeFonts() {
  let release!: () => void
  let fail!: () => void
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve
    fail = () => reject(new Error('font failed'))
  })
  gate.catch(() => {})
  const load = vi.fn<(font: string) => Promise<FontFace[]>>(() => gate.then(() => []))
  Object.defineProperty(document, 'fonts', { value: { load, check: () => true }, configurable: true })
  return { load, release: () => release(), fail: () => fail() }
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('the cards wait for the Paddle Stack face (T8.2)', () => {
  it('asks document.fonts.load for the display face and draws no text before it loads (player card)', async () => {
    const fonts = fakeFonts()
    const fake = fakeCanvas()
    let done = false
    const p = drawPlayerCard(playerData(), { size: 'story', background: builtin(), darkness: 50 }).then((b) => {
      done = true
      return b
    })
    await flush()
    expect(fonts.load).toHaveBeenCalled()
    expect(fonts.load.mock.calls.some((c) => String(c[0]).includes('Bricolage Grotesque'))).toBe(true)
    expect(fake.texts, 'text drawn before the font loaded').toHaveLength(0)
    expect(done).toBe(false)
    fonts.release()
    expect((await p).type).toBe('image/png')
    expect(fake.texts.length).toBeGreaterThan(0)
  })

  it('waits for the face on the group card too', async () => {
    const fonts = fakeFonts()
    const fake = fakeCanvas()
    const p = drawGroupCard(groupData(), { size: 'post', background: builtin(), darkness: 50 })
    await flush()
    expect(fonts.load).toHaveBeenCalled()
    expect(fake.texts).toHaveLength(0)
    fonts.release()
    await p
    expect(fake.texts.length).toBeGreaterThan(0)
  })

  it('still draws with the fallbacks when the font fails to load', async () => {
    const fonts = fakeFonts()
    const fake = fakeCanvas()
    fonts.fail()
    const blob = await drawPlayerCard(playerData(), { size: 'story', background: builtin(), darkness: 50 })
    expect(blob.type).toBe('image/png')
    expect(joined(fake)).toContain('Andrew Santos')
  })

  it('still draws when the browser has no document.fonts', async () => {
    const fake = fakeCanvas()
    const blob = await drawGroupCard(groupData(), { size: 'story', background: builtin(), darkness: 50 })
    expect(blob.type).toBe('image/png')
    expect(joined(fake)).toContain('Maria Clara')
  })
})
