/**
 * The player card's layout (T8.7b, rearranged in T8.7c, SPEC §6): one movable item, the player card, that holds
 * everything on the card: the Plotline logo left of the name, the stat tiles, the session title and the date bottom
 * left, and the Paddle Stack link bottom right. The name, each stat tile, the title and the date can be removed on
 * their own and the rest close up; the logo and the link can't, so the card is never removed. Also the panel's opacity
 * and the look. The position is the top-left of the card's box in card pixels (`CARD_SIZES[size]`); every change keeps
 * it on the card. Pure, apart from the load/save helpers at the bottom, which never throw.
 */
import { CARD_SIZES, type CardSize } from './cardData'

export const CARD_ITEMS = ['player'] as const
export type CardItemId = (typeof CARD_ITEMS)[number]

export const CARD_PARTS = ['name', 'record', 'winRate', 'streak', 'diff', 'title', 'date'] as const
export type CardPartId = (typeof CARD_PARTS)[number]

/** The four stat tiles, in the order they're drawn. */
export const STAT_PARTS = ['record', 'winRate', 'streak', 'diff'] as const satisfies readonly CardPartId[]

export const CARD_LOOKS = ['default', 'compact', 'list'] as const
export type CardLook = (typeof CARD_LOOKS)[number]

/** Drawn inside the player card on every layout, and never removed. */
export const FIXED_PARTS = ['logo', 'link'] as const

export const MIN_SCALE = 0.5
/** The largest the card can be: 920 px wide × 1.15 still fits the 1080 px card, and every look fits the safe area. */
export const MAX_SCALE = 1.15
export const DEFAULT_OPACITY: number = 35

/** y coordinates between which the card stays: the whole card, since nothing else is drawn outside it. */
export const SAFE_AREA: Record<CardSize, { top: number; bottom: number }> = {
  story: { top: 0, bottom: CARD_SIZES.story.height },
  post: { top: 0, bottom: CARD_SIZES.post.height },
}

