/**
 * Paddle Stack engine: pure functions over a session (SPEC §4 "Paddle Stack rules").
 * Every action returns a new session and never mutates its input. A broken rule throws a
 * `StackError` and changes nothing.
 */
import { roundRobinOrder } from './schedule'
import type { Format, Game, Level, Play, Player, Session, StandingRow, Team } from './types'

export type StackErrorCode =
  | 'bad-format'
  | 'bad-courts'
  | 'bad-combo'
  | 'bad-title'
  | 'bad-level'
  | 'needs-pair'
  | 'tie'
  | 'bad-score'
  | 'not-found'
  | 'not-waiting'
  | 'game-over'
  | 'on-court'
  | 'bad-pair'

export class StackError extends Error {
  readonly code: StackErrorCode
  constructor(code: StackErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'StackError'
    this.code = code
  }
}

export const MIN_COURTS = 1
export const MAX_COURTS = 12
export const MAX_SCORE = 99
export const MAX_TITLE = 60
export const LEVELS: readonly Level[] = [1, 2, 3]
/** Winners stay, split up: a player goes off after this many wins in a row on one court. */
export const WIN_CAP = 2
/** Americano pairs are searched exactly up to this many players a round. */
const EXACT_PAIRING_LIMIT = 24
/** Step limit for the pairing search, so a phone never hangs. */
const SEARCH_STEPS = 200_000

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
/** Version 2's session-wide teams choice (T8.3–T8.8), read only to load old saves. */
const V2_TEAMS = ['open', 'fixed']
const SESSION_VERSION = 3

/** A player to add: a name, or a name with a skill level. */
export type NewPlayer = string | { name: string; level?: Level }

// ---------- helpers ----------

const clone = (s: Session): Session => ({
  title: s.title,
  play: s.play,
  format: s.format,
  courts: s.courts,
  players: s.players.map((p) => ({ ...p })),
  line: [...s.line],
  games: s.games.map((g) => ({ ...g, teamA: [...g.teamA] as Team, teamB: [...g.teamB] as Team })),
})

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

/** Players a court takes: 2 in singles, 4 in doubles. */
const perCourt = (s: Pick<Session, 'play'>) => (s.play === 'singles' ? 2 : 4)

const playerById = (s: Session) => new Map(s.players.map((p) => [p.id, p]))

/** Whether two players are locked to each other. */
const lockedTogether = (s: Session, a: string, b: string) => s.players.find((p) => p.id === a)?.partner === b

/** A team as sides: one locked pair, or its players one by one. */
const teamSides = (s: Session, team: Team): string[][] =>
  team.length === 2 && lockedTogether(s, team[0], team[1]!) ? [[...team]] : team.map((id) => [id])

/**
 * The players in the order they came on: sides alternating between the teams, team A's first (A1, B1, A2, B2;
 * a locked pair is one side, its partners kept together, so partners stay next to each other in the line).
 */
const cameOn = (s: Session, g: Game): string[] => {
  const a = teamSides(s, g.teamA)
  const b = teamSides(s, g.teamB)
  const out: string[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(...a[i])
    if (b[i]) out.push(...b[i])
  }
  return out
}

const inGame = (g: Game) => [...g.teamA, ...g.teamB]

const findPlayer = (s: Session, id: string): Player => {
  const p = s.players.find((x) => x.id === id)
  if (!p || p.status === 'removed') throw new StackError('not-found', `No player ${id}`)
  return p
}

/** The player and, if locked, their partner, in the order they joined the session. */
const unitOf = (s: Session, p: Player): string[] => {
  if (!p.partner) return [p.id]
  const order = (id: string) => s.players.findIndex((x) => x.id === id)
  return [p.id, p.partner].sort((a, b) => order(a) - order(b))
}

const setStatus = (s: Session, ids: string[], status: Player['status']) => {
  for (const p of s.players) if (ids.includes(p.id)) p.status = status
}

const nextPlayerId = (s: Session) => `p${s.players.length + 1}`
const nextGameId = (s: Session) => `g${s.games.length + 1}`

const playingGames = (s: Session) => s.games.filter((g) => g.status === 'playing')

const freeCourts = (s: Session): number[] => {
  const busy = new Set(playingGames(s).map((g) => g.court))
  const out: number[] = []
  for (let c = 1; c <= s.courts; c++) if (!busy.has(c)) out.push(c)
  return out
}

/** Puts two teams on a court and takes their players out of the line. */
const startTeams = (s: Session, court: number, teamA: Team, teamB: Team) => {
  const ids = [...teamA, ...teamB]
  s.games.push({ id: nextGameId(s), court, teamA, teamB, status: 'playing' })
  s.line = s.line.filter((id) => !ids.includes(id))
  setStatus(s, ids, 'playing')
}

