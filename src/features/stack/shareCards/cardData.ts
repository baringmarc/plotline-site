/**
 * What the share cards show (T8.7, SPEC §6 "T8.7 plan gate"): the player card's stats and the group card's rows,
 * at story 1080×1920 or post 1080×1350. Pure: drawing is in drawCard.ts.
 */
import { paddleStack } from '../../../config/paddleStack'
import { standings } from '../engine'
import type { Game, Session } from '../types'

const { share } = paddleStack

export type CardSize = 'story' | 'post'

export const CARD_SIZES: Record<CardSize, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
}

/** Longest name (in characters) a card prints whole; longer ones end in "…". */
export const MAX_CARD_NAME = 24

export interface PlayerCardData {
  name: string
  place: number
  /** Players in the standings (removed players don't count). */
  of: number
  wins: number
  losses: number
  games: number
  /** "W–L". */
  record: string
  /** Whole percent, or null with no scored games. */
  winRate: number | null
  /** Best win streak (`bestStreak`). */
  streak: number
  /** Point difference: "+7", "−5" or "0". */
  diff: string
  /** The trimmed session title, or '' (the player card then has no title line). */
  title: string
  date: string
  footer: string
}

export interface GroupCardRow {
  place: number
  name: string
  record: string
  diff: string
}

export interface GroupCardData {
  /** The session title, or `share.defaultTitle`. */
  title: string
  date: string
  rows: GroupCardRow[]
  /** Players left off because they didn't fit (0 when all fit). */
  more: number
  footer: string
}

/** Cuts a name to MAX_CARD_NAME characters (code points, so ñ or an emoji is never split). */
function cut(name: string): string {
  const chars = Array.from(name)
  return chars.length <= MAX_CARD_NAME ? name : `${chars.slice(0, MAX_CARD_NAME - 1).join('').trimEnd()}…`
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date)

const won = (g: Game, playerId: string): boolean | null => {
  const inA = (g.teamA as string[]).includes(playerId)
  const inB = (g.teamB as string[]).includes(playerId)
  if (!inA && !inB) return null
  return inA ? g.scoreA! > g.scoreB! : g.scoreB! > g.scoreA!
}

/** The longest run of wins over the player's scored games, in order; skipped, cancelled and live games don't count or break it. */
export function bestStreak(session: Session, playerId: string): number {
  let best = 0
  let run = 0
  for (const g of session.games) {
    if (g.status !== 'scored') continue
    const w = won(g, playerId)
    if (w === null) continue
    run = w ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export function playerCardData(session: Session, playerId: string, opts: { date: Date }): PlayerCardData | null {
  const rows = standings(session)
  const row = rows.find((r) => r.playerId === playerId)
  if (!row) return null
  return {
    name: cut(row.name),
    place: row.place,
    of: rows.length,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    record: `${row.wins}–${row.losses}`,
    winRate: row.games > 0 ? Math.round((row.wins / row.games) * 100) : null,
    streak: bestStreak(session, playerId),
    diff: signed(row.pointsFor - row.pointsAgainst),
    title: session.title.trim(),
    date: formatDate(opts.date),
    footer: share.footer,
  }
}

/** Rows each size holds, with room left for the "+N more" line (see drawCard.ts's group layout). */
const ROWS_FIT: Record<CardSize, number> = { story: 18, post: 11 }

export function groupRowsFit(size: CardSize): number {
  return ROWS_FIT[size]
}

export function groupCardData(session: Session, opts: { date: Date; size: CardSize }): GroupCardData {
  const all = standings(session)
  const fit = groupRowsFit(opts.size)
  // Everyone fits, or the last slot gives way to the "+N more" line.
  const shown = all.length <= fit ? all : all.slice(0, fit - 1)
  return {
    title: session.title.trim() || share.defaultTitle,
    date: formatDate(opts.date),
    rows: shown.map((r) => ({ place: r.place, name: cut(r.name), record: `${r.wins}–${r.losses}`, diff: signed(r.pointsFor - r.pointsAgainst) })),
    more: all.length - shown.length,
    footer: share.footer,
  }
}
