// T8.7b Arrange the player card: drawing from a layout (TASKS.md T8.7b). Acceptance: "drawing from a layout (removed
// parts not drawn, sizes, positions, look and opacity applied)"; Do: "Opacity: a slider for the player card's
// background panel, from solid to clear; text stays solid. Looks: Default (today's 2×2 tiles), Compact (one slim row
// of four) and List (one row per stat, label left, big number right). The Plotline logo, wordmark and footer can't be
// moved, resized or removed … the shared PNG matches the preview." T8.7c (the user's calls, 2026-11-21): everything is
// inside the one player card: the logo (no wordmark) left of the name, the tiles, the title and then the date bottom
// left, the link bottom right; no place line; the logo and the link are drawn on every layout and move with the card.
//
// Contract (the plan's names): `drawPlayerCard(data, { size, background, darkness, layout? })`, `layout` defaulting
// to `defaultLayout(size)`; removed items and parts are not drawn; each item is drawn inside its box from
// `itemRects(layout, size, { hasTitle })` at its scale; the panel behind the player card is filled at alpha
// `opacity / 100` (nothing filled inside the player card at 0); the logo, wordmark and footer are drawn as before.
//
// This fake canvas follows the context's transform (translate/scale/setTransform/save/restore), so an item may be
// placed either by its coordinates or by a transform; text is read in card pixels with its effective font size and
// alpha. Panels must be drawn as paths on the context (fillRect, or beginPath … fill()), not a Path2D object.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { BACKGROUNDS, type CardBackground } from './backgrounds'
import type { CardSize, PlayerCardData } from './cardData'
import { drawGroupCard, drawPlayerCard } from './drawCard'
import {
  MIN_SCALE,
  defaultLayout,
  itemRects,
  moveItem,
  removePart,
  resizeItem,
  setLook,
  setOpacity,
  type CardLayout,
  type CardPartId,
} from './layout'

const { share } = paddleStack

// ---------- a recording canvas that follows the transform ----------

type M = [number, number, number, number, number, number]
const ID: M = [1, 0, 0, 1, 0, 0]
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

interface Text {
  text: string
  x: number
  y: number
  /** Font size in card pixels (the font's px times the transform's scale). */
  px: number
  font: string
  alpha: number
  align: string
}

interface Fill {
  /** Bounds in card pixels; null when unknown (a Path2D). */
  box: { x0: number; y0: number; x1: number; y1: number } | null
  alpha: number
}

