/**
 * The live snapshot: what a player's phone shows, built on the organizer's device from a session and published
 * with `publish_live_stack` (court-booking-system docs/PLATFORM.md §4 "Live stacks"). The database checks only
 * the size, that it is an object and its `v`; the rest is ours. Nothing secret goes in it, and no levels or
 * partner links: the player view doesn't use them.
 */
import { MAX_COURTS, MAX_SCORE, MAX_TITLE, MIN_COURTS } from '../engine'
import type { Format, Game, GameStatus, Play, PlayerStatus, Session } from '../types'

export const SNAPSHOT_VERSION = 1
export const MAX_SNAPSHOT_BYTES = 64 * 1024

export type SnapshotPlayer = { id: string; name: string; status: PlayerStatus }

export type SnapshotGame = {
  id: string
  court: number
  /** Player ids, one a side in singles and two in doubles. */
  teamA: string[]
  teamB: string[]
  status: GameStatus
  scoreA?: number
  scoreB?: number
}

export type LiveSnapshot = {
  v: typeof SNAPSHOT_VERSION
  title: string
  play: Play
  format: Format
  courts: number
  players: SnapshotPlayer[]
  /** Waiting player ids, front of the line first. */
  line: string[]
  /** Every game in the order it went on court. */
  games: SnapshotGame[]
}

const FORMATS: readonly Format[] = [
  'fair',
  'winners-split',
  'americano',
  'round-robin',
  'mexicano',
  'skill-groups',
  'winners-losers',
]
const PLAYS: readonly Play[] = ['singles', 'doubles']
const PLAYER_STATUSES: readonly PlayerStatus[] = ['waiting', 'playing', 'out', 'removed']
const GAME_STATUSES: readonly GameStatus[] = ['playing', 'scored', 'skipped', 'cancelled']

const encoder = new TextEncoder()

/** True when the snapshot's JSON is at most 64 KB of UTF-8 (the server's limit, counted the same way). */
export function snapshotFits(snapshot: LiveSnapshot): boolean {
  return encoder.encode(JSON.stringify(snapshot)).length <= MAX_SNAPSHOT_BYTES
}

function toSnapshotGame(game: Game): SnapshotGame {
  return {
    id: game.id,
    court: game.court,
    teamA: [...game.teamA],
    teamB: [...game.teamB],
    status: game.status,
    ...(game.scoreA !== undefined ? { scoreA: game.scoreA } : {}),
    ...(game.scoreB !== undefined ? { scoreB: game.scoreB } : {}),
  }
}

/** Projects a session onto the snapshot. The session is not changed. */
export function buildSnapshot(session: Session): LiveSnapshot {
  return {
    v: SNAPSHOT_VERSION,
    title: session.title,
    play: session.play,
    format: session.format,
    courts: session.courts,
    players: session.players.map(({ id, name, status }) => ({ id, name, status })),
    line: [...session.line],
    games: session.games.map(toSnapshotGame),
  }
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

/**
 * Checks a snapshot read from the database or from storage. Returns a fresh copy holding only the snapshot's
 * fields, or null for an unknown `v`, a snapshot over 64 KB, or any bad shape. It never guesses.
 */
export function readSnapshot(value: unknown): LiveSnapshot | null {
  if (!isObj(value) || value.v !== SNAPSHOT_VERSION) return null
  if (encoder.encode(JSON.stringify(value)).length > MAX_SNAPSHOT_BYTES) return null

  const { title, play, format, courts, players: rawPlayers, line: rawLine, games: rawGames } = value
  if (!isStr(title) || Array.from(title).length > MAX_TITLE) return null
  if (!oneOf(PLAYS, play) || !oneOf(FORMATS, format)) return null
  if (!isInt(courts, MIN_COURTS, MAX_COURTS)) return null
  if (!Array.isArray(rawPlayers) || !Array.isArray(rawLine) || !Array.isArray(rawGames)) return null

  const players: SnapshotPlayer[] = []
  for (const p of rawPlayers) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !oneOf(PLAYER_STATUSES, p.status)) return null
    players.push({ id: p.id, name: p.name, status: p.status })
  }
  const ids = new Set(players.map((p) => p.id))
  if (ids.size !== players.length) return null

  const line: string[] = []
  for (const id of rawLine) {
    if (!isStr(id) || !ids.has(id)) return null
    line.push(id)
  }
  if (new Set(line).size !== line.length) return null

  const perSide = play === 'singles' ? 1 : 2
  const teamOf = (t: unknown): string[] | null =>
    Array.isArray(t) && t.length === perSide && t.every((id): id is string => isStr(id) && ids.has(id)) ? [...t] : null

  const games: SnapshotGame[] = []
  for (const g of rawGames) {
    if (!isObj(g) || !isStr(g.id) || !isInt(g.court, 1, courts)) return null
    const teamA = teamOf(g.teamA)
    const teamB = teamOf(g.teamB)
    if (!teamA || !teamB || !oneOf(GAME_STATUSES, g.status)) return null
    const { scoreA, scoreB } = g
    if (scoreA !== undefined && !isInt(scoreA, 0, MAX_SCORE)) return null
    if (scoreB !== undefined && !isInt(scoreB, 0, MAX_SCORE)) return null
    games.push({
      id: g.id,
      court: g.court,
      teamA,
      teamB,
      status: g.status,
      ...(scoreA !== undefined ? { scoreA } : {}),
      ...(scoreB !== undefined ? { scoreB } : {}),
    })
  }

  return { v: SNAPSHOT_VERSION, title, play, format, courts, players, line, games }
}