/**
 * Teams up the sides taken for a court (front of the line first): singles 1 against 2; two pairs play each other;
 * a pair plays the two solos; four solos play 1 & 3 against 2 & 4. Team A holds the side that came first.
 */
const teamUp = (sides: string[][]): [Team, Team] => {
  if (sides.length === 2) return [sides[0] as Team, sides[1] as Team]
  const pair = sides.find((x) => x.length === 2)
  const solos = sides.filter((x) => x.length === 1).map((x) => x[0])
  if (pair) return sides[0] === pair ? [pair as Team, solos as Team] : [solos as Team, pair as Team]
  const [a, b, c, d] = solos
  return [
    [a, c],
    [b, d],
  ]
}

const toBack = (s: Session, ids: string[]) => {
  s.line = [...s.line.filter((id) => !ids.includes(id)), ...ids]
  setStatus(s, ids, 'waiting')
}

const toFront = (s: Session, ids: string[]) => {
  s.line = [...ids, ...s.line.filter((id) => !ids.includes(id))]
  setStatus(s, ids, 'waiting')
}

const isTurn = (g: Game) => g.status === 'scored' || g.status === 'skipped'

const turnsPlayed = (s: Session): Map<string, number> => {
  const turns = new Map<string, number>()
  for (const g of s.games) if (isTurn(g)) for (const id of inGame(g)) turns.set(id, (turns.get(id) ?? 0) + 1)
  return turns
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Winners still on a court after its last game, with their current run of wins there. */
const winStreaks = (s: Session, court: number): Map<string, number> => {
  let staying = new Map<string, number>()
  for (const g of s.games) {
    if (g.court !== court || g.status === 'playing') continue
    if (g.status !== 'scored') {
      staying = new Map()
      continue
    }
    const winners = (g.scoreA ?? 0) > (g.scoreB ?? 0) ? g.teamA : g.teamB
    const next = new Map<string, number>()
    for (const w of winners) next.set(w, (staying.get(w) ?? 0) + 1)
    staying = [...next.values()].some((n) => n >= WIN_CAP) ? new Map() : next
  }
  return staying
}

const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level)

/** Normalizes a NewPlayer; throws `bad-level` for a level outside 1–3. */
const readNew = (p: NewPlayer): { name: string; level?: Level } => {
  if (typeof p === 'string') return { name: p.trim() }
  const name = typeof p?.name === 'string' ? p.name.trim() : ''
  if (p?.level !== undefined && !isLevel(p.level)) throw new StackError('bad-level', 'Levels are 1–3')
  return p.level === undefined ? { name } : { name, level: p.level }
}

const takenNames = (s: Session) => new Set(s.players.filter((p) => p.status !== 'removed').map((p) => nameKey(p.name)))

const pushPlayer = (s: Session, entry: { name: string; level?: Level }): string => {
  const id = nextPlayerId(s)
  s.players.push({ id, name: entry.name, status: 'waiting', ...(entry.level !== undefined ? { level: entry.level } : {}) })
  s.line.push(id)
  return id
}

/** Combinations that aren't offered (SPEC §4 "Combinations"). */
const comboOk = (format: Format, play: Play) => !(play === 'singles' && format === 'winners-split')

/** Whether players can be locked as pairs: doubles, and not the formats that rotate partners (SPEC §4 "Pair locks"). */
export const locksOffered = (play: Play, format: Format): boolean =>
  play === 'doubles' && format !== 'americano' && format !== 'mexicano'

/** A Round Robin started with pairs: all its players are paired (SPEC §4 "Combinations"). */
const pairedRoundRobin = (s: Session) => s.format === 'round-robin' && s.players.some((p) => p.partner !== undefined)

/** Round formats start a new round only when no game is on any court; the others fill courts as they free up. */
export const isRoundFormat = (format: Format): boolean => format === 'americano' || format === 'mexicano'

// ---------- session ----------