interface Fake {
  texts: Text[]
  fills: Fill[]
  log: string[]
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

function fakeCanvas(): Fake {
  const realCreate = document.createElement.bind(document)
  const canvas = realCreate('canvas') as HTMLCanvasElement
  const texts: Text[] = []
  const fills: Fill[] = []
  const log: string[] = []
  const state: Record<string | symbol, unknown> = {
    canvas,
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineWidth: 1,
  }
  let m: M = [...ID]
  let path: [number, number][] = []
  const saved: { s: Record<string | symbol, unknown>; m: M }[] = []
  const KEEP = ['globalAlpha', 'fillStyle', 'strokeStyle', 'font', 'globalCompositeOperation', 'textAlign', 'textBaseline', 'lineWidth']
  const pt = (x: number, y: number) => path.push(apply(m, x, y))
  const alphaNow = () => {
    const a = styleAlpha(state.fillStyle)
    return a === null ? -1 : a * Number(state.globalAlpha)
  }
  const bounds = (pts: [number, number][]) =>
    pts.length === 0
      ? null
      : {
          x0: Math.min(...pts.map((p) => p[0])),
          y0: Math.min(...pts.map((p) => p[1])),
          x1: Math.max(...pts.map((p) => p[0])),
          y1: Math.max(...pts.map((p) => p[1])),
        }
  const fns: Record<string, (...a: never[]) => unknown> = {
    save: () => saved.push({ s: Object.fromEntries(KEEP.map((k) => [k, state[k]])), m: [...m] as M }),
    restore: () => {
      const top = saved.pop()
      if (top) {
        Object.assign(state, top.s)
        m = top.m
      }
    },
    translate: (x: number, y: number) => (m = mul(m, [1, 0, 0, 1, x, y])),
    scale: (x: number, y: number) => (m = mul(m, [x, 0, 0, y, 0, 0])),
    rotate: (r: number) => (m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])),
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => (m = mul(m, [a, b, c, d, e, f])),
    setTransform: (...a: never[]) => {
      const args = a as unknown[]
      if (args.length === 0) m = [...ID]
      else if (typeof args[0] === 'object' && args[0] !== null) {
        const t = args[0] as { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }
        m = [t.a ?? 1, t.b ?? 0, t.c ?? 0, t.d ?? 1, t.e ?? 0, t.f ?? 0]
      } else m = (args as number[]).slice(0, 6) as M
    },
    resetTransform: () => (m = [...ID]),
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    beginPath: () => (path = []),
    moveTo: (x: number, y: number) => pt(x, y),
    lineTo: (x: number, y: number) => pt(x, y),
    arcTo: (x1: number, y1: number, x2: number, y2: number) => (pt(x1, y1), pt(x2, y2)),
    arc: (x: number, y: number, r: number) => (pt(x - r, y - r), pt(x + r, y + r)),
    ellipse: (x: number, y: number, rx: number, ry: number) => (pt(x - rx, y - ry), pt(x + rx, y + ry)),
    rect: (x: number, y: number, w: number, h: number) => (pt(x, y), pt(x + w, y + h)),
    roundRect: (x: number, y: number, w: number, h: number) => (pt(x, y), pt(x + w, y + h)),
    quadraticCurveTo: (a: number, b: number, x: number, y: number) => (pt(a, b), pt(x, y)),
    bezierCurveTo: (a: number, b: number, c: number, d: number, x: number, y: number) => (pt(a, b), pt(c, d), pt(x, y)),
    closePath: () => undefined,
    fill: (...a: never[]) => {
      fills.push({ box: (a as unknown[]).length > 0 && typeof a[0] === 'object' ? null : bounds(path), alpha: alphaNow() })
      log.push(`fill ${JSON.stringify(bounds(path))} ${String(state.fillStyle)} ${state.globalAlpha}`)
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      fills.push({ box: bounds([apply(m, x, y), apply(m, x + w, y), apply(m, x, y + h), apply(m, x + w, y + h)]), alpha: alphaNow() })
      log.push(`fillRect ${x},${y},${w},${h} ${JSON.stringify(m)} ${String(state.fillStyle)} ${state.globalAlpha}`)
    },
    fillText: (t: string, x: number, y: number) => {
      const [dx, dy] = apply(m, x, y)
      const px = Number.parseFloat(String(state.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0')
      const k = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
      texts.push({ text: String(t), x: dx, y: dy, px: px * k, font: String(state.font), alpha: alphaNow(), align: String(state.textAlign) })
      log.push(`text ${t} ${dx},${dy} ${px * k} ${String(state.textAlign)}`)
    },
    // Like a real canvas, the width grows with the font size (half the size per character).
    measureText: (t: string) => {
      const px = Number.parseFloat(String(state.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '40')
      return { width: String(t).length * px * 0.5, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 }
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createConicGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  }
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in fns) return fns[prop]
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return (...args: unknown[]) => log.push(`${prop} ${JSON.stringify(args)}`)
    },
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  })
  Object.defineProperty(canvas, 'getContext', { value: vi.fn((kind: string) => (kind === '2d' ? ctx : null)) })
  Object.defineProperty(canvas, 'toBlob', { value: vi.fn((cb: BlobCallback) => setTimeout(() => cb(new Blob(['png'], { type: 'image/png' })), 0)) })
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, o?: ElementCreationOptions) =>
    tag.toLowerCase() === 'canvas' ? canvas : realCreate(tag, o)) as typeof document.createElement)
  return { texts, fills, log }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

const bg = (id = 'clay'): CardBackground => ({ kind: 'builtin', id: BACKGROUNDS.find((b) => b.id === id)!.id })
const SIZES: CardSize[] = ['story', 'post']
const data = playerData()

/** What each part of the player card draws: its value and, for a stat, its label. */
const PART_TEXTS: Record<CardPartId, string[]> = {
  name: [data.name],
  record: [data.record, share.record],
  winRate: ['75%', share.winRateLabel],
  streak: ['7', share.streakLabel],
  diff: [data.diff, share.diff],
  title: [data.title],
  date: [data.date],
}
/** The logo's "km" and the link: drawn on every layout. */
const FIXED_TEXTS = ['km', share.footer]
/** The T8.7 place line, no longer drawn. */
const PLACE = '2nd of 14'
const STATS: { part: CardPartId; value: string; label: string }[] = [
  { part: 'record', value: data.record, label: share.record },
  { part: 'winRate', value: '75%', label: share.winRateLabel },
  { part: 'streak', value: '7', label: share.streakLabel },
  { part: 'diff', value: data.diff, label: share.diff },
]
const PARTS = Object.keys(PART_TEXTS) as CardPartId[]

