/**
 * The player card's layout (T8.7b, SPEC §6): three movable items (the player card, the session title, the date), the
 * parts inside the player card that can be removed on their own, the panel's opacity and the look. Positions are the
 * top-left of each item's box in card pixels (`CARD_SIZES[size]`); every change keeps the items inside the card,
 * between the Plotline header and the footer, which can't be moved, resized or removed. Pure, apart from the
 * load/save helpers at the bottom, which never throw.
 */
import { CARD_SIZES, type CardSize } from './cardData'

export const CARD_ITEMS = ['player', 'title', 'date'] as const
export type CardItemId = (typeof CARD_ITEMS)[number]

export const CARD_PARTS = ['name', 'place', 'record', 'winRate', 'streak', 'diff'] as const
export type CardPartId = (typeof CARD_PARTS)[number]

/** The four stat tiles, in the order they're drawn. */
export const STAT_PARTS = ['record', 'winRate', 'streak', 'diff'] as const satisfies readonly CardPartId[]

export const CARD_LOOKS = ['default', 'compact', 'list'] as const
export type CardLook = (typeof CARD_LOOKS)[number]

/** Drawn on every card as they are: never in a layout. */
export const FIXED_ITEMS = ['logo', 'wordmark', 'footer'] as const

export const MIN_SCALE = 0.5
/** The largest any item can be: 920 px wide × 1.15 still fits the 1080 px card, and every look fits the safe area. */
export const MAX_SCALE = 1.15
export const DEFAULT_OPACITY: number = 35

/** y coordinates between which the items stay: below the logo and wordmark, above the footer's rule. */
export const SAFE_AREA: Record<CardSize, { top: number; bottom: number }> = {
  story: { top: 200, bottom: CARD_SIZES.story.height - 160 },
  post: { top: 190, bottom: CARD_SIZES.post.height - 160 },
}

export interface CardItem {
  x: number
  y: number
  scale: number
  removed: boolean
}

