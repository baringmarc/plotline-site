/**
 * Draws the share cards (T8.7) on a canvas: the player card (Strava-style stats, arranged by its layout, T8.7b) and the
 * group card (the leaderboard), at story or post size, on a built-in background or the organizer's photo under a
 * shade. Names and big numbers use
 * Paddle Stack's display face (T8.2), waited for before any text is drawn; the rest is DM Sans. No image is loaded:
 * the Plotline logo is drawn as shapes, so nothing is fetched while making a card.
 */
import { paddleStack } from '../../../config/paddleStack'
import { loadStackFonts, STACK_DISPLAY } from '../fonts'
import { overlayAlpha, type CardBackground } from './backgrounds'
import { CARD_SIZES, type CardSize, type GroupCardData, type PlayerCardData } from './cardData'
import { defaultLayout, fitLayout, itemRects, ITEM_WIDTH, PLAYER_METRICS, STAT_PARTS, statsShown, type CardLayout, type Rect } from './layout'

const { share } = paddleStack

const DISPLAY = STACK_DISPLAY
const SANS = "'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Brand palette (court-booking-system docs/BRAND.md; the logo's own colours). */
const C = {
  cream: '#f5efe6',
  brown: '#3b2f2a',
  brownSoft: '#5a4a42',
  terracotta: '#7a3f2c',
  clay: '#b4583b',
  blush: '#e8c4b8',
  sage: '#b7c4a8',
  sand: '#e6d9c6',
  white: '#ffffff',
}

interface Theme {
  text: string
  soft: string
  accent: string
  /** Behind every other leaderboard row. */
  panel: string
  /** The player card's panel (drawn at the layout's opacity): a colour the text reads on when solid. */
  card: string
  /** The stat tiles' outlines and the List look's dividers. */
  line: string
}

const ON_DARK: Theme = {
  text: '#fffaf3',
  soft: 'rgba(255, 250, 243, 0.78)',
  accent: C.blush,
  panel: 'rgba(255, 250, 243, 0.12)',
  card: '#231b18',
  line: 'rgba(255, 250, 243, 0.3)',
}
const ON_LIGHT: Theme = {
  text: C.brown,
  soft: C.brownSoft,
  accent: C.terracotta,
  panel: 'rgba(59, 47, 42, 0.07)',
  card: '#fffaf3',
  line: 'rgba(59, 47, 42, 0.2)',
}

export interface DrawOptions {
  size: CardSize
  background: CardBackground
  /** 0–100; only used over a photo. */
  darkness: number
  /** The player card's arrangement (T8.7b); the default layout when left out. Not used by the group card. */
  layout?: CardLayout
}

const LEFT = 80

async function loadFonts() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts?.load) return
  loadStackFonts()
  try {
    await Promise.all([
      fonts.load(`800 64px ${DISPLAY}`),
      fonts.load(`700 32px ${DISPLAY}`),
      fonts.load(`500 32px ${SANS}`),
      fonts.load(`700 32px ${SANS}`),
    ])
  } catch {
    // The fallback fonts still draw a readable card.
  }
}

/** A canvas of the card's size, its 2D context and its theme once the fonts are in. Rejects without a 2D context. */
async function start(opts: DrawOptions) {
  const { width, height } = CARD_SIZES[opts.size]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  await loadFonts()
  const theme = paintBackground(ctx, opts, width, height)
  ctx.textBaseline = 'alphabetic'
  return { canvas, ctx, theme, width, height }
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png')
  })
}

// ---------- backgrounds ----------

function imageSize(image: CanvasImageSource): { w: number; h: number } {
  const i = image as { naturalWidth?: number; naturalHeight?: number; width?: unknown; height?: unknown }
  const w = i.naturalWidth || (typeof i.width === 'number' ? i.width : 0)
  const h = i.naturalHeight || (typeof i.height === 'number' ? i.height : 0)
  return { w, h }
}