async function draw(size: CardSize, layout?: CardLayout, background: CardBackground = bg(), d: PlayerCardData = data) {
  const fake = fakeCanvas()
  await drawPlayerCard(d, layout === undefined ? { size, background, darkness: 50 } : { size, background, darkness: 50, layout })
  vi.mocked(document.createElement).mockRestore()
  return fake
}

const textOf = (fake: Fake, text: string) => {
  const found = fake.texts.filter((t) => t.text === text)
  expect(found, `"${text}" drawn once`).toHaveLength(1)
  return found[0]
}
const has = (fake: Fake, text: string) => fake.texts.some((t) => t.text === text || t.text.includes(text))

const rectOf = (layout: CardLayout, size: CardSize, hasTitle = true) => itemRects(layout, size, { hasTitle }).player

function expectInside(t: Text, r: { x: number; y: number; w: number; h: number }, what: string) {
  expect(t.x, `${what} x`).toBeGreaterThanOrEqual(r.x - 1)
  expect(t.x, `${what} x`).toBeLessThanOrEqual(r.x + r.w + 1)
  expect(t.y, `${what} y`).toBeGreaterThanOrEqual(r.y - 1)
  expect(t.y, `${what} y`).toBeLessThanOrEqual(r.y + r.h + 1)
}

/** Fills that lie inside the player card's box (not the background over the whole card). */
const fillsInside = (fake: Fake, r: { x: number; y: number; w: number; h: number }) =>
  fake.fills.filter((f) => f.box && f.box.x0 >= r.x - 2 && f.box.y0 >= r.y - 2 && f.box.x1 <= r.x + r.w + 2 && f.box.y1 <= r.y + r.h + 2)
/** Of those, the card-wide ones: the panel, not the logo's tile and dots. */
const panelFills = (fake: Fake, r: { x: number; y: number; w: number; h: number }) =>
  fillsInside(fake, r).filter((f) => f.box!.x1 - f.box!.x0 > r.w * 0.9)

// ---------- the default ----------

describe('drawPlayerCard with a layout (T8.7b)', () => {
  for (const size of SIZES) {
    it(`draws the default layout when none is given (${size})`, async () => {
      const without = await draw(size)
      const withDefault = await draw(size, defaultLayout(size))
      expect(without.log).toEqual(withDefault.log)
    })
  }

  it('still draws every part, the title, the date, the logo and the link with the default layout', async () => {
    const fake = await draw('story', defaultLayout('story'))
    for (const p of PARTS) for (const t of PART_TEXTS[p]) expect(has(fake, t), `${p}: ${t}`).toBe(true)
    for (const t of FIXED_TEXTS) expect(textOf(fake, t).text, t).toBe(t)
  })

  it('no longer draws the place or the "plotline" wordmark', async () => {
    for (const size of SIZES) {
      const fake = await draw(size, defaultLayout(size))
      expect(has(fake, PLACE), `${size}: place`).toBe(false)
      expect(fake.texts.some((t) => t.text === paddleStack.tv.brand), `${size}: wordmark`).toBe(false)
    }
  })
})

// ---------- removed parts ----------

describe('removed parts are not drawn', () => {
  for (const part of PARTS) {
    it(`leaves out the ${part} when it is removed, and keeps the rest`, async () => {
      const fake = await draw('story', removePart(defaultLayout('story'), part))
      for (const t of PART_TEXTS[part]) expect(fake.texts.some((x) => x.text === t || (t.length > 2 && x.text.includes(t))), `${part}: "${t}" drawn`).toBe(false)
      for (const other of PARTS.filter((p) => p !== part)) for (const t of PART_TEXTS[other]) expect(has(fake, t), `${other}: "${t}" kept`).toBe(true)
    })
  }

  for (const look of ['compact', 'list'] as const) {
    it(`leaves out a removed part in the ${look} look too`, async () => {
      const fake = await draw('post', removePart(setLook(defaultLayout('post'), look), 'winRate'))
      expect(has(fake, '75%')).toBe(false)
      expect(has(fake, share.winRateLabel)).toBe(false)
      expect(has(fake, data.record)).toBe(true)
    })
  }

  it('draws no title line for a session without a title', async () => {
    const fake = await draw('story', defaultLayout('story'), bg(), playerData({ title: '' }))
    expect(fake.texts.some((t) => t.text === ''), 'no empty title drawn').toBe(false)
    expect(has(fake, data.date)).toBe(true)
  })

  it('still draws the logo and the link, inside the card, when every part is removed', async () => {
    for (const size of SIZES) {
      const empty = PARTS.reduce((l, p) => removePart(l, p), defaultLayout(size))
      const fake = await draw(size, empty)
      for (const p of PARTS) for (const t of PART_TEXTS[p]) expect(fake.texts.some((x) => x.text === t), `${size} ${p}: "${t}" drawn`).toBe(false)
      for (const t of FIXED_TEXTS) expectInside(textOf(fake, t), rectOf(empty, size), `${size} ${t}`)
    }
  })
})

