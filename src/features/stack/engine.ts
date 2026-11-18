/**
 * Paddle Stack engine: pure functions over a session (SPEC §4 "Paddle Stack rules").
 * Every action returns a new session and never mutates its input. A broken rule throws a
 * `StackError` and changes nothing.
 */
import type { Format, Game, Level, Play, Player, Session, StandingRow, Team, Teams } from './types'

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

const FORMATS: readonly Format[] = ['fair', 'winners-split', 'americano']
const PLAYS: readonly Play[] = ['singles', 'doubles']
const TEAMS: readonly Teams[] = ['open', 'fixed']
const SESSION_VERSION = 2

/** A player to add: a name, or a name with a skill level. */
export type NewPlayer = string | { name: string; level?: Level }

// ---------- helpers ----------

const clone = (s: Session): Session => ({
  title: s.title,
  play: s.play,
  teams: s.teams,
  format: s.format,
  courts: s.courts,
  players: s.players.map((p) => ({ ...p })),
  line: [...s.line],
  games: s.games.map((g) => ({ ...g, teamA: [...g.teamA] as Team, teamB: [...g.teamB] as Team })),
})

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

/** Players a court takes: 2 in singles, 4 in doubles. */
const perCourt = (s: Pick<Session, 'play'>) => (s.play === 'singles' ? 2 : 4)

/**
 * The players in the order they came on: A1, B1, A2, B2 in an open queue (A1, B1 in singles); pair by pair
 * (A1, A2, B1, B2) with fixed pairs, so partners stay next to each other in the line.
 */
const cameOn = (s: Session, g: Game): string[] => {
  if (s.teams === 'fixed') return [...g.teamA, ...g.teamB]
  const out: string[] = []
  for (let i = 0; i < Math.max(g.teamA.length, g.teamB.length); i++) {
    if (g.teamA[i] !== undefined) out.push(g.teamA[i])
    if (g.teamB[i] !== undefined) out.push(g.teamB[i])
  }
  return out
}

const inGame = (g: Game) => [...g.teamA, ...g.teamB]

const findPlayer = (s: Session, id: string): Player => {
  const p = s.players.find((x) => x.id === id)
  if (!p || p.status === 'removed') throw new StackError('not-found', `No player ${id}`)
  return p
}

/** The player and, with fixed pairs, their partner, in the order they were entered. */
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

/**
 * Puts players from the front of the line on a court. Singles: 1 against 2. Doubles, open queue: positions
 * 1 & 3 against 2 & 4. Fixed pairs: the first pair against the second.
 */
