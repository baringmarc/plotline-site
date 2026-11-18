// T8.2 Paddle Stack typeface (TASKS.md T8.2): "the share image draws in the new font" and "the canvas share image
// waits for it before drawing". Picked (user, 2026-11-18): Bricolage Grotesque 700/800 for names, scores and
// headings, DM Sans kept for body text.
//
// Contract (the plan's names): `drawStandingsImage` sets `STACK_DISPLAY` (src/features/stack/fonts.ts) in the canvas
// font for the title and the player names, and awaits `document.fonts.load(…)` for that face before drawing any text.
// If the font can't load, it still draws with the fallbacks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STACK_DISPLAY } from './fonts'
import { drawStandingsImage, type StandingsImageData } from './shareImage'

interface Drawn {
  text: string
  font: string
}

/** A 2D context that records each text drawn with the font set at that moment. */
function fakeCanvas() {
  const realCreate = document.createElement.bind(document)
  const canvas = realCreate('canvas') as HTMLCanvasElement
  const drawn: Drawn[] = []
  const state: Record<string | symbol, unknown> = { canvas, font: '10px sans-serif' }
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (prop === 'fillText' || prop === 'strokeText') return (t: string) => drawn.push({ text: String(t), font: String(target.font) })
      if (prop === 'measureText') return (t: string) => ({ width: String(t).length * 20, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: vi.fn() })
      if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      if (prop === 'isPointInPath') return () => false
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return vi.fn()
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  })
  Object.defineProperty(canvas, 'getContext', { value: vi.fn((kind: string) => (kind === '2d' ? ctx : null)) })
  Object.defineProperty(canvas, 'toBlob', {
    value: vi.fn((cb: BlobCallback) => setTimeout(() => cb(new Blob(['png'], { type: 'image/png' })), 0)),
  })
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) =>
    tag.toLowerCase() === 'canvas' ? canvas : realCreate(tag, o)) as typeof document.createElement)
  return { drawn }
}

/** Installs a `document.fonts` whose `load` resolves (or rejects) only when the test says so. */
function fakeFonts() {
  let release!: () => void
  let fail!: () => void
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve
    fail = () => reject(new Error('font failed'))
  })
  gate.catch(() => {}) // a failed load is handled by the code under test, not here
  const load = vi.fn<(font: string) => Promise<FontFace[]>>(() => gate.then(() => []))
  Object.defineProperty(document, 'fonts', { value: { load, check: () => true }, configurable: true })
  return { load, release: () => release(), fail: () => fail() }
}

const data: StandingsImageData = {
  title: 'Sunday Open Play',
  date: 'Sun, 15 Nov 2026',
  rows: [
    { place: 1, name: 'Andrew Santos', record: '3–1', diff: '+8' },
    { place: 2, name: 'Maria Clara', record: '2–2', diff: '0' },
    { place: 3, name: 'Juan dela Cruz', record: '1–3', diff: '−8' },
  ],
  footer: 'Paddle Stack · free at plotline.fit/paddle-stack',
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const fontOf = (drawn: Drawn[], text: string) => {
  const d = drawn.find((x) => x.text === text)
  expect(d, `"${text}" drawn`).toBeDefined()
  return d!.font
}

const BRICOLAGE = STACK_DISPLAY.split(',')[0].trim()

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (document as unknown as { fonts?: unknown }).fonts
})

describe('drawStandingsImage in the Paddle Stack face (T8.2)', () => {
  it('draws the title in STACK_DISPLAY at a bold weight (700 or 800)', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.release()
    await drawStandingsImage(data)
    const font = fontOf(drawn, data.title)
    expect(font).toContain(STACK_DISPLAY)
    expect(font).toMatch(/^(700|800)\s/)
  })

  it('draws every player name in STACK_DISPLAY at a bold weight (700 or 800)', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.release()
    await drawStandingsImage(data)
    for (const r of data.rows) {
      const font = fontOf(drawn, r.name)
      expect(font, r.name).toContain(STACK_DISPLAY)
      expect(font, r.name).toMatch(/^(700|800)\s/)
    }
  })

  it('keeps DM Sans for the body text (the date)', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.release()
    await drawStandingsImage(data)
    const font = fontOf(drawn, data.date)
    expect(font).toContain('DM Sans')
    expect(font).not.toContain('Bricolage')
  })

  it('no longer draws in Fraunces', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.release()
    await drawStandingsImage(data)
    expect(drawn.length).toBeGreaterThan(0)
    for (const d of drawn) expect(d.font, d.text).not.toContain('Fraunces')
  })

  it('asks document.fonts.load for the display face at the weight it draws in', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.release()
    await drawStandingsImage(data)
    const asked = fonts.load.mock.calls.map((c) => String(c[0]))
    expect(asked.some((f) => f.includes(BRICOLAGE)), `fonts.load calls: ${asked.join(' | ')}`).toBe(true)
    const titleWeight = fontOf(drawn, data.title).split(/\s/)[0]
    expect(asked.some((f) => f.includes(BRICOLAGE) && f.startsWith(`${titleWeight} `)), `fonts.load at weight ${titleWeight}`).toBe(true)
  })

  it('waits for the font before drawing any text', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    let done = false
    const p = drawStandingsImage(data).then((b) => {
      done = true
      return b
    })
    await flush()
    expect(fonts.load).toHaveBeenCalled()
    expect(drawn, 'text drawn before the font loaded').toHaveLength(0)
    expect(done).toBe(false)
    fonts.release()
    const blob = await p
    expect(blob.type).toBe('image/png')
    expect(fontOf(drawn, data.title)).toContain(STACK_DISPLAY)
  })

  it('still draws the image with the fallbacks when the font fails to load', async () => {
    const fonts = fakeFonts()
    const { drawn } = fakeCanvas()
    fonts.fail()
    const blob = await drawStandingsImage(data)
    expect(blob.type).toBe('image/png')
    expect(drawn.map((d) => d.text)).toContain(data.title)
    for (const r of data.rows) expect(drawn.map((d) => d.text)).toContain(r.name)
  })

  it('still draws when the browser has no document.fonts', async () => {
    const { drawn } = fakeCanvas()
    const blob = await drawStandingsImage(data)
    expect(blob.type).toBe('image/png')
    expect(fontOf(drawn, data.title)).toContain(STACK_DISPLAY)
  })
})
