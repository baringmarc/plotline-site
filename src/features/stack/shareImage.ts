/**
 * The standings image organizers post in FB groups (T5.5): a square PNG drawn on a canvas in the brand's fonts
 * and colours, carrying "plotline.fit/paddle-stack". Nothing is uploaded: it is shared as a file or downloaded.
 */
import { paddleStack } from '../../config/paddleStack'
import type { StandingRow } from './types'

const { share } = paddleStack

export const MAX_ROWS = 10
export const MAX_NAME = 22
const SIZE = 1080

/** Brand palette (court-booking-system docs/BRAND.md; the light theme's values in global.css `:root`). */
const C = { cream: '#f5efe6', brown: '#3b2f2a', brownSoft: '#5a4a42', sand: '#e6d9c6', terracotta: '#7a3f2c' }
const SERIF = "'Fraunces', Georgia, serif"
const SANS = "'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif"

export interface StandingsImageData {
  title: string
  date: string
  rows: { place: number; name: string; record: string; diff: string }[]
  more: string | null
  footer: string
}

/** Cuts a name to MAX_NAME characters (not UTF-16 units, so ñ or an emoji is never split). */
function cut(name: string): string {
  const chars = Array.from(name)
  return chars.length <= MAX_NAME ? name : `${chars.slice(0, MAX_NAME - 1).join('')}…`
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

export function standingsImageData(rows: StandingRow[], opts: { sessionName?: string; date: Date }): StandingsImageData {
  const title = opts.sessionName?.trim() || share.defaultTitle
  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(opts.date)
  return {
    title,
    date,
    rows: rows.slice(0, MAX_ROWS).map((r) => ({
      place: r.place,
      name: cut(r.name),
      record: `${r.wins}–${r.losses}`,
      diff: signed(r.pointsFor - r.pointsAgainst),
    })),
    more: rows.length > MAX_ROWS ? share.more(rows.length - MAX_ROWS) : null,
    footer: share.footer,
  }
}

async function loadFonts() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts?.load) return
  try {
    await Promise.all([fonts.load(`700 64px ${SERIF}`), fonts.load(`500 32px ${SANS}`), fonts.load(`700 32px ${SANS}`)])
  } catch {
    // The fallback fonts still draw a readable image.
  }
}

/** Shrinks a font until `text` fits in `width`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, width: number) {
  let s = size
  ctx.font = `${weight} ${s}px ${family}`
  while (s > 24 && ctx.measureText(text).width > width) {
    s -= 2
    ctx.font = `${weight} ${s}px ${family}`
  }
}

export async function drawStandingsImage(data: StandingsImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  await loadFonts()

  const left = 80
  const right = SIZE - 80
  ctx.fillStyle = C.cream
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = C.brown
  ctx.textAlign = 'left'
  fit(ctx, data.title, 700, 64, SERIF, right - left)
  ctx.fillText(data.title, left, 150)
  ctx.fillStyle = C.brownSoft
  ctx.font = `500 32px ${SANS}`
  ctx.fillText(data.date, left, 205)

  const cols = { place: left, name: left + 80, record: right - 150, diff: right }
  const head = 278
  ctx.font = `700 24px ${SANS}`
  ctx.fillText('#', cols.place, head)
  ctx.textAlign = 'right'
  ctx.fillText(share.record, cols.record, head)
  ctx.fillText(share.diff, cols.diff, head)
  ctx.fillStyle = C.sand
  ctx.fillRect(left, head + 18, right - left, 3)

  const step = 56
  data.rows.forEach((row, i) => {
    const y = 350 + i * step
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(230, 217, 198, 0.45)'
      ctx.fillRect(left - 16, y - 38, right - left + 32, step - 4)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = row.place === 1 ? C.terracotta : C.brownSoft
    ctx.font = `700 30px ${SANS}`
    ctx.fillText(String(row.place), cols.place, y)
    ctx.fillStyle = C.brown
    fit(ctx, row.name, 700, 32, SANS, cols.record - cols.name - 110)
    ctx.fillText(row.name, cols.name, y)
    ctx.textAlign = 'right'
    ctx.font = `500 30px ${SANS}`
    ctx.fillText(row.record, cols.record, y)
    ctx.fillText(row.diff, cols.diff, y)
  })
  if (data.more) {
    ctx.textAlign = 'left'
    ctx.fillStyle = C.brownSoft
    ctx.font = `500 26px ${SANS}`
    ctx.fillText(data.more, cols.name, 350 + MAX_ROWS * step - 10)
  }

  ctx.fillStyle = C.brown
  ctx.fillRect(0, SIZE - 100, SIZE, 100)
  ctx.fillStyle = C.cream
  ctx.textAlign = 'left'
  ctx.font = `700 30px ${SANS}`
  ctx.fillText(data.footer, left, SIZE - 40)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png')
  })
}

/** Shares the image as a file where the browser can (the phone's share sheet), otherwise downloads it. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled'
      // Any other failure: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