export interface CardLayout {
  items: Record<CardItemId, CardItem>
  /** In the order they were removed. */
  removedParts: CardPartId[]
  /** 0 (clear) to 100 (solid): the panel behind the player card. */
  opacity: number
  look: CardLook
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The player card's measurements at scale 1, per size (drawCard.ts draws from the same numbers). `pad` is the panel's
 * inner margin; each block's height includes the space under it.
 */
export const PLAYER_METRICS = {
  story: { pad: 32, name: 140, nameFont: 124, place: 90, placeFont: 60, gap: 36, tile: 230, compactTile: 200, tileGap: 24, row: 100, rowGap: 12 },
  post: { pad: 32, name: 116, nameFont: 108, place: 76, placeFont: 52, gap: 28, tile: 160, compactTile: 150, tileGap: 20, row: 76, rowGap: 10 },
} as const

/** Width of every item's box at scale 1 (the card's width less the 80 px margins). */
export const ITEM_WIDTH = 920
const TITLE_HEIGHT: Record<CardSize, number> = { story: 60, post: 56 }
const DATE_HEIGHT = 44

const DEFAULT_POSITIONS: Record<CardSize, Record<CardItemId, { x: number; y: number }>> = {
  story: { title: { x: 80, y: 230 }, date: { x: 80, y: 300 }, player: { x: 80, y: 600 } },
  post: { title: { x: 80, y: 210 }, date: { x: 80, y: 278 }, player: { x: 80, y: 400 } },
}

const isItem = (id: string): id is CardItemId => (CARD_ITEMS as readonly string[]).includes(id)
const isPart = (id: string): id is CardPartId => (CARD_PARTS as readonly string[]).includes(id)
const isLook = (id: string): id is CardLook => (CARD_LOOKS as readonly string[]).includes(id)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function defaultLayout(size: CardSize): CardLayout {
  const pos = DEFAULT_POSITIONS[size]
  const item = (id: CardItemId): CardItem => ({ ...pos[id], scale: 1, removed: false })
  return { items: { player: item('player'), title: item('title'), date: item('date') }, removedParts: [], opacity: DEFAULT_OPACITY, look: 'default' }
}

const copy = (l: CardLayout): CardLayout => ({
  ...l,
  items: { player: { ...l.items.player }, title: { ...l.items.title }, date: { ...l.items.date } },
  removedParts: [...l.removedParts],
})

/** Which stat tiles are left, in order. */
export const statsShown = (l: CardLayout) => STAT_PARTS.filter((p) => !l.removedParts.includes(p))
const shown = (l: CardLayout, p: CardPartId) => !l.removedParts.includes(p)

/** The player card's height at scale 1 for its look and the parts left (the rest close up). */
export function playerHeight(l: CardLayout, size: CardSize): number {
  const m = PLAYER_METRICS[size]
  const n = statsShown(l).length
  let h = 0
  if (shown(l, 'name')) h += m.name
  if (shown(l, 'place')) h += m.place
  if (n > 0) {
    if (h > 0) h += m.gap
    if (l.look === 'compact') h += m.compactTile
    else if (l.look === 'list') h += n * m.row + (n - 1) * m.rowGap
    else {
      const rows = Math.ceil(n / 2)
      h += rows * m.tile + (rows - 1) * m.tileGap
    }
  }
  return h + 2 * m.pad
}

/** An item's box at scale 1. */
function baseSize(l: CardLayout, size: CardSize, id: CardItemId) {
  if (id === 'player') return { w: ITEM_WIDTH, h: playerHeight(l, size) }
  return { w: ITEM_WIDTH, h: id === 'title' ? TITLE_HEIGHT[size] : DATE_HEIGHT }
}

/** The largest scale at which the item still fits in the safe area. */
function maxFit(l: CardLayout, size: CardSize, id: CardItemId) {
  const { w, h } = baseSize(l, size, id)
  const safe = SAFE_AREA[size]
  return Math.min(MAX_SCALE, CARD_SIZES[size].width / w, (safe.bottom - safe.top) / h)
}

/** Pulls every item back inside the safe area, shrinking any that no longer fit (in place, on a copy). */
function fit(l: CardLayout, size: CardSize): CardLayout {
  const safe = SAFE_AREA[size]
  const { width } = CARD_SIZES[size]
  for (const id of CARD_ITEMS) {
    const it = l.items[id]
    it.scale = clamp(it.scale, MIN_SCALE, maxFit(l, size, id))
    const { w, h } = baseSize(l, size, id)
    it.x = clamp(it.x, 0, width - w * it.scale)
    it.y = clamp(it.y, safe.top, safe.bottom - h * it.scale)
  }
  return l
}

/** The boxes of the items drawn on the card (a removed item, or the title of a session without one, has none). */
export function itemRects(l: CardLayout, size: CardSize, { hasTitle }: { hasTitle: boolean }): Partial<Record<CardItemId, Rect>> {
  const out: Partial<Record<CardItemId, Rect>> = {}
  for (const id of CARD_ITEMS) {
    const it = l.items[id]
    if (it.removed || (id === 'title' && !hasTitle)) continue
    const { w, h } = baseSize(l, size, id)
    out[id] = { x: it.x, y: it.y, w: w * it.scale, h: h * it.scale }
  }
  return out
}

/** The item under the point (card pixels), the topmost first: the player card is drawn last. */
export function hitItem(l: CardLayout, size: CardSize, opts: { hasTitle: boolean }, x: number, y: number): CardItemId | null {
  const rects = itemRects(l, size, opts)
  for (const id of ['player', 'date', 'title'] as const) {
    const r = rects[id]
    if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id
  }
  return null
}

export function moveItem(l: CardLayout, size: CardSize, id: string, dx: number, dy: number): CardLayout {
  if (!isItem(id)) return l
  const next = copy(l)
  next.items[id].x += dx
  next.items[id].y += dy
  return fit(next, size)
}

export function resizeItem(l: CardLayout, size: CardSize, id: string, scale: number): CardLayout {
  if (!isItem(id) || !Number.isFinite(scale)) return l
  const next = copy(l)
  next.items[id].scale = scale
  return fit(next, size)
}

export function removeItem(l: CardLayout, id: string): CardLayout {
  if (!isItem(id)) return l
  const next = copy(l)
  next.items[id].removed = true
  return next
}

/** Brings an item back; the player card comes back with all its parts if every one had been removed. */
export function restoreItem(l: CardLayout, id: string, size?: CardSize): CardLayout {
  if (!isItem(id)) return l
  const next = copy(l)
  next.items[id].removed = false
  if (id === 'player' && next.removedParts.length === CARD_PARTS.length) next.removedParts = []
  return size ? fit(next, size) : next
}

/** Removes one part of the player card; removing the last one removes the card. */
export function removePart(l: CardLayout, part: CardPartId): CardLayout {
  if (!isPart(part) || l.removedParts.includes(part)) return l
  const next = copy(l)
  next.removedParts.push(part)
  if (next.removedParts.length === CARD_PARTS.length) next.items.player.removed = true
  return next
}

/** Brings a part back, and the player card with it. */
export function restorePart(l: CardLayout, part: CardPartId, size?: CardSize): CardLayout {
  if (!isPart(part)) return l
  const next = copy(l)
  next.removedParts = next.removedParts.filter((p) => p !== part)
  next.items.player.removed = false
  return size ? fit(next, size) : next
}

export function setOpacity(l: CardLayout, opacity: number): CardLayout {
  if (!Number.isFinite(opacity)) return l
  return { ...copy(l), opacity: clamp(Math.round(opacity), 0, 100) }
}

/** Picks a look; with the size, the player card is pulled back inside if its new height needs it. */
export function setLook(l: CardLayout, look: CardLook, size?: CardSize): CardLayout {
  if (!isLook(look)) return l
  const next = { ...copy(l), look }
  return size ? fit(next, size) : next
}

/** Pulls a layout inside the card for its size (used before drawing, and on load). */
export const fitLayout = (l: CardLayout, size: CardSize): CardLayout => fit(copy(l), size)

// ---------- saved on the device ----------

export const CARD_LAYOUT_KEY = 'plotline.paddle-stack.card-layout'

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseItem(v: unknown): CardItem | null {
  if (typeof v !== 'object' || v === null) return null
  const { x, y, scale, removed } = v as Record<string, unknown>
  if (!num(x) || !num(y) || !num(scale) || typeof removed !== 'boolean') return null
  return { x, y, scale, removed }
}

/** A saved layout, or null when anything in it is off. */
function parseLayout(v: unknown, size: CardSize): CardLayout | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const { items, removedParts, opacity, look } = v as Record<string, unknown>
  if (typeof items !== 'object' || items === null) return null
  const raw = items as Record<string, unknown>
  const player = parseItem(raw.player)
  const title = parseItem(raw.title)
  const date = parseItem(raw.date)
  if (!player || !title || !date) return null
  if (!Array.isArray(removedParts) || !removedParts.every((p) => typeof p === 'string' && isPart(p))) return null
  if (!num(opacity) || typeof look !== 'string' || !isLook(look)) return null
  const parts = [...new Set(removedParts as CardPartId[])]
  return fit({ items: { player, title, date }, removedParts: parts, opacity: clamp(opacity, 0, 100), look }, size)
}

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CARD_LAYOUT_KEY)
    if (!raw) return {}
    const data: unknown = JSON.parse(raw)
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The layout saved for this size, or the default. */
export function loadCardLayout(size: CardSize): CardLayout {
  return parseLayout(readAll()[size], size) ?? defaultLayout(size)
}

/** Saves the layout for this size, keeping the other size's; false when storage fails (it still works for the visit). */
export function saveCardLayout(size: CardSize, layout: CardLayout): boolean {
  try {
    localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify({ ...readAll(), [size]: layout }))
    return true
  } catch {
    return false
  }
}

/** Forgets this size's layout (Reset layout). */
export function clearCardLayout(size: CardSize): void {
  try {
    const rest = readAll()
    delete rest[size]
    if (Object.keys(rest).length === 0) localStorage.removeItem(CARD_LAYOUT_KEY)
    else localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(rest))
  } catch {
    // Nothing saved to forget when storage is unavailable.
  }
}