export function createSession(opts: {
  format: Format
  courts: number
  title?: string
  play?: Play
  names?: NewPlayer[]
  pairs?: [NewPlayer, NewPlayer][]
  /** Names from `names` to lock as pairs, each standing at its further-back partner's spot (the start screen). */
  locks?: [string, string][]
}): Session {
  const play = opts.play ?? 'doubles'
  if (!FORMATS.includes(opts.format)) throw new StackError('bad-format', `Unknown format ${String(opts.format)}`)
  if (!PLAYS.includes(play)) throw new StackError('bad-combo', 'Unknown play')
  if (!comboOk(opts.format, play)) throw new StackError('bad-combo', `${opts.format} isn't offered in ${play}`)
  if (!Number.isInteger(opts.courts) || opts.courts < MIN_COURTS || opts.courts > MAX_COURTS) {
    throw new StackError('bad-courts', `Courts must be ${MIN_COURTS}–${MAX_COURTS}`)
  }
  const title = (opts.title ?? '').trim()
  if (Array.from(title).length > MAX_TITLE) throw new StackError('bad-title', `Titles are at most ${MAX_TITLE} characters`)
  const pairs = opts.pairs ?? []
  const names = opts.names ?? []
  if (pairs.length && !locksOffered(play, opts.format)) throw new StackError('bad-combo', `No pairs in ${opts.format} ${play}`)
  const locks = opts.locks ?? []
  if (locks.length && !locksOffered(play, opts.format)) throw new StackError('bad-combo', `No pairs in ${opts.format} ${play}`)
  const empty: Session = { title, play, format: opts.format, courts: opts.courts, players: [], line: [], games: [] }
  const s = pushPairs(pushPlayers(empty, names), pairs)
  for (const [a, b] of locks) {
    const ids = [a, b].map((n) => s.players.find((p) => nameKey(p.name) === nameKey(n))?.id)
    if (!ids[0] || !ids[1]) throw new StackError('not-found', `No player ${!ids[0] ? a : b}`)
    lockAt(s, findPlayer(s, ids[0]), findPlayer(s, ids[1]))
  }
  if (opts.format === 'round-robin' && s.players.some((p) => p.partner !== undefined) && s.players.some((p) => p.partner === undefined)) {
    throw new StackError('needs-pair', 'Round Robin is all pairs or no pairs')
  }
  return s
}

/** Adds players to the back of the line. An all-pairs Round Robin takes pairs only (`needs-pair`). */
export function addPlayers(session: Session, names: NewPlayer[]): Session {
  if (pairedRoundRobin(session)) throw new StackError('needs-pair', 'This Round Robin is played in pairs')
  return pushPlayers(session, names)
}

function pushPlayers(session: Session, names: NewPlayer[]): Session {
  const entries = names.map(readNew)
  const s = clone(session)
  const taken = takenNames(s)
  for (const entry of entries) {
    const key = nameKey(entry.name)
    if (!entry.name || taken.has(key)) continue
    taken.add(key)
    pushPlayer(s, entry)
  }
  return s
}

/**
 * Adds locked pairs to the back of the line, partners together. A pair with a bad name is skipped whole. Refused
 * (`bad-combo`) where locks aren't offered and in a Round Robin started without pairs.
 */
export function addPairs(session: Session, pairs: [NewPlayer, NewPlayer][]): Session {
  if (!locksOffered(session.play, session.format)) throw new StackError('bad-combo', 'No pairs in this format')
  if (session.format === 'round-robin' && session.players.length > 0 && !pairedRoundRobin(session)) {
    throw new StackError('bad-combo', 'This Round Robin is played without pairs')
  }
  return pushPairs(session, pairs)
}

function pushPairs(session: Session, pairs: [NewPlayer, NewPlayer][]): Session {
  const entries = pairs.map(([a, b]) => [readNew(a), readNew(b)] as const)
  const s = clone(session)
  const taken = takenNames(s)
  for (const [a, b] of entries) {
    const ka = nameKey(a.name)
    const kb = nameKey(b.name)
    if (!a.name || !b.name || ka === kb || taken.has(ka) || taken.has(kb)) continue
    taken.add(ka)
    taken.add(kb)
    const ia = pushPlayer(s, a)
    const ib = pushPlayer(s, b)
    s.players[s.players.length - 2].partner = ib
    s.players[s.players.length - 1].partner = ia
  }
  return s
}

/**
 * Locks two players as a pair (SPEC §4 "Pair locks"). Both must be off court; the pair stands at the spot of
 * whichever partner was further back, and if either is on a time out, both are.
 */
export function lockPair(session: Session, aId: string, bId: string): Session {
  if (!locksOffered(session.play, session.format) || session.format === 'round-robin') {
    throw new StackError('bad-combo', 'Pairs can’t be locked in this format')
  }
  const s = clone(session)
  const a = findPlayer(s, aId)
  const b = findPlayer(s, bId)
  if (a.id === b.id || a.partner !== undefined || b.partner !== undefined) throw new StackError('bad-pair', 'Pick two players not in a pair')
  if (a.status === 'playing' || b.status === 'playing') throw new StackError('on-court', 'Both players must be off court')
  lockAt(s, a, b)
  return s
}

/** Locks two players off court (in place): the pair stands at the further-back partner's spot, or rests if either is out. */
function lockAt(s: Session, a: Player, b: Player) {
  if (a.id === b.id || a.partner !== undefined || b.partner !== undefined) throw new StackError('bad-pair', 'Pick two players not in a pair')
  a.partner = b.id
  b.partner = a.id
  const unit = unitOf(s, a)
  if (a.status === 'waiting' && b.status === 'waiting') {
    const spot = Math.max(s.line.indexOf(a.id), s.line.indexOf(b.id))
    s.line = [...s.line.slice(0, spot + 1).filter((id) => !unit.includes(id)), ...unit, ...s.line.slice(spot + 1)]
  } else {
    setStatus(s, unit, 'out')
    s.line = s.line.filter((id) => !unit.includes(id))
  }
}