// ---------- the logo and the link ----------

describe('the logo and the link are inside the player card', () => {
  for (const size of SIZES) {
    it(`draws the logo left of the name, on its row (${size})`, async () => {
      const l = defaultLayout(size)
      const fake = await draw(size, l)
      const r = rectOf(l, size)
      const km = textOf(fake, 'km')
      const name = textOf(fake, data.name)
      expect(km.x, 'the logo is left of the name').toBeLessThan(name.x)
      expect(km.y, 'the logo sits in the name’s row').toBeLessThan(name.y + 10)
      expect(km.y, 'the logo sits in the name’s row').toBeGreaterThan(r.y)
      expect(km.y, 'above the tiles').toBeLessThan(textOf(fake, data.record).y)
    })

    it(`draws the title then the date bottom left and the link bottom right, on the date’s line (${size})`, async () => {
      const l = defaultLayout(size)
      const fake = await draw(size, l)
      const r = rectOf(l, size)
      const title = textOf(fake, data.title)
      const date = textOf(fake, data.date)
      const link = textOf(fake, share.footer)
      expect(date.y, 'the date under the title').toBeGreaterThan(title.y)
      expect(title.y, 'below the tiles').toBeGreaterThan(textOf(fake, data.diff).y)
      expect(date.x).toBeCloseTo(title.x, 3)
      expect(title.x, 'left side').toBeLessThan(r.x + r.w / 4)
      expect(link.align, 'right-aligned').toBe('right')
      expect(link.x, 'right side').toBeGreaterThan(r.x + r.w * 0.75)
      expect(link.y, 'on the date’s line').toBeCloseTo(date.y, 3)
    })

    it(`draws the link small and soft: smaller than the date and not in bold (${size})`, async () => {
      const fake = await draw(size, defaultLayout(size))
      const link = textOf(fake, share.footer)
      expect(link.px).toBeLessThan(textOf(fake, data.date).px)
      expect(link.font).toMatch(/^500 /)
    })
  }

  it('puts the link on the title’s line when the date is removed, and on a line of its own with neither', async () => {
    const l = removePart(defaultLayout('story'), 'date')
    const fake = await draw('story', l)
    expect(textOf(fake, share.footer).y).toBeCloseTo(textOf(fake, data.title).y, 3)
    const neither = removePart(l, 'title')
    const alone = await draw('story', neither)
    expectInside(textOf(alone, share.footer), rectOf(neither, 'story'), 'the link alone')
  })

  it('keeps the logo when the name is removed', async () => {
    const l = removePart(defaultLayout('post'), 'name')
    const fake = await draw('post', l)
    expectInside(textOf(fake, 'km'), rectOf(l, 'post'), 'logo')
  })
})

describe('a long title never runs under the link', () => {
  // Titles may be up to 60 characters (T8.5).
  const long = 'Saturday morning open play at the new courts by the river'

  for (const size of SIZES) {
    for (const date of [true, false]) {
      it(`cuts a long title with "…" so it ends before the link (${size}, ${date ? 'with' : 'without'} the date)`, async () => {
        const l = date ? defaultLayout(size) : removePart(defaultLayout(size), 'date')
        const fake = await draw(size, l, bg(), playerData({ title: long }))
        const title = fake.texts.find((t) => t.text.startsWith('Saturday morning'))!
        const link = textOf(fake, share.footer)
        expect(title.text.endsWith('…'), title.text).toBe(true)
        // The fake measures half the font size per character; the link is drawn right-aligned.
        const titleRight = title.x + title.text.length * title.px * 0.5
        const linkLeft = link.x - share.footer.length * link.px * 0.5
        expect(titleRight, 'the title ends before the link starts').toBeLessThan(linkLeft)
      })
    }
  }

  it('keeps a title that fits whole', async () => {
    const fake = await draw('story', defaultLayout('story'))
    expect(textOf(fake, data.title).text).toBe(data.title)
  })
})