function paintBackground(ctx: CanvasRenderingContext2D, opts: DrawOptions, W: number, H: number): Theme {
  const bg = opts.background
  if (bg.kind === 'photo') {
    ctx.fillStyle = C.brown
    ctx.fillRect(0, 0, W, H)
    const { w, h } = imageSize(bg.image)
    if (w > 0 && h > 0) {
      // Cover the card at the photo's own aspect ratio, centred.
      const scale = Math.max(W / w, H / h)
      const dw = w * scale
      const dh = h * scale
      ctx.drawImage(bg.image, (W - dw) / 2, (H - dh) / 2, dw, dh)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = `rgba(20, 14, 12, ${overlayAlpha(opts.darkness)})`
    ctx.fillRect(0, 0, W, H)
    return ON_DARK
  }
  return paintBuiltin(ctx, bg.id, W, H)
}

function paintBuiltin(ctx: CanvasRenderingContext2D, id: string, W: number, H: number): Theme {
  switch (id) {
    case 'night': {
      ctx.fillStyle = '#231b18'
      ctx.fillRect(0, 0, W, H)
      courtLines(ctx, W, H, 'rgba(232, 196, 184, 0.16)')
      return ON_DARK
    }
    case 'sunset': {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#d98a6a')
      g.addColorStop(0.55, C.terracotta)
      g.addColorStop(1, C.brown)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      return ON_DARK
    }
    case 'sand': {
      ctx.fillStyle = C.cream
      ctx.fillRect(0, 0, W, H)
      blob(ctx, W, H, W * 0.9, H * 0.12, W * 0.55, 'rgba(232, 196, 184, 0.55)')
      blob(ctx, W, H, W * 0.05, H * 0.85, W * 0.6, 'rgba(183, 196, 168, 0.45)')
      return ON_LIGHT
    }
    default: {
      // 'clay', and any unknown id.
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, C.clay)
      g.addColorStop(1, C.brown)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      return ON_DARK
    }
  }
}