/** Unlocks a pair (either partner's id). Both stay where they are. Round Robin keeps its pairs (`bad-combo`). */
export function unlockPair(session: Session, playerId: string): Session {
  if (session.format === 'round-robin') throw new StackError('bad-combo', 'Round Robin keeps its pairs')
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (p.partner === undefined) throw new StackError('bad-pair', `${p.name} is not in a pair`)
  const partner = s.players.find((x) => x.id === p.partner)
  delete p.partner
  if (partner) delete partner.partner
  return s
}

/** Sets a player's skill level (1–3), or clears it with null. */
export function setLevel(session: Session, playerId: string, level: Level | null): Session {
  if (level !== null && !isLevel(level)) throw new StackError('bad-level', 'Levels are 1–3')
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (level === null) delete p.level
  else p.level = level
  return s
}

export function timeOut(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (p.status !== 'waiting') throw new StackError('not-waiting', `${p.name} is not in the line`)
  const unit = unitOf(s, p)
  setStatus(s, unit, 'out')
  s.line = s.line.filter((id) => !unit.includes(id))
  return s
}

export function backInLine(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (p.status !== 'out') throw new StackError('not-waiting', `${p.name} is not on a time out`)
  toBack(s, unitOf(s, p))
  return s
}

export function removePlayer(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  const unit = unitOf(s, p)
  const game = playingGames(s).find((g) => inGame(g).includes(playerId))
  if (game) {
    game.status = 'cancelled'
    toFront(
      s,
      cameOn(s, game).filter((id) => !unit.includes(id)),
    )
  }
  s.line = s.line.filter((id) => !unit.includes(id))
  setStatus(s, unit, 'removed')
  return s
}

// ---------- courts ----------

export function fillCourts(session: Session): Session {
  const s = clone(session)
  if (s.format === 'americano') {
    startAmericanoRound(s)
    return s
  }
  if (s.format === 'mexicano') {
    startMexicanoRound(s)
    return s
  }
  const n = perCourt(s)
  for (const court of freeCourts(s)) {
    if (s.line.length < n) break
    if (s.format === 'round-robin') {
      if (!startRoundRobin(s, court)) break
      continue
    }
    const sides = lineSides(s)
    const picked =
      s.format === 'skill-groups'
        ? (pickSides(sides, n, sideLevel(s)) ?? pickSides(sides, n))
        : s.format === 'winners-losers'
          ? (pickSides(sides, n, sidePool(s)) ?? pickSides(sides, n))
          : pickSides(sides, n)
    if (!picked) break
    startTeams(s, court, ...teamUp(picked))
  }
  return s
}

const findPlaying = (s: Session, gameId: string): Game => {
  const g = s.games.find((x) => x.id === gameId)
  if (!g) throw new StackError('not-found', `No game ${gameId}`)
  if (g.status !== 'playing') throw new StackError('game-over', `Game ${gameId} has ended`)
  return g
}

const validScore = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE

export function recordScore(session: Session, gameId: string, scoreA: number, scoreB: number): Session {
  const s = clone(session)
  const g = findPlaying(s, gameId)
  if (!validScore(scoreA) || !validScore(scoreB)) throw new StackError('bad-score', `Scores are whole numbers 0–${MAX_SCORE}`)
  if (scoreA === scoreB) throw new StackError('tie', 'A game cannot end in a tie')
  g.status = 'scored'
  g.scoreA = scoreA
  g.scoreB = scoreB
  afterGame(s, g)
  return s
}

export function skipGame(session: Session, gameId: string): Session {
  const s = clone(session)
  const g = findPlaying(s, gameId)
  g.status = 'skipped'
  afterGame(s, g)
  return s
}

/** Sends a finished game's players where its format says. */
function afterGame(s: Session, g: Game) {
  const order = cameOn(s, g)
  if (s.format !== 'winners-split' || g.status !== 'scored') {
    toBack(s, order)
    return
  }
  const aWon = (g.scoreA ?? 0) > (g.scoreB ?? 0)
  const winners = order.filter((id) => (aWon ? g.teamA : g.teamB).includes(id))
  const losers = order.filter((id) => !winners.includes(id))
  toBack(s, losers)
  const streaks = winStreaks(s, g.court)
  if (!winners.every((w) => streaks.has(w))) {
    // Someone reached the cap: all four go off, losers first.
    toBack(s, winners)
    return
  }
  // A winning pair stays together against the next team from the line. Winning solos split, winner 1 + next 1
  // against winner 2 + next 2, unless a pair is at the front of the line: it plays the winners as they stand.
  const next = pickSides(lineSides(s), 2)
  if (!next) {
    toBack(s, winners)
    return
  }
  const winningPair = teamSides(s, aWon ? g.teamA : g.teamB).length === 1
  const sides: [Team, Team] =
    winningPair || next.length === 1
      ? [winners as Team, next.flat() as Team]
      : [
          [winners[0], next[0][0]],
          [winners[1], next[1][0]],
        ]
  startTeams(s, g.court, ...sides)
}