// ---------- positions and sizes ----------

describe('the card is drawn at its position and size', () => {
  for (const size of SIZES) {
    for (const look of ['default', 'compact', 'list'] as const) {
      it(`draws all the card’s text inside its box (${size}, ${look})`, async () => {
        const l = setLook(defaultLayout(size), look)
        const fake = await draw(size, l)
        const r = rectOf(l, size)
        for (const p of PARTS) for (const t of PART_TEXTS[p]) expectInside(textOf(fake, t), r, `${p} "${t}"`)
        for (const t of FIXED_TEXTS) expectInside(textOf(fake, t), r, t)
      })
    }
  }

  it('moves every part, the logo and the link with the card', async () => {
    for (const size of SIZES) {
      const base = defaultLayout(size)
      const moved = moveItem(base, size, 'player', -40, 60)
      const dx = moved.items.player.x - base.items.player.x
      const dy = moved.items.player.y - base.items.player.y
      expect(dx !== 0 || dy !== 0, `${size}: the move went somewhere`).toBe(true)
      const a = await draw(size, base)
      const b = await draw(size, moved)
      for (const t of [...PARTS.flatMap((p) => PART_TEXTS[p]), ...FIXED_TEXTS]) {
        expect(textOf(b, t).x - textOf(a, t).x, `${size} ${t} x`).toBeCloseTo(dx, 3)
        expect(textOf(b, t).y - textOf(a, t).y, `${size} ${t} y`).toBeCloseTo(dy, 3)
      }
    }
  })

  for (const size of SIZES) {
    it(`draws the card at its scale: text size and offsets within the box scale with it (${size})`, async () => {
      const base = defaultLayout(size)
      const s = (MIN_SCALE + 1) / 2
      const small = resizeItem(base, size, 'player', s)
      const a = await draw(size, base)
      const b = await draw(size, small)
      const ra = rectOf(base, size)
      const rb = rectOf(small, size)
      for (const t of [data.name, data.record, share.record, data.title, data.date, share.footer]) {
        const ta = textOf(a, t)
        const tb = textOf(b, t)
        expect(tb.px / ta.px, `${t} font size`).toBeCloseTo(s, 1)
        expect(tb.x - rb.x, `${t} x within the box`).toBeCloseTo((ta.x - ra.x) * s, 0)
        expect(tb.y - rb.y, `${t} y within the box`).toBeCloseTo((ta.y - ra.y) * s, 0)
      }
    })
  }
})

// ---------- the group card (T8.7c) ----------

describe('the group card’s logo and link', () => {
  const group = {
    title: 'Saturday open play',
    date: 'Thu, 12 Nov 2026',
    rows: [
      { place: 1, name: 'Andrew', record: '2–0', diff: '+8' },
      { place: 2, name: 'Maria', record: '1–1', diff: '0' },
    ],
    more: 0,
    footer: share.footer,
  }
  const drawGroup = async (size: CardSize) => {
    const fake = fakeCanvas()
    await drawGroupCard(group, { size, background: bg(), darkness: 50 })
    vi.mocked(document.createElement).mockRestore()
    return fake
  }

  for (const size of SIZES) {
    it(`draws the logo without the "plotline" wordmark (${size})`, async () => {
      const fake = await drawGroup(size)
      expect(fake.texts.some((t) => t.text === paddleStack.tv.brand)).toBe(false)
      const km = textOf(fake, 'km')
      // The 72 px tile at (80, 80): its "km" sits inside it, near the top left of the card.
      expect(km.x).toBeLessThan(80 + 72)
      expect(km.y).toBeLessThan(80 + 72)
    })

    it(`draws the link bottom right, small and soft (${size})`, async () => {
      const fake = await drawGroup(size)
      const link = textOf(fake, share.footer)
      expect(link.align).toBe('right')
      expect(link.font).toMatch(/^500 /)
      expect(link.px).toBeLessThanOrEqual(26)
      expect(link.x).toBeGreaterThan(1080 / 2)
    })
  }
})

// ---------- looks ----------

const near = (a: number, b: number, tol = 2) => Math.abs(a - b) <= tol
const distinct = (ns: number[], tol = 2) => ns.filter((n, i) => ns.findIndex((o) => near(o, n, tol)) === i)