export interface CardItem {
  x: number
  y: number
  scale: number
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
 * inner margin; `name` is the top row (the logo beside the name), `gap` the space between the top row, the tiles and
 * the bottom row; `title` and `date` are the bottom-left lines, `link` the bottom row's height with neither.
 */
export const PLAYER_METRICS = {
  story: {
    pad: 32,
    logo: 72,
    logoGap: 24,
    name: 140,
    nameFont: 124,
    gap: 36,
    tile: 230,
    compactTile: 200,
    tileGap: 24,
    row: 100,
    rowGap: 12,
    title: 60,
    titleFont: 44,
    date: 44,
    dateFont: 32,
    link: 40,
    linkFont: 28,
  },
  post: {
    pad: 32,
    logo: 60,
    logoGap: 20,
    name: 116,
    nameFont: 108,
    gap: 28,
    tile: 160,
    compactTile: 150,
    tileGap: 20,
    row: 76,
    rowGap: 10,
    title: 54,
    titleFont: 40,
    date: 40,
    dateFont: 30,
    link: 36,
    linkFont: 24,
  },
} as const

/** Width of the card's box at scale 1 (the card's width less the 80 px margins). */
export const ITEM_WIDTH = 920

const DEFAULT_POSITIONS: Record<CardSize, Record<CardItemId, { x: number; y: number }>> = {
  story: { player: { x: 80, y: 528 } },
  post: { player: { x: 80, y: 340 } },
}

const isItem = (id: string): id is CardItemId => (CARD_ITEMS as readonly string[]).includes(id)
const isPart = (id: string): id is CardPartId => (CARD_PARTS as readonly string[]).includes(id)
const isLook = (id: string): id is CardLook => (CARD_LOOKS as readonly string[]).includes(id)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function defaultLayout(size: CardSize): CardLayout {
  return { items: { player: { ...DEFAULT_POSITIONS[size].player, scale: 1 } }, removedParts: [], opacity: DEFAULT_OPACITY, look: 'default' }
}

const copy = (l: CardLayout): CardLayout => ({ ...l, items: { player: { ...l.items.player } }, removedParts: [...l.removedParts] })

/** Which stat tiles are left, in order. */
export const statsShown = (l: CardLayout) => STAT_PARTS.filter((p) => !l.removedParts.includes(p))
/** Whether a part is drawn (the title only for a session that has one). */
export const partShown = (l: CardLayout, p: CardPartId, { hasTitle }: { hasTitle: boolean }) =>
  !l.removedParts.includes(p) && (p !== 'title' || hasTitle)

/** The bottom row's height: the title and date lines on the left, or the link's line when both are gone. */
export function footHeight(l: CardLayout, size: CardSize, opts: { hasTitle: boolean }): number {
  const m = PLAYER_METRICS[size]
  const h = (partShown(l, 'title', opts) ? m.title : 0) + (partShown(l, 'date', opts) ? m.date : 0)
  return h > 0 ? h : m.link
}

/** The height of the tiles for the look and the tiles left (0 with none). */
export function statsHeight(l: CardLayout, size: CardSize): number {
  const m = PLAYER_METRICS[size]
  const n = statsShown(l).length
  if (n === 0) return 0
  if (l.look === 'compact') return m.compactTile
  if (l.look === 'list') return n * m.row + (n - 1) * m.rowGap
  const rows = Math.ceil(n / 2)
  return rows * m.tile + (rows - 1) * m.tileGap
}

/** The player card's height at scale 1 for its look and the parts left (the rest close up). */
export function playerHeight(l: CardLayout, size: CardSize, opts: { hasTitle: boolean } = { hasTitle: true }): number {
  const m = PLAYER_METRICS[size]
  const top = partShown(l, 'name', opts) ? m.name : m.logo
  const stats = statsHeight(l, size)
  return m.pad + top + (stats > 0 ? m.gap + stats : 0) + m.gap + footHeight(l, size, opts) + m.pad
}

/**
 * The card's box at scale 1. Positions are clamped for the card with a title line (the tallest), so a card without
 * one never needs a second clamp.
 */
function baseSize(l: CardLayout, size: CardSize, opts: { hasTitle: boolean } = { hasTitle: true }) {
  return { w: ITEM_WIDTH, h: playerHeight(l, size, opts) }
}

/** The largest scale at which the card still fits in the safe area. */
function maxFit(l: CardLayout, size: CardSize) {
  const { w, h } = baseSize(l, size)
  const safe = SAFE_AREA[size]
  return Math.min(MAX_SCALE, CARD_SIZES[size].width / w, (safe.bottom - safe.top) / h)
}

/** Pulls the card back inside the safe area, shrinking it if it no longer fits (in place, on a copy). */
function fit(l: CardLayout, size: CardSize): CardLayout {
  const safe = SAFE_AREA[size]
  const { width } = CARD_SIZES[size]
  for (const id of CARD_ITEMS) {
    const it = l.items[id]
    it.scale = clamp(it.scale, MIN_SCALE, maxFit(l, size))
    const { w, h } = baseSize(l, size)
    it.x = clamp(it.x, 0, width - w * it.scale)
    it.y = clamp(it.y, safe.top, safe.bottom - h * it.scale)
  }
  return l
}

/** The card's box, as drawn (shorter without a title line). */
export function itemRects(l: CardLayout, size: CardSize, opts: { hasTitle: boolean }): Record<CardItemId, Rect> {
  const it = l.items.player
  const { w, h } = baseSize(l, size, opts)
  return { player: { x: it.x, y: it.y, w: w * it.scale, h: h * it.scale } }
}

/** The item under the point (card pixels), or null. */
export function hitItem(l: CardLayout, size: CardSize, opts: { hasTitle: boolean }, x: number, y: number): CardItemId | null {
  const r = itemRects(l, size, opts).player
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? 'player' : null
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

/** Removes one part of the player card; the logo and the link (not parts) can't be. */
export function removePart(l: CardLayout, part: CardPartId): CardLayout {
  if (!isPart(part) || l.removedParts.includes(part)) return l
  const next = copy(l)
  next.removedParts.push(part)
  return next
}

/** Brings a part back; with the size, the card is pulled back inside if its new height needs it. */
export function restorePart(l: CardLayout, part: CardPartId, size?: CardSize): CardLayout {
  if (!isPart(part)) return l
  const next = copy(l)
  next.removedParts = next.removedParts.filter((p) => p !== part)
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
  const { x, y, scale } = v as Record<string, unknown>
  if (!num(x) || !num(y) || !num(scale)) return null
  return { x, y, scale }
}

/** Whether a T8.7b item (the title or the date, separate then) was saved as removed. */
const wasRemoved = (v: unknown) => typeof v === 'object' && v !== null && (v as Record<string, unknown>).removed === true

/**
 * A saved layout, or null when anything in it is off. A T8.7b layout still loads: its place part is dropped (the card
 * no longer shows it) and a removed title or date item becomes a removed part.
 */
function parseLayout(v: unknown, size: CardSize): CardLayout | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const { items, removedParts, opacity, look } = v as Record<string, unknown>
  if (typeof items !== 'object' || items === null) return null
  const raw = items as Record<string, unknown>
  const player = parseItem(raw.player)
  if (!player) return null
  if (!Array.isArray(removedParts) || !removedParts.every((p) => typeof p === 'string' && (isPart(p) || p === 'place'))) return null
  if (!num(opacity) || typeof look !== 'string' || !isLook(look)) return null
  const parts = (removedParts as string[]).filter(isPart)
  for (const old of ['title', 'date'] as const) if (wasRemoved(raw[old])) parts.push(old)
  return fit({ items: { player }, removedParts: [...new Set(parts)], opacity: clamp(opacity, 0, 100), look }, size)
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
