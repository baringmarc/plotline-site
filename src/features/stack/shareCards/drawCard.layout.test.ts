// T8.7b Arrange the player card: drawing from a layout (TASKS.md T8.7b). Acceptance: "drawing from a layout (removed
// parts not drawn, sizes, positions, look and opacity applied)"; Do: "Opacity: a slider for the player card's
// background panel, from solid to clear; text stays solid. Looks: Default (today's 2×2 tiles), Compact (one slim row
// of four) and List (one row per stat, label left, big number right). The Plotline logo, wordmark and footer can't be
// moved, resized or removed … the shared PNG matches the preview."
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
import { CARD_SIZES, type CardSize, type PlayerCardData } from './cardData'
import { drawPlayerCard } from './drawCard'
import {
  MIN_SCALE,
  defaultLayout,
  itemRects,
  moveItem,
  removeItem,
  removePart,
  resizeItem,
  setLook,
  setOpacity,
  type CardItemId,
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
    measureText: (t: string) => ({ width: String(t).length * 20, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 }),
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
  place: [share.placeOf(data.place, data.of)],
  record: [data.record, share.record],
  winRate: ['75%', share.winRateLabel],
  streak: ['7', share.streakLabel],
  diff: [data.diff, share.diff],
}
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

const rectOf = (layout: CardLayout, size: CardSize, id: CardItemId) => {
  const r = itemRects(layout, size, { hasTitle: true })[id]
  if (!r) throw new Error(`${id} has no rect`)
  return r
}

function expectInside(t: Text, r: { x: number; y: number; w: number; h: number }, what: string) {
  expect(t.x, `${what} x`).toBeGreaterThanOrEqual(r.x - 1)
  expect(t.x, `${what} x`).toBeLessThanOrEqual(r.x + r.w + 1)
  expect(t.y, `${what} y`).toBeGreaterThanOrEqual(r.y - 1)
  expect(t.y, `${what} y`).toBeLessThanOrEqual(r.y + r.h + 1)
}

/** Fills that lie inside the player card's box (not the background over the whole card). */
const fillsInside = (fake: Fake, r: { x: number; y: number; w: number; h: number }) =>
  fake.fills.filter((f) => f.box && f.box.x0 >= r.x - 2 && f.box.y0 >= r.y - 2 && f.box.x1 <= r.x + r.w + 2 && f.box.y1 <= r.y + r.h + 2)

// ---------- the default ----------

describe('drawPlayerCard with a layout (T8.7b)', () => {
  for (const size of SIZES) {
    it(`draws the default layout when none is given (${size})`, async () => {
      const without = await draw(size)
      const withDefault = await draw(size, defaultLayout(size))
      expect(without.log).toEqual(withDefault.log)
    })
  }

  it('still draws every part, the title and the date with the default layout', async () => {
    const fake = await draw('story', defaultLayout('story'))
    for (const p of PARTS) for (const t of PART_TEXTS[p]) expect(has(fake, t), `${p}: ${t}`).toBe(true)
    expect(has(fake, data.title)).toBe(true)
    expect(has(fake, data.date)).toBe(true)
  })
})

// ---------- removed parts and items ----------

describe('removed parts and items are not drawn', () => {
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

  it('leaves out the title when it is removed', async () => {
    const fake = await draw('story', removeItem(defaultLayout('story'), 'title'))
    expect(has(fake, data.title)).toBe(false)
    expect(has(fake, data.date)).toBe(true)
    expect(has(fake, data.name)).toBe(true)
  })

  it('leaves out the date when it is removed', async () => {
    const fake = await draw('post', removeItem(defaultLayout('post'), 'date'))
    expect(has(fake, data.date)).toBe(false)
    expect(has(fake, data.title)).toBe(true)
  })

  it('leaves out the whole player card when it is removed, and every part of it', async () => {
    for (const layout of [removeItem(defaultLayout('story'), 'player'), PARTS.reduce((l, p) => removePart(l, p), defaultLayout('story'))]) {
      const fake = await draw('story', layout)
      for (const p of PARTS) for (const t of PART_TEXTS[p]) expect(fake.texts.some((x) => x.text === t), `${p}: "${t}" drawn`).toBe(false)
      expect(has(fake, data.title)).toBe(true)
      expect(has(fake, data.date)).toBe(true)
    }
  })
})

// ---------- the Plotline items ----------

describe('the logo, wordmark and footer stay as they are', () => {
  /** Everything taken off the card's movable items, moved, resized and restyled. */
  const changed = (size: CardSize) => {
    let l = defaultLayout(size)
    l = moveItem(l, size, 'player', 5000, 5000)
    l = resizeItem(l, size, 'title', MIN_SCALE)
    l = moveItem(l, size, 'title', -5000, 5000)
    l = removeItem(l, 'date')
    l = setLook(setOpacity(l, 0), 'list')
    return l
  }

  for (const size of SIZES) {
    it(`draws the wordmark, the logo's "km" and the footer at the same place and size for any layout (${size})`, async () => {
      const a = await draw(size, defaultLayout(size))
      const b = await draw(size, changed(size))
      for (const text of [paddleStack.tv.brand, 'km', share.footer]) {
        const ta = textOf(a, text)
        const tb = textOf(b, text)
        expect([tb.x, tb.y, tb.px], text).toEqual([ta.x, ta.y, ta.px])
      }
    })

    it(`draws the same logo tile and footer rule for any layout (${size})`, async () => {
      const a = await draw(size, defaultLayout(size))
      const b = await draw(size, removeItem(removeItem(removeItem(defaultLayout(size), 'player'), 'title'), 'date'))
      // The header (logo, y < 170) and the footer (below the safe area) are drawn alike.
      const fixed = (f: Fake) => f.fills.filter((x) => x.box && (x.box.y1 <= 170 || x.box.y0 >= CARD_SIZES[size].height - 160)).map((x) => JSON.stringify(x))
      expect(fixed(b)).toEqual(fixed(a))
      expect(fixed(a).length).toBeGreaterThan(0)
    })
  }
})