const startGame = (s: Session, court: number, group: string[]) => {
  const [a, b, c, d] = group
  const sides: [Team, Team] =
    s.play === 'singles' ? [[a], [b]] : s.teams === 'fixed' ? [[a, b], [c, d]] : [[a, c], [b, d]]
  const game: Game = { id: nextGameId(s), court, teamA: sides[0], teamB: sides[1], status: 'playing' }
  s.games.push(game)
  s.line = s.line.filter((id) => !group.includes(id))
  setStatus(s, group, 'playing')
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
const comboOk = (format: Format, play: Play, teams: Teams) =>
  !(play === 'singles' && (format === 'winners-split' || teams === 'fixed')) && !(format === 'americano' && teams === 'fixed')

// ---------- session ----------

export function createSession(opts: {
  format: Format
  courts: number
  title?: string
  play?: Play
  teams?: Teams
  names?: NewPlayer[]
  pairs?: [NewPlayer, NewPlayer][]
}): Session {
  const play = opts.play ?? 'doubles'
  const teams = opts.teams ?? 'open'
  if (!FORMATS.includes(opts.format)) throw new StackError('bad-format', `Unknown format ${String(opts.format)}`)
  if (!PLAYS.includes(play) || !TEAMS.includes(teams)) throw new StackError('bad-combo', 'Unknown play or teams')
  if (!comboOk(opts.format, play, teams)) throw new StackError('bad-combo', `${opts.format} isn't offered with ${play} and ${teams}`)
  if (!Number.isInteger(opts.courts) || opts.courts < MIN_COURTS || opts.courts > MAX_COURTS) {
    throw new StackError('bad-courts', `Courts must be ${MIN_COURTS}–${MAX_COURTS}`)
  }
  const title = (opts.title ?? '').trim()
  if (Array.from(title).length > MAX_TITLE) throw new StackError('bad-title', `Titles are at most ${MAX_TITLE} characters`)
  const empty: Session = { title, play, teams, format: opts.format, courts: opts.courts, players: [], line: [], games: [] }
  if (teams === 'fixed') {
    if (opts.names?.length) throw new StackError('needs-pair', 'Fixed pairs are entered as pairs')
    return addPairs(empty, opts.pairs ?? [])
  }
  if (opts.pairs?.length) throw new StackError('bad-combo', 'Pairs need fixed pairs')
  return addPlayers(empty, opts.names ?? [])
}

export function addPlayers(session: Session, names: NewPlayer[]): Session {
  if (session.teams === 'fixed') throw new StackError('needs-pair', 'Fixed pairs are added as pairs')
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

/** Fixed pairs: adds each pair to the back of the line, partners together. A pair with a bad name is skipped whole. */
export function addPairs(session: Session, pairs: [NewPlayer, NewPlayer][]): Session {
  if (session.teams !== 'fixed') throw new StackError('bad-combo', 'Pairs need fixed pairs')
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
  const n = perCourt(s)
  for (const court of freeCourts(s)) {
    if (s.line.length < n) break
    startGame(s, court, s.line.slice(0, n))
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
  const [n1, n2] = s.line
  // Fixed pairs: the winning pair stays together against the next pair. Open queue: winners split,
  // winner 1 + next 1 against winner 2 + next 2.
  const sides: [Team, Team] =
    s.teams === 'fixed'
      ? [[winners[0], winners[1]], [n1, n2]]
      : [[winners[0], n1], [winners[1], n2]]
  s.games.push({ id: nextGameId(s), court: g.court, teamA: sides[0], teamB: sides[1], status: 'playing' })
  s.line = s.line.filter((id) => id !== n1 && id !== n2)
  setStatus(s, [n1, n2], 'playing')
}

// ---------- Americano ----------

function startAmericanoRound(s: Session) {
  if (playingGames(s).length > 0) return
  const n = perCourt(s)
  const courtsInUse = Math.min(s.courts, Math.floor(s.line.length / n))
  if (courtsInUse === 0) return
  const turns = turnsPlayed(s)
  const order = new Map(s.line.map((id, i) => [id, i]))
  const chosen = [...s.line]
    .sort((a, b) => (turns.get(a) ?? 0) - (turns.get(b) ?? 0) || order.get(a)! - order.get(b)!)
    .slice(0, courtsInUse * n)

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

/**
 * Loads a saved session. Version 1 (before T8.3) loads as doubles with an open queue and no title. Anything
 * malformed, with an unknown version, or that the engine could never make, gives null.
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
  if (data.version === 1) {
    if ('title' in data.session || 'play' in data.session || 'teams' in data.session) return null
    s = { ...data.session, title: '', play: 'doubles', teams: 'open' }
  } else if (data.version === SESSION_VERSION) {
    s = data.session
  } else return null

  if (!FORMATS.includes(s.format as Format)) return null
  if (!PLAYS.includes(s.play as Play) || !TEAMS.includes(s.teams as Teams)) return null
  if (!comboOk(s.format as Format, s.play as Play, s.teams as Teams)) return null
  if (!isStr(s.title) || s.title !== s.title.trim() || Array.from(s.title).length > MAX_TITLE) return null
  if (!Number.isInteger(s.courts) || (s.courts as number) < MIN_COURTS || (s.courts as number) > MAX_COURTS) return null
  if (!Array.isArray(s.players) || !Array.isArray(s.line) || !Array.isArray(s.games)) return null
  const courts = s.courts as number
  const fixed = s.teams === 'fixed'
  const perSide = s.play === 'singles' ? 1 : 2

  const playersOk = s.players.every(
    (p) =>
      isObj(p) &&
      isStr(p.id) &&
      isStr(p.name) &&
      PLAYER_STATUSES.includes(p.status as string) &&
      (p.level === undefined || isLevel(p.level)) &&
      (fixed ? isStr(p.partner) : p.partner === undefined),
  )
  if (!playersOk) return null
  const players = s.players as Player[]
  const byId = new Map(players.map((p) => [p.id, p]))
  if (byId.size !== players.length) return null
  if (fixed) {
    for (const p of players) {
      const partner = byId.get(p.partner!)
      if (!partner || partner.id === p.id || partner.partner !== p.id || partner.status !== p.status) return null
    }
  }
  const lineOk = s.line.every((id) => isStr(id) && byId.has(id)) && new Set(s.line).size === s.line.length
  if (!lineOk) return null
  if (fixed) {
    const line = s.line as string[]
    if (line.length % 2 !== 0) return null
    for (let i = 0; i < line.length; i += 2) if (byId.get(line[i])!.partner !== line[i + 1]) return null
  }

  const isTeam = (v: unknown): v is Team =>
    Array.isArray(v) &&
    v.length === perSide &&
    v.every((id) => isStr(id) && byId.has(id)) &&
    (!fixed || byId.get(v[0] as string)!.partner === v[1])
  const scoresOk = (g: Record<string, unknown>) =>
    g.status === 'scored'
      ? typeof g.scoreA === 'number' && typeof g.scoreB === 'number' && validScore(g.scoreA) && validScore(g.scoreB) && g.scoreA !== g.scoreB
      : g.scoreA === undefined && g.scoreB === undefined
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
      scoresOk(g),
  )
  if (!gamesOk) return null
  if (new Set((s.games as Game[]).map((g) => g.id)).size !== s.games.length) return null
  return clone(s as unknown as Session)
}