describe('the three looks', () => {
  for (const size of SIZES) {
    it(`Default: the four stats as 2×2 tiles (${size})`, async () => {
      const fake = await draw(size, setLook(defaultLayout(size), 'default'))
      const values = STATS.map((s) => textOf(fake, s.value))
      expect(distinct(values.map((v) => v.y)), 'two rows').toHaveLength(2)
      expect(distinct(values.map((v) => v.x)), 'two columns').toHaveLength(2)
    })

    it(`Compact: the four stats in one row (${size})`, async () => {
      const fake = await draw(size, setLook(defaultLayout(size), 'compact'))
      const values = STATS.map((s) => textOf(fake, s.value))
      expect(distinct(values.map((v) => v.y)), 'one row').toHaveLength(1)
      expect(distinct(values.map((v) => v.x), 10), 'four columns').toHaveLength(4)
    })

    it(`List: one row per stat, the label left and the number right (${size})`, async () => {
      const fake = await draw(size, setLook(defaultLayout(size), 'list'))
      const rows = STATS.map((s) => ({ ...s, v: textOf(fake, s.value), l: textOf(fake, s.label) }))
      expect(distinct(rows.map((r) => r.v.y), 10), 'four rows').toHaveLength(4)
      for (const r of rows) {
        expect(r.v.x, `${r.part}: number right of its label`).toBeGreaterThan(r.l.x)
        const others = rows.filter((o) => o !== r)
        for (const o of others) expect(Math.abs(r.v.y - r.l.y), `${r.part}'s number sits in its label's row, not ${o.part}'s`).toBeLessThan(Math.abs(r.v.y - o.l.y))
      }
      // The big number is bigger than its label.
      for (const r of rows) expect(r.v.px, r.part).toBeGreaterThan(r.l.px)
    })
  }

  it('draws each look differently', async () => {
    const logs = []
    for (const look of ['default', 'compact', 'list'] as const) logs.push((await draw('story', setLook(defaultLayout('story'), look))).log.join('\n'))
    expect(new Set(logs).size).toBe(3)
  })
})

// ---------- opacity ----------

describe('the player card panel’s opacity', () => {
  for (const id of ['clay', 'sand']) {
    for (const opacity of [100, 40]) {
      it(`fills the panel behind the player card at alpha ${opacity / 100} (${id})`, async () => {
        const l = setOpacity(defaultLayout('story'), opacity)
        const fake = await draw('story', l, bg(id))
        const inside = panelFills(fake, rectOf(l, 'story'))
        expect(
          inside.some((f) => Math.abs(f.alpha - opacity / 100) < 0.02),
          `a fill of alpha ${opacity / 100} inside the player card; found ${JSON.stringify(inside.map((f) => f.alpha))}`,
        ).toBe(true)
      })
    }

    it(`fills no panel behind the player card at opacity 0, only the logo (${id})`, async () => {
      const l = setOpacity(defaultLayout('story'), 0)
      const fake = await draw('story', l, bg(id))
      const r = rectOf(l, 'story')
      expect(panelFills(fake, r).filter((f) => f.alpha !== 0).map((f) => f.alpha)).toEqual([])
      expect(fillsInside(fake, r).length, 'the logo is still filled in').toBeGreaterThan(0)
    })
  }

  for (const look of ['default', 'compact', 'list'] as const) {
    it(`applies the opacity in the ${look} look and keeps the text solid`, async () => {
      for (const opacity of [0, 40]) {
        const l = setOpacity(setLook(defaultLayout('post'), look), opacity)
        const fake = await draw('post', l)
        const inside = panelFills(fake, rectOf(l, 'post'))
        if (opacity === 0) expect(inside.filter((f) => f.alpha !== 0), `${look} at 0`).toEqual([])
        else expect(inside.some((f) => Math.abs(f.alpha - 0.4) < 0.02), `${look} at 40`).toBe(true)
        for (const s of STATS) expect(textOf(fake, s.value).alpha, `${look} ${s.value} at ${opacity}`).toBe(1)
        expect(textOf(fake, data.name).alpha, `${look} name at ${opacity}`).toBe(1)
      }
    })
  }

  it('moves the panel with the player card', async () => {
    const base = setOpacity(defaultLayout('story'), 40)
    const moved = moveItem(base, 'story', 'player', 0, 200)
    const fake = await draw('story', moved)
    expect(panelFills(fake, rectOf(moved, 'story')).some((f) => Math.abs(f.alpha - 0.4) < 0.02)).toBe(true)
  })
})