/** A soft round glow (the Sand background). */
function blob(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, r: number, colour: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, colour)
  g.addColorStop(1, 'rgba(245, 239, 230, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

/** A pickleball court's lines across the card, faint (the Night court background). */
function courtLines(ctx: CanvasRenderingContext2D, W: number, H: number, colour: string) {
  const m = 60
  const top = m
  const bottom = H - m
  const mid = H / 2
  const kitchen = (bottom - top) * 0.16
  ctx.strokeStyle = colour
  ctx.lineWidth = 6
  ctx.strokeRect(m, top, W - 2 * m, bottom - top)
  ctx.beginPath()
  ctx.moveTo(m, mid)
  ctx.lineTo(W - m, mid)
  ctx.moveTo(m, mid - kitchen)
  ctx.lineTo(W - m, mid - kitchen)
  ctx.moveTo(m, mid + kitchen)
  ctx.lineTo(W - m, mid + kitchen)
  ctx.moveTo(W / 2, top)
  ctx.lineTo(W / 2, mid - kitchen)
  ctx.moveTo(W / 2, mid + kitchen)
  ctx.lineTo(W / 2, bottom)
  ctx.stroke()
}

// ---------- shared pieces ----------

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The Plotline logo (public/logo.svg) drawn as shapes: the blush tile, the brown line through four dots, "km" on the green one. */
function logo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const u = size / 300
  ctx.fillStyle = C.blush
  roundedRect(ctx, x, y, size, size, 60 * u)
  ctx.fill()
  const pts: [number, number][] = [
    [50, 205],
    [105, 125],
    [170, 178],
    [248, 80],
  ]
  ctx.strokeStyle = C.brown
  ctx.lineWidth = 30 * u
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x + px * u, y + py * u) : ctx.lineTo(x + px * u, y + py * u)))
  ctx.stroke()
  pts.forEach(([px, py], i) => {
    ctx.beginPath()
    ctx.arc(x + px * u, y + py * u, (i === 2 ? 30 : 25) * u, 0, Math.PI * 2)
    ctx.fillStyle = i === 2 ? C.sage : C.white
    ctx.fill()
    ctx.lineWidth = 9 * u
    ctx.stroke()
  })
  ctx.fillStyle = C.brown
  ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(26 * u)}px ${SANS}`
  ctx.fillText('km', x + 170 * u, y + 187 * u)
}

/** Logo tile and "plotline" wordmark, top left. */
function header(ctx: CanvasRenderingContext2D, theme: Theme) {
  logo(ctx, LEFT, 80, 88)
  ctx.fillStyle = theme.text
  ctx.textAlign = 'left'
  ctx.font = `800 44px ${DISPLAY}`
  ctx.fillText(paddleStack.tv.brand, LEFT + 110, 138)
}

function footer(ctx: CanvasRenderingContext2D, theme: Theme, text: string, W: number, H: number) {
  ctx.fillStyle = theme.soft
  ctx.fillRect(LEFT, H - 150, W - 2 * LEFT, 2)
  ctx.textAlign = 'left'
  fitFont(ctx, text, 700, 30, SANS, W - 2 * LEFT)
  ctx.fillStyle = theme.text
  ctx.fillText(text, LEFT, H - 84)
}

/** Shrinks a font until `text` fits in `width` (in steps of 2 px times `k`, down to 20 px times `k`). */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, width: number, k = 1) {
  let s = size
  ctx.font = `${weight} ${s}px ${family}`
  while (s > 20 * k && ctx.measureText(text).width > width) {
    s = px(s - 2 * k)
    ctx.font = `${weight} ${s}px ${family}`
  }
}

// ---------- the player card ----------

/** A font size with one decimal, so a scaled item's text keeps its proportions. */
const px = (n: number) => Math.round(n * 10) / 10

/** The player card, title and date where the layout puts them (T8.7b); the header and footer never move. */
export async function drawPlayerCard(data: PlayerCardData, opts: DrawOptions): Promise<Blob> {
  const { canvas, ctx, theme, width: W, height: H } = await start(opts)
  const layout = fitLayout(opts.layout ?? defaultLayout(opts.size), opts.size)
  const rects = itemRects(layout, opts.size, { hasTitle: data.title !== '' })
  header(ctx, theme)

  ctx.textAlign = 'left'
  if (rects.title) {
    const r = rects.title
    const s = layout.items.title.scale
    ctx.fillStyle = theme.text
    fitFont(ctx, data.title, 700, px(44 * s), DISPLAY, r.w, s)
    ctx.fillText(data.title, r.x, r.y + (opts.size === 'story' ? 46 : 44) * s)
  }
  if (rects.date) {
    const r = rects.date
    const s = layout.items.date.scale
    ctx.fillStyle = theme.soft
    fitFont(ctx, data.date, 500, px(32 * s), SANS, r.w, s)
    ctx.fillText(data.date, r.x, r.y + 32 * s)
  }
  if (rects.player) playerItem(ctx, data, layout, opts.size, rects.player, theme)

  footer(ctx, theme, data.footer, W, H)
  return toPng(canvas)
}

function playerItem(ctx: CanvasRenderingContext2D, data: PlayerCardData, layout: CardLayout, size: CardSize, r: Rect, theme: Theme) {
  const s = layout.items.player.scale
  const m = PLAYER_METRICS[size]
  const story = size === 'story'
  const X = (lx: number) => r.x + lx * s
  const Y = (ly: number) => r.y + ly * s
  const cw = ITEM_WIDTH - 2 * m.pad

  // The panel behind the card; only it fades, the text stays solid.
  if (layout.opacity > 0) {
    ctx.globalAlpha = layout.opacity / 100
    ctx.fillStyle = theme.card
    roundedRect(ctx, r.x, r.y, r.w, r.h, 36 * s)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.textAlign = 'left'
  let y = m.pad
  if (!layout.removedParts.includes('name')) {
    ctx.fillStyle = theme.text
    fitFont(ctx, data.name, 800, px(m.nameFont * s), DISPLAY, cw * s, s)
    ctx.fillText(data.name, X(m.pad), Y(y + m.nameFont * 0.85))
    y += m.name
  }
  if (!layout.removedParts.includes('place')) {
    ctx.fillStyle = theme.accent
    ctx.font = `800 ${px(m.placeFont * s)}px ${DISPLAY}`
    ctx.fillText(share.placeOf(data.place, data.of), X(m.pad), Y(y + m.placeFont * 0.95))
    y += m.place
  }

  const values: Record<(typeof STAT_PARTS)[number], [string, string]> = {
    record: [share.record, data.record],
    winRate: [share.winRateLabel, data.winRate === null ? '—' : `${data.winRate}%`],
    streak: [share.streakLabel, String(data.streak)],
    diff: [share.diff, data.diff],
  }
  const stats = statsShown(layout).map((p) => values[p])
  if (stats.length === 0) return
  if (y > m.pad) y += m.gap

  ctx.strokeStyle = theme.line
  ctx.lineWidth = 2 * s
  if (layout.look === 'list') {
    stats.forEach(([label, value], i) => {
      const ry = y + i * (m.row + m.rowGap)
      const base = Y(ry + m.row * 0.62)
      if (i > 0) {
        ctx.beginPath()
        ctx.moveTo(X(m.pad), Y(ry - m.rowGap / 2))
        ctx.lineTo(X(m.pad + cw), Y(ry - m.rowGap / 2))
        ctx.stroke()
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = theme.soft
      fitFont(ctx, label, 700, px((story ? 34 : 28) * s), SANS, cw * 0.5 * s, s)
      ctx.fillText(label, X(m.pad), base)
      ctx.textAlign = 'right'
      ctx.fillStyle = theme.text
      fitFont(ctx, value, 800, px((story ? 72 : 56) * s), DISPLAY, cw * 0.45 * s, s)
      ctx.fillText(value, X(m.pad + cw), base)
    })
    ctx.textAlign = 'left'
    return
  }

  const compact = layout.look === 'compact'
  const cols = compact ? stats.length : 2
  const gap = compact ? 16 : m.tileGap
  const tileW = (cw - (cols - 1) * gap) / cols
  const tileH = compact ? m.compactTile : m.tile
  const inset = compact ? 16 : 36
  stats.forEach(([label, value], i) => {
    const tx = m.pad + (i % cols) * (tileW + gap)
    const ty = y + Math.floor(i / cols) * (tileH + m.tileGap)
    roundedRect(ctx, X(tx), Y(ty), tileW * s, tileH * s, (compact ? 20 : 28) * s)
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.fillStyle = theme.soft
    fitFont(ctx, label, 700, px((compact ? (story ? 26 : 22) : story ? 32 : 28) * s), SANS, (tileW - 2 * inset) * s, s)
    ctx.fillText(label, X(tx + inset), Y(ty + tileH * 0.3))
    ctx.fillStyle = theme.text
    fitFont(ctx, value, 800, px((compact ? (story ? 72 : 56) : story ? 120 : 88) * s), DISPLAY, (tileW - 2 * inset) * s, s)
    ctx.fillText(value, X(tx + inset), Y(ty + tileH * 0.8))
  })
}

// ---------- the group card ----------

export async function drawGroupCard(data: GroupCardData, opts: DrawOptions): Promise<Blob> {
  const { canvas, ctx, theme, width: W, height: H } = await start(opts)
  const story = opts.size === 'story'
  const right = W - LEFT
  header(ctx, theme)

  ctx.textAlign = 'left'
  ctx.fillStyle = theme.text
  fitFont(ctx, data.title, 800, 64, DISPLAY, right - LEFT)
  ctx.fillText(data.title, LEFT, 300)
  ctx.fillStyle = theme.soft
  ctx.font = `500 32px ${SANS}`
  ctx.fillText(data.date, LEFT, 352)

  const cols = { place: LEFT, name: LEFT + 80, record: right - 170, diff: right }
  const head = 440
  ctx.font = `700 26px ${SANS}`
  ctx.fillText('#', cols.place, head)
  ctx.textAlign = 'right'
  ctx.fillText(share.record, cols.record, head)
  ctx.fillText(share.diff, cols.diff, head)
  ctx.fillStyle = theme.soft
  ctx.fillRect(LEFT, head + 20, right - LEFT, 2)

  const step = story ? 68 : 62
  const first = head + 20 + step
  data.rows.forEach((row, i) => {
    const y = first + i * step
    if (i % 2 === 0) {
      ctx.fillStyle = theme.panel
      roundedRect(ctx, LEFT - 20, y - step + 16, right - LEFT + 40, step - 6, 14)
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = row.place === 1 ? theme.accent : theme.soft
    ctx.font = `800 32px ${DISPLAY}`
    ctx.fillText(String(row.place), cols.place, y)
    ctx.fillStyle = theme.text
    fitFont(ctx, row.name, 700, 34, DISPLAY, cols.record - cols.name - 110)
    ctx.fillText(row.name, cols.name, y)
    ctx.textAlign = 'right'
    ctx.font = `500 32px ${SANS}`
    ctx.fillText(row.record, cols.record, y)
    ctx.fillText(row.diff, cols.diff, y)
  })
  if (data.more > 0) {
    ctx.textAlign = 'left'
    ctx.fillStyle = theme.soft
    ctx.font = `700 30px ${SANS}`
    ctx.fillText(share.more(data.more), cols.name, first + data.rows.length * step)
  }

  footer(ctx, theme, data.footer, W, H)
  return toPng(canvas)
}