// ---------- Americano ----------

/** Who plays in a round (Americano, Mexicano): fewest turns played first, then line order; [] when no round can start. */
function roundPlayers(s: Session): string[] {
  if (playingGames(s).length > 0) return []
  const n = perCourt(s)
  const courtsInUse = Math.min(s.courts, Math.floor(s.line.length / n))
  if (courtsInUse === 0) return []
  const turns = turnsPlayed(s)
  const order = new Map(s.line.map((id, i) => [id, i]))
  return [...s.line]
    .sort((a, b) => (turns.get(a) ?? 0) - (turns.get(b) ?? 0) || order.get(a)! - order.get(b)!)
    .slice(0, courtsInUse * n)
}

function startAmericanoRound(s: Session) {
  const chosen = roundPlayers(s)
  if (chosen.length === 0) return

  const partnered = new Map<string, number>()
  const opposed = new Map<string, number>()
  for (const g of s.games) {
    if (!isTurn(g)) continue
    for (const team of [g.teamA, g.teamB]) {
      if (team.length !== 2) continue
      const k = pairKey(team[0], team[1]!)
      partnered.set(k, (partnered.get(k) ?? 0) + 1)
    }
    for (const a of g.teamA)
      for (const b of g.teamB) {
        const k = pairKey(a, b)
        opposed.set(k, (opposed.get(k) ?? 0) + 1)
      }
  }
  const courts = freeCourts(s)

  if (s.play === 'singles') {
    // No partners: pair the round's players as opponents, avoiding repeat opponents.
    const matches = pairPartners(chosen, (a, b) => opposed.get(pairKey(a, b)) ?? 0)
    matches.forEach(([a, b], c) => {
      s.games.push({ id: nextGameId(s), court: courts[c], teamA: [a], teamB: [b], status: 'playing' })
      setStatus(s, [a, b], 'playing')
    })
    s.line = s.line.filter((id) => !chosen.includes(id))
    return
  }

  const teams = pairPartners(chosen, (a, b) => partnered.get(pairKey(a, b)) ?? 0)
  const oppCost = (t: Team, u: Team) =>
    t.reduce((sum, a) => sum + u.reduce((acc, b) => acc + (opposed.get(pairKey(a, b)) ?? 0), 0), 0)

  // Match teams on courts, keeping repeat opponents low (greedy).
  const left: Team[] = [...teams]
  let c = 0
  while (left.length >= 2) {
    const t = left.shift()!
    let best = 0
    for (let i = 1; i < left.length; i++) if (oppCost(t, left[i]) < oppCost(t, left[best])) best = i
    const [u] = left.splice(best, 1)
    const game: Game = { id: nextGameId(s), court: courts[c++], teamA: t, teamB: u, status: 'playing' }
    s.games.push(game)
    setStatus(s, [...t, ...u], 'playing')
  }
  s.line = s.line.filter((id) => !chosen.includes(id))
}

/**
 * Pairs players to minimise the total repeat count (zero whenever a pairing without repeats exists).
 * Exact branch-and-bound up to EXACT_PAIRING_LIMIT players, greedy above.
 */
export function pairPartners(players: string[], cost: (a: string, b: string) => number): [string, string][] {
  const n = players.length
  const greedy = (): [string, string][] => {
    const left = [...players]
    const out: [string, string][] = []
    while (left.length >= 2) {
      const a = left.shift()!
      let best = 0
      for (let i = 1; i < left.length; i++) if (cost(a, left[i]) < cost(a, left[best])) best = i
      out.push([a, left.splice(best, 1)[0]])
    }
    return out
  }
  if (n > EXACT_PAIRING_LIMIT) return greedy()

  const c: number[][] = players.map((a) => players.map((b) => (a === b ? 0 : cost(a, b))))
  let bestPairs = greedy()
  const idx = new Map(players.map((p, i) => [p, i]))
  let bestCost = bestPairs.reduce((sum, [a, b]) => sum + c[idx.get(a)!][idx.get(b)!], 0)
  if (bestCost === 0) return bestPairs

  const used = new Array<boolean>(n).fill(false)
  const current: [number, number][] = []
  let steps = 0
  const search = (acc: number) => {
    if (bestCost === 0 || steps++ > SEARCH_STEPS) return
    let i = 0
    while (i < n && used[i]) i++
    if (i >= n) {
      if (acc < bestCost) {
        bestCost = acc
        bestPairs = current.map(([x, y]) => [players[x], players[y]])
      }
      return
    }
    used[i] = true
    const options: number[] = []
    for (let j = i + 1; j < n; j++) if (!used[j]) options.push(j)
    options.sort((x, y) => c[i][x] - c[i][y] || x - y)
    for (const j of options) {
      if (acc + c[i][j] >= bestCost) continue
      used[j] = true
      current.push([i, j])
      search(acc + c[i][j])
      current.pop()
      used[j] = false
    }
    used[i] = false
  }
  search(0)
  return bestPairs
}