// ---------- positions and sizes ----------

describe('each item is drawn at its position and size', () => {
  for (const size of SIZES) {
    for (const look of ['default', 'compact', 'list'] as const) {
      it(`draws the player card’s text inside its box, and the title and date inside theirs (${size}, ${look})`, async () => {
        const l = setLook(defaultLayout(size), look)
        const fake = await draw(size, l)
        const player = rectOf(l, size, 'player')
        for (const p of PARTS) for (const t of PART_TEXTS[p]) expectInside(textOf(fake, t), player, `${p} "${t}"`)
        expectInside(textOf(fake, data.title), rectOf(l, size, 'title'), 'title')
        expectInside(textOf(fake, data.date), rectOf(l, size, 'date'), 'date')
      })
    }
  }

  it('moves every part of the player card with it, and nothing else', async () => {
    for (const size of SIZES) {
      const base = defaultLayout(size)
      const moved = moveItem(base, size, 'player', -40, 60)
      const dx = moved.items.player.x - base.items.player.x
      const dy = moved.items.player.y - base.items.player.y
      expect(dx !== 0 || dy !== 0, `${size}: the move went somewhere`).toBe(true)
      const a = await draw(size, base)
      const b = await draw(size, moved)
      for (const p of PARTS)
        for (const t of PART_TEXTS[p]) {
          expect(textOf(b, t).x - textOf(a, t).x, `${size} ${t} x`).toBeCloseTo(dx, 3)
          expect(textOf(b, t).y - textOf(a, t).y, `${size} ${t} y`).toBeCloseTo(dy, 3)
        }
      for (const t of [data.title, data.date]) expect([textOf(b, t).x, textOf(b, t).y], t).toEqual([textOf(a, t).x, textOf(a, t).y])
    }
  })

  it('moves the title and the date on their own', async () => {
    const base = defaultLayout('story')
    const moved = moveItem(moveItem(base, 'story', 'title', 50, 20), 'story', 'date', 30, 70)
    const a = await draw('story', base)
    const b = await draw('story', moved)
    expect(textOf(b, data.title).x - textOf(a, data.title).x).toBeCloseTo(moved.items.title.x - base.items.title.x, 3)
    expect(textOf(b, data.title).y - textOf(a, data.title).y).toBeCloseTo(moved.items.title.y - base.items.title.y, 3)
    expect(textOf(b, data.date).x - textOf(a, data.date).x).toBeCloseTo(moved.items.date.x - base.items.date.x, 3)
    expect(textOf(b, data.date).y - textOf(a, data.date).y).toBeCloseTo(moved.items.date.y - base.items.date.y, 3)
    expect(textOf(b, data.name).x).toBeCloseTo(textOf(a, data.name).x, 3)
  })

  for (const id of ['player', 'title', 'date'] as CardItemId[]) {
    it(`draws the ${id} at its scale: text size and offsets within the box scale with it`, async () => {
      const size: CardSize = 'story'
      const base = defaultLayout(size)
      const s = (MIN_SCALE + 1) / 2
      const small = resizeItem(base, size, id, s)
      const a = await draw(size, base)
      const b = await draw(size, small)
      const ra = rectOf(base, size, id)
      const rb = rectOf(small, size, id)
      const texts = id === 'player' ? [data.name, share.placeOf(data.place, data.of), data.record, share.record] : [id === 'title' ? data.title : data.date]
      for (const t of texts) {
        const ta = textOf(a, t)
        const tb = textOf(b, t)
        expect(tb.px / ta.px, `${t} font size`).toBeCloseTo(s, 1)
        expect(tb.x - rb.x, `${t} x within the box`).toBeCloseTo((ta.x - ra.x) * s, 0)
        expect(tb.y - rb.y, `${t} y within the box`).toBeCloseTo((ta.y - ra.y) * s, 0)
      }
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
        const inside = fillsInside(fake, rectOf(l, 'story', 'player'))
        expect(
          inside.some((f) => Math.abs(f.alpha - opacity / 100) < 0.02),
          `a fill of alpha ${opacity / 100} inside the player card; found ${JSON.stringify(inside.map((f) => f.alpha))}`,
        ).toBe(true)
      })
    }

    it(`fills nothing behind the player card at opacity 0 (${id})`, async () => {
      const l = setOpacity(defaultLayout('story'), 0)
      const fake = await draw('story', l, bg(id))
      const inside = fillsInside(fake, rectOf(l, 'story', 'player'))
      expect(inside.filter((f) => f.alpha !== 0).map((f) => f.alpha)).toEqual([])
    })
  }

  for (const look of ['default', 'compact', 'list'] as const) {
    it(`applies the opacity in the ${look} look and keeps the text solid`, async () => {
      for (const opacity of [0, 40]) {
        const l = setOpacity(setLook(defaultLayout('post'), look), opacity)
        const fake = await draw('post', l)
        const inside = fillsInside(fake, rectOf(l, 'post', 'player'))
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
    expect(fillsInside(fake, rectOf(moved, 'story', 'player')).some((f) => Math.abs(f.alpha - 0.4) < 0.02)).toBe(true)
  })
})
