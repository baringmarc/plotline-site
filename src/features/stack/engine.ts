/**
 * Paddle Stack engine: pure functions over a session (SPEC §4 "Paddle Stack rules").
 * Every action returns a new session and never mutates its input. A broken rule throws a
 * `StackError` and changes nothing.
 */
import type { Format, Game, Player, Session, StandingRow } from './types'

export type StackErrorCode = 'bad-format' | 'bad-courts' | 'tie' | 'bad-score' | 'not-found' | 'not-waiting' | 'game-over'

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
/** Winners stay, split up: a player goes off after this many wins in a row on one court. */
export const WIN_CAP = 2
/** Americano pairs are searched exactly up to this many players a round. */
const EXACT_PAIRING_LIMIT = 24
/** Step limit for the pairing search, so a phone never hangs. */
const SEARCH_STEPS = 200_000

const FORMATS: readonly Format[] = ['fair', 'winners-split', 'americano']
const SESSION_VERSION = 1

// ---------- helpers ----------

const clone = (s: Session): Session => ({
  format: s.format,
  courts: s.courts,
  players: s.players.map((p) => ({ ...p })),
  line: [...s.line],
  games: s.games.map((g) => ({ ...g, teamA: [...g.teamA], teamB: [...g.teamB] })),
})

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

/** The four players in the order they came on: A1, B1, A2, B2. */
const cameOn = (g: Game): string[] => [g.teamA[0], g.teamB[0], g.teamA[1], g.teamB[1]]