// ---------- Mexicano ----------

/** Mexicano: the round's players ordered by level (first round) or standings, 1 & 4 against 2 & 3 (singles 1 against 2). */
function startMexicanoRound(s: Session) {
  const chosen = roundPlayers(s)
  if (chosen.length === 0) return
  const lineOrder = new Map(s.line.map((id, i) => [id, i]))
  const byLine = (a: string, b: string) => lineOrder.get(a)! - lineOrder.get(b)!
  let rank: (id: string) => number
  if (s.games.some((g) => g.status === 'scored')) {
    const place = new Map(standings(s).map((r) => [r.playerId, r.place]))
    rank = (id) => place.get(id) ?? Number.MAX_SAFE_INTEGER
  } else {
    const level = new Map(s.players.map((p) => [p.id, p.level ?? 2]))
    rank = (id) => -(level.get(id) ?? 2)
  }
  const ordered = [...chosen].sort((a, b) => rank(a) - rank(b) || byLine(a, b))
  const courts = freeCourts(s)
  const n = perCourt(s)
  for (let k = 0; k * n < ordered.length; k++) {
    const [a, b, c, d] = ordered.slice(k * n, k * n + n)
    if (n === 2) startTeams(s, courts[k], [a], [b])
    else startTeams(s, courts[k], [a, d], [b, c])
  }
}

// ---------- Round Robin ----------

/** Sides waiting or playing, in the order they joined: a player, or a locked pair (partners in the order they joined). */
function presentSides(s: Session): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const p of s.players) {
    if (seen.has(p.id) || (p.status !== 'waiting' && p.status !== 'playing')) continue
    const side = unitOf(s, p)
    for (const id of side) seen.add(id)
    out.push(side)
  }
  return out
}

/**
 * Round Robin: puts the next scheduled pairing on a court (SPEC §4 "Round Robin"). Returns false when no
 * pairing of the current cycle is waiting, so the court stays free.
 */
function startRoundRobin(s: Session, court: number): boolean {
  const doublesOpen = s.play === 'doubles' && !pairedRoundRobin(s)
  // Pairings: matches between sides (singles, all pairs) or partnerships between players (doubles without pairs).
  const pairings = roundRobinOrder(presentSides(s)).map(([x, y]) => [...x, ...y])
  if (pairings.length === 0) return false
  const key = (ids: string[]) => [...ids].sort().join('|')
  const counts = new Map<string, number>()
  for (const g of s.games) {
    if (!isTurn(g)) continue
    const keys = doublesOpen ? [key(g.teamA), key(g.teamB)] : [key(inGame(g))]
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const count = (p: string[]) => counts.get(key(p)) ?? 0
  const lowest = Math.min(...pairings.map(count))
  const waiting = (p: string[]) => p.every((id) => s.players.find((x) => x.id === id)?.status === 'waiting')
  const first = pairings.find((p) => count(p) === lowest && waiting(p))
  if (!first) return false
  if (!doublesOpen) {
    const half = first.length / 2
    startTeams(s, court, first.slice(0, half) as Team, first.slice(half) as Team)
    return true
  }
  let second: string[] | undefined
  for (const p of pairings) {
    if (p.some((id) => first.includes(id)) || !waiting(p)) continue
    if (!second || count(p) < count(second)) second = p
  }
  if (!second) return false
  startTeams(s, court, first as Team, second as Team)
  return true
}

// ---------- Skill groups, Winners vs Losers ----------

type SideKey = (side: string[]) => number | string | undefined

/** The line as sides, front first: one player, or a locked pair (partners stand next to each other). */
function lineSides(s: Session): string[][] {
  const byId = playerById(s)
  const out: string[][] = []
  const seen = new Set<string>()
  for (const id of s.line) {
    if (seen.has(id)) continue
    const p = byId.get(id)!
    const side = p.partner !== undefined && s.line.includes(p.partner) ? unitOf(s, p) : [id]
    for (const x of side) seen.add(x)
    out.push(side)
  }
  return out
}

/** Whether `need` places can be filled exactly from this many solos and pairs. */
const canFill = (need: number, solos: number, pairs: number) => need - 2 * Math.min(pairs, Math.floor(need / 2)) <= solos

/**
 * Takes sides for a court of `n` from the front of the line while they fit (SPEC §4 "Sides"): a side that would
 * overflow, or after which the court could no longer be filled exactly, is skipped and keeps its place. With a key
 * (Skill groups, Winners vs Losers), it takes sides with the group's key or none; the group's key is the first
 * taken. Null when the court can't be filled.
 */
function pickSides(sides: string[][], n: number, keyOf?: SideKey): string[][] | null {
  const solosAfter = new Array<number>(sides.length + 1).fill(0)
  const pairsAfter = new Array<number>(sides.length + 1).fill(0)
  for (let i = sides.length - 1; i >= 0; i--) {
    solosAfter[i] = solosAfter[i + 1] + (sides[i].length === 1 ? 1 : 0)
    pairsAfter[i] = pairsAfter[i + 1] + (sides[i].length === 2 ? 1 : 0)
  }
  const taken: string[][] = []
  let size = 0
  let group: number | string | undefined
  for (let i = 0; i < sides.length && size < n; i++) {
    const side = sides[i]
    const k = keyOf?.(side)
    if (k !== undefined && group !== undefined && k !== group) continue
    if (size + side.length > n) continue
    if (!canFill(n - size - side.length, solosAfter[i + 1], pairsAfter[i + 1])) continue
    taken.push(side)
    size += side.length
    if (group === undefined) group = k
  }
  return size === n ? taken : null
}

/** A side's level: the higher of its players' levels, none if none has one. */
const sideLevel =
  (s: Session): SideKey =>
  (side) => {
    const levels = side.map((id) => s.players.find((p) => p.id === id)?.level).filter((l): l is Level => l !== undefined)
    return levels.length ? Math.max(...levels) : undefined
  }

/** A side's pool: the result of its last scored game, none before its first. */
const sidePool = (s: Session): SideKey => {
  const pool = new Map<string, 'winners' | 'losers'>()
  for (const g of s.games) {
    if (g.status !== 'scored') continue
    const aWon = (g.scoreA ?? 0) > (g.scoreB ?? 0)
    for (const id of g.teamA) pool.set(id, aWon ? 'winners' : 'losers')
    for (const id of g.teamB) pool.set(id, aWon ? 'losers' : 'winners')
  }
  // A pair whose partners' pools differ fits either pool.
  return (side) => {
    const pools = new Set(side.map((id) => pool.get(id)))
    return pools.size === 1 ? [...pools][0] : undefined
  }
}

// ---------- standings ----------

export function standings(session: Session): StandingRow[] {
  const rows = new Map<string, StandingRow>()
  const join = new Map<string, number>()
  session.players.forEach((p, i) => {
    if (p.status === 'removed') return
    join.set(p.id, i)
    rows.set(p.id, { playerId: p.id, name: p.name, place: 0, wins: 0, losses: 0, games: 0, pointsFor: 0, pointsAgainst: 0 })
  })
  for (const g of session.games) {
    if (g.status !== 'scored') continue
    const a = g.scoreA ?? 0
    const b = g.scoreB ?? 0
    for (const [team, pf, pa] of [
      [g.teamA, a, b],
      [g.teamB, b, a],
    ] as const) {
      for (const id of team) {
        const r = rows.get(id)
        if (!r) continue
        r.games++
        r.pointsFor += pf
        r.pointsAgainst += pa
        if (pf > pa) r.wins++
        else r.losses++
      }
    }
  }
  const rate = (r: StandingRow) => (r.games ? r.wins / r.games : 0)
  const cmp = (x: StandingRow, y: StandingRow) =>
    y.wins - x.wins ||
    rate(y) - rate(x) ||
    y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst) ||
    y.pointsFor - x.pointsFor
  const list = [...rows.values()].sort((x, y) => cmp(x, y) || join.get(x.playerId)! - join.get(y.playerId)!)
  list.forEach((r, i) => {
    r.place = i > 0 && cmp(list[i - 1], r) === 0 ? list[i - 1].place : i + 1
  })
  return list
}

// ---------- saving ----------