const findPlayer = (s: Session, id: string): Player => {
  const p = s.players.find((x) => x.id === id)
  if (!p || p.status === 'removed') throw new StackError('not-found', `No player ${id}`)
  return p
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

/** Puts four players from the front of the line on a court: positions 1 & 3 against 2 & 4. */
const startGame = (s: Session, court: number, four: string[]) => {
  const game: Game = {
    id: nextGameId(s),
    court,
    teamA: [four[0], four[2]],
    teamB: [four[1], four[3]],
    status: 'playing',
  }
  s.games.push(game)
  s.line = s.line.filter((id) => !four.includes(id))
  setStatus(s, four, 'playing')
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
  for (const g of s.games) if (isTurn(g)) for (const id of cameOn(g)) turns.set(id, (turns.get(id) ?? 0) + 1)
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

// ---------- session ----------

export function createSession(opts: { format: Format; courts: number; names: string[] }): Session {
  if (!FORMATS.includes(opts.format)) throw new StackError('bad-format', `Unknown format ${String(opts.format)}`)
  if (!Number.isInteger(opts.courts) || opts.courts < MIN_COURTS || opts.courts > MAX_COURTS) {
    throw new StackError('bad-courts', `Courts must be ${MIN_COURTS}–${MAX_COURTS}`)
  }
  const empty: Session = { format: opts.format, courts: opts.courts, players: [], line: [], games: [] }
  return addPlayers(empty, opts.names)
}

export function addPlayers(session: Session, names: string[]): Session {
  const s = clone(session)
  const taken = new Set(s.players.filter((p) => p.status !== 'removed').map((p) => nameKey(p.name)))
  for (const raw of names) {
    const name = raw.trim()
    const key = nameKey(name)
    if (!name || taken.has(key)) continue
    taken.add(key)
    const id = nextPlayerId(s)
    s.players.push({ id, name, status: 'waiting' })
    s.line.push(id)
  }
  return s
}

export function timeOut(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (p.status !== 'waiting') throw new StackError('not-waiting', `${p.name} is not in the line`)
  p.status = 'out'
  s.line = s.line.filter((id) => id !== playerId)
  return s
}

export function backInLine(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  if (p.status !== 'out') throw new StackError('not-waiting', `${p.name} is not on a time out`)
  toBack(s, [playerId])
  return s
}

export function removePlayer(session: Session, playerId: string): Session {
  const s = clone(session)
  const p = findPlayer(s, playerId)
  const game = playingGames(s).find((g) => cameOn(g).includes(playerId))
  if (game) {
    game.status = 'cancelled'
    toFront(
      s,
      cameOn(game).filter((id) => id !== playerId),
    )
  }
  s.line = s.line.filter((id) => id !== playerId)
  p.status = 'removed'
  return s
}

// ---------- courts ----------

export function fillCourts(session: Session): Session {
  const s = clone(session)
  if (s.format === 'americano') {
    startAmericanoRound(s)
    return s
  }
  for (const court of freeCourts(s)) {
    if (s.line.length < 4) break
    startGame(s, court, s.line.slice(0, 4))
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
  const order = cameOn(g)
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
  // Winners stay but split: winner 1 + next 1 against winner 2 + next 2.
  const [n1, n2] = s.line
  const next: Game = {
    id: nextGameId(s),
    court: g.court,
    teamA: [winners[0], n1],
    teamB: [winners[1], n2],
    status: 'playing',
  }
  s.games.push(next)
  s.line = s.line.filter((id) => id !== n1 && id !== n2)
  setStatus(s, [n1, n2], 'playing')
}

// ---------- Americano ----------

function startAmericanoRound(s: Session) {
  if (playingGames(s).length > 0) return
  const courtsInUse = Math.min(s.courts, Math.floor(s.line.length / 4))
  if (courtsInUse === 0) return
  const turns = turnsPlayed(s)
  const order = new Map(s.line.map((id, i) => [id, i]))
  const chosen = [...s.line]
    .sort((a, b) => (turns.get(a) ?? 0) - (turns.get(b) ?? 0) || order.get(a)! - order.get(b)!)
    .slice(0, courtsInUse * 4)

  const partnered = new Map<string, number>()
  const opposed = new Map<string, number>()
  for (const g of s.games) {
    if (!isTurn(g)) continue
    for (const team of [g.teamA, g.teamB]) {
      const k = pairKey(team[0], team[1])
      partnered.set(k, (partnered.get(k) ?? 0) + 1)
    }
    for (const a of g.teamA)
      for (const b of g.teamB) {
        const k = pairKey(a, b)
        opposed.set(k, (opposed.get(k) ?? 0) + 1)
      }
  }

  const teams = pairPartners(chosen, (a, b) => partnered.get(pairKey(a, b)) ?? 0)
  const oppCost = (t: [string, string], u: [string, string]) =>
    t.reduce((sum, a) => sum + u.reduce((acc, b) => acc + (opposed.get(pairKey(a, b)) ?? 0), 0), 0)

  // Match teams on courts, keeping repeat opponents low (greedy).
  const left = [...teams]
  const courts = freeCourts(s)
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
 * Pairs players to minimise the total partner-repeat count (zero whenever a pairing without
 * repeats exists). Exact branch-and-bound up to EXACT_PAIRING_LIMIT players, greedy above.
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
const isPair = (v: unknown): v is [string, string] => Array.isArray(v) && v.length === 2 && v.every(isStr)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const PLAYER_STATUSES = ['waiting', 'playing', 'out', 'removed']
const GAME_STATUSES = ['playing', 'scored', 'skipped', 'cancelled']

export function deserialize(json: string): Session | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!isObj(data) || data.version !== SESSION_VERSION || !isObj(data.session)) return null
  const s = data.session
  if (!FORMATS.includes(s.format as Format)) return null
  if (!Number.isInteger(s.courts) || (s.courts as number) < MIN_COURTS || (s.courts as number) > MAX_COURTS) return null
  if (!Array.isArray(s.players) || !Array.isArray(s.line) || !Array.isArray(s.games)) return null
  const courts = s.courts as number
  const playersOk = s.players.every(
    (p) => isObj(p) && isStr(p.id) && isStr(p.name) && PLAYER_STATUSES.includes(p.status as string),
  )
  if (!playersOk) return null
  const ids = new Set((s.players as Player[]).map((p) => p.id))
  if (ids.size !== s.players.length) return null
  const lineOk = s.line.every((id) => isStr(id) && ids.has(id)) && new Set(s.line).size === s.line.length
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
      isPair(g.teamA) &&
      isPair(g.teamB) &&
      [...g.teamA, ...g.teamB].every((id) => ids.has(id)) &&
      new Set([...g.teamA, ...g.teamB]).size === 4 &&
      GAME_STATUSES.includes(g.status as string) &&
      scoresOk(g),
  )
  if (!lineOk || !gamesOk) return null
  if (new Set((s.games as Game[]).map((g) => g.id)).size !== s.games.length) return null
  return clone(s as unknown as Session)
}