export function serialize(session: Session): string {
  return JSON.stringify({ version: SESSION_VERSION, session })
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const PLAYER_STATUSES = ['waiting', 'playing', 'out', 'removed']
const GAME_STATUSES = ['playing', 'scored', 'skipped', 'cancelled']

/** Whether a saved session's players carry partner links. */
const hasPartner = (session: Record<string, unknown>) =>
  Array.isArray(session.players) && session.players.some((p) => isObj(p) && 'partner' in p)

/**
 * Loads a saved session (SPEC §4 "Saving"). Version 2 (T8.3–T8.8) loads its fixed pairs as locked pairs and an open
 * queue as no locks; version 1 (before T8.3) loads as doubles with no locks and no title. Anything malformed, with an
 * unknown version, or that the engine could never make, gives null.
 */
export function deserialize(json: string): Session | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!isObj(data) || !isObj(data.session)) return null
  let s: Record<string, unknown>
  /** Version 2 with fixed pairs: every player is paired and every team is a pair. */
  let v2Fixed = false
  if (data.version === 1) {
    if ('title' in data.session || 'play' in data.session || 'teams' in data.session || hasPartner(data.session)) return null
    s = { ...data.session, title: '', play: 'doubles' }
  } else if (data.version === 2) {
    const { teams, ...rest } = data.session
    if (!V2_TEAMS.includes(teams as string)) return null
    v2Fixed = teams === 'fixed'
    if (v2Fixed && (rest.play !== 'doubles' || rest.format === 'americano' || rest.format === 'mexicano')) return null
    if (!v2Fixed && hasPartner(rest)) return null
    s = rest
  } else if (data.version === SESSION_VERSION) {
    if ('teams' in data.session) return null
    s = data.session
  } else return null

  if (!FORMATS.includes(s.format as Format) || !PLAYS.includes(s.play as Play)) return null
  if (!comboOk(s.format as Format, s.play as Play)) return null
  if (!isStr(s.title) || s.title !== s.title.trim() || Array.from(s.title).length > MAX_TITLE) return null
  if (!Number.isInteger(s.courts) || (s.courts as number) < MIN_COURTS || (s.courts as number) > MAX_COURTS) return null
  if (!Array.isArray(s.players) || !Array.isArray(s.line) || !Array.isArray(s.games)) return null
  const courts = s.courts as number
  const perSide = s.play === 'singles' ? 1 : 2

  const playersOk = s.players.every(
    (p) =>
      isObj(p) &&
      isStr(p.id) &&
      isStr(p.name) &&
      PLAYER_STATUSES.includes(p.status as string) &&
      (p.level === undefined || isLevel(p.level)) &&
      (p.partner === undefined || isStr(p.partner)) &&
      (!v2Fixed || isStr(p.partner)),
  )
  if (!playersOk) return null
  const players = s.players as Player[]
  const byId = new Map(players.map((p) => [p.id, p]))
  if (byId.size !== players.length) return null
  // Partners: each other's, sharing a status, only where locks are offered; Round Robin is all pairs or none.
  const paired = players.filter((p) => p.partner !== undefined)
  for (const p of paired) {
    const partner = byId.get(p.partner!)
    if (!partner || partner.id === p.id || partner.partner !== p.id || partner.status !== p.status) return null
  }
  if (paired.length && !locksOffered(s.play as Play, s.format as Format)) return null
  if (s.format === 'round-robin' && paired.length && paired.length !== players.length) return null

  const line = s.line as unknown[]
  const lineOk = line.every((id) => isStr(id) && byId.has(id)) && new Set(line).size === line.length
  if (!lineOk) return null
  // Partners stand next to each other in the line.
  for (let i = 0; i < line.length; i++) {
    const partner = byId.get(line[i] as string)!.partner
    if (partner !== undefined && line[i - 1] !== partner && line[i + 1] !== partner) return null
  }

  const isTeam = (v: unknown): v is Team =>
    Array.isArray(v) &&
    v.length === perSide &&
    v.every((id) => isStr(id) && byId.has(id)) &&
    (!v2Fixed || byId.get(v[0] as string)!.partner === v[1])
  const scoresOk = (g: Record<string, unknown>) =>
    g.status === 'scored'
      ? typeof g.scoreA === 'number' && typeof g.scoreB === 'number' && validScore(g.scoreA) && validScore(g.scoreB) && g.scoreA !== g.scoreB
      : g.scoreA === undefined && g.scoreB === undefined
  // A pair on court plays as one team: locks are made off court.
  const pairsTogether = (g: Record<string, unknown>) =>
    g.status !== 'playing' ||
    [g.teamA as string[], g.teamB as string[]].every((team) =>
      team.every((id) => {
        const partner = byId.get(id)!.partner
        return partner === undefined || team.includes(partner)
      }),
    )
  const gamesOk = s.games.every(
    (g) =>
      isObj(g) &&
      isStr(g.id) &&
      Number.isInteger(g.court) &&
      (g.court as number) >= 1 &&
      (g.court as number) <= courts &&
      isTeam(g.teamA) &&
      isTeam(g.teamB) &&
      new Set([...g.teamA, ...g.teamB]).size === perSide * 2 &&
      GAME_STATUSES.includes(g.status as string) &&
      scoresOk(g) &&
      pairsTogether(g),
  )
  if (!gamesOk) return null
  if (new Set((s.games as Game[]).map((g) => g.id)).size !== s.games.length) return null
  return clone(s as unknown as Session)
}
