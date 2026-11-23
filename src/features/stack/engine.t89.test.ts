// T8.9 Pair locks replace the Teams option (TASKS.md T8.9, incl. "Decided at the start of the build (user,
// 2026-11-23)"; SPEC §4 "Paddle Stack rules": Session, Combinations, Sides, Pair locks, Fair rotation, Winners stay,
// Round Robin, Skill groups, Winners vs Losers, Saving; SPEC §6 T8.9 plan and build rows).
//
// Names the tests rely on (the plan's):
// - types: `Session` has no `teams`; `Player.partner?: string` is the lock (the partner's id, set on both partners);
// - engine: `createSession({ format, courts, title?, play?, names?, pairs? })` (pairs are added locked, after the
//   names), `addPlayers`, `addPairs` (locked pairs at the back), `lockPair(session, aId, bId)`,
//   `unlockPair(session, playerId)` (either partner's id), `locksOffered(play, format)`; `StackError` codes
//   `on-court`, `bad-pair`, `bad-combo`, `not-found`, `needs-pair`; `serialize` writes version 3, `deserialize`
//   loads versions 3, 2 and 1;
// - a pair's partners stand in the line in the order they joined the session.
// Teams are compared as sets of players where SPEC doesn't fix the order inside a team; team A is checked where SPEC
// names it ("Team A is the team holding the side that was first in line").
import { describe, expect, it } from 'vitest'
import {
  StackError,
  addPairs,
  addPlayers,
  backInLine,
  createSession,
  deserialize,
  fillCourts,
  lockPair,
  locksOffered,
  recordScore,
  removePlayer,
  serialize,
  skipGame,
  standings,
  timeOut,
  unlockPair,
  type NewPlayer,
} from './engine'
import type { Format, Game, Level, Play, Session } from './types'

// ---------- helpers ----------

const NAMES = [
  'Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida',
  'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia', 'Quin', 'Ray',
]
const ALL_FORMATS: Format[] = ['fair', 'winners-split', 'americano', 'round-robin', 'mexicano', 'skill-groups', 'winners-losers']
/** The continuous formats that take any mix of solos and pairs (SPEC §4 "Combinations"). */
const MIX_FORMATS: Format[] = ['fair', 'winners-split', 'skill-groups', 'winners-losers']

function id(s: Session, name: string): string {
  const p = s.players.find((x) => x.name === name)
  if (!p) throw new Error(`no player ${name}`)
  return p.id
}
const ids = (s: Session, ...ns: string[]) => ns.map((n) => id(s, n))
const byId = (s: Session, pid: string) => s.players.find((p) => p.id === pid)!
const player = (s: Session, name: string) => s.players.find((p) => p.name === name)!
const status = (s: Session, name: string) => player(s, name).status
const partnerName = (s: Session, name: string) => {
  const q = player(s, name).partner
  return q === undefined ? undefined : byId(s, q).name
}
const lineNames = (s: Session) => s.line.map((x) => byId(s, x).name)
const joinIndex = (s: Session, pid: string) => s.players.findIndex((p) => p.id === pid)
const joinOrder = (s: Session, xs: readonly string[]) => [...xs].sort((a, b) => joinIndex(s, a) - joinIndex(s, b))

const playing = (s: Session) => s.games.filter((g) => g.status === 'playing')
const onCourt = (s: Session, court: number) => {
  const gs = playing(s).filter((g) => g.court === court)
  expect(gs, `one game on court ${court}`).toHaveLength(1)
  return gs[0]
}
const playersOf = (g: Game) => [...g.teamA, ...g.teamB]
const set = (xs: readonly string[]) => [...xs].sort().join('|')
/** A team (or any list of players) as a sorted list of names. */
const named = (s: Session, xs: readonly string[]) => [...xs].map((x) => byId(s, x).name).sort().join('|')
const teamsNamed = (s: Session, g: Game) => [named(s, g.teamA), named(s, g.teamB)].sort()
const freeCourts = (s: Session) => {
  const busy = new Set(playing(s).map((g) => g.court))
  return Array.from({ length: s.courts }, (_, i) => i + 1).filter((c) => !busy.has(c))
}

function expectCode(fn: () => unknown, code: string) {
  let caught: unknown
  try {
    fn()
  } catch (e) {
    caught = e
  }
  expect(caught, `expected StackError ${code}`).toBeInstanceOf(StackError)
  expect((caught as StackError).code).toBe(code)
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}

/** A varied, deterministic score with no ties: team B wins every third game. */
function score(i: number): [number, number] {
  const loser = (i * 7) % 10
  return i % 3 === 1 ? [loser, 11] : [11, loser]
}

/** Scores the game on `court` so that the team holding `winner` wins. */
function win(s: Session, court: number, winner: string): Session {
  const g = onCourt(s, court)
  const aWins = (g.teamA as string[]).includes(id(s, winner))
  return recordScore(s, g.id, aWins ? 11 : 5, aWins ? 5 : 11)
}

const lock = (s: Session, a: string, b: string) => lockPair(s, id(s, a), id(s, b))

/** Six solo players waiting in a doubles session: Ana, Ben, Cy, Dee, Eli, Fay. */
const six = (format: Format = 'fair', play: Play = 'doubles') => createSession({ format, play, courts: 1, names: NAMES.slice(0, 6) })

/**
 * Locks are consistent (SPEC §4 "Pair locks"): partners point at each other and share a status; in the line they
 * stand next to each other in the order they joined; on court a locked pair is always one team.
 */
function expectLocks(s: Session) {
  for (const p of s.players) {
    if (p.partner === undefined) continue
    const q = s.players.find((x) => x.id === p.partner)
    expect(q, `${p.name}'s partner is a player`).toBeDefined()
    expect(q!.id, `${p.name} is not their own partner`).not.toBe(p.id)
    expect(q!.partner, `${q!.name} points back at ${p.name}`).toBe(p.id)
    expect(q!.status, `${p.name} and ${q!.name} share a status`).toBe(p.status)
  }
  s.line.forEach((x, i) => {
    const p = byId(s, x)
    if (p.partner === undefined) return
    const j = s.line.indexOf(p.partner)
    expect(Math.abs(i - j), `${p.name} stands next to their partner`).toBe(1)
    if (joinIndex(s, x) < joinIndex(s, p.partner)) expect(j, `${p.name} stands first (joined first)`).toBe(i + 1)
  })
  for (const g of playing(s)) {
    for (const x of playersOf(g)) {
      const p = byId(s, x)
      if (p.partner === undefined) continue
      const team = (g.teamA as string[]).includes(x) ? g.teamA : g.teamB
      expect(team as string[], `${p.name}'s partner is on their team`).toContain(p.partner)
    }
  }
}

/** Every active player is in the line or on court exactly once, each game two a side. */
function expectConsistent(s: Session) {
  const on = playing(s).flatMap(playersOf)
  expect(new Set(on).size).toBe(on.length)
  expect(new Set(s.line).size).toBe(s.line.length)
  for (const p of s.players) {
    const inLine = s.line.includes(p.id)
    const isOn = on.includes(p.id)
    if (p.status === 'waiting') expect(inLine && !isOn, `${p.name} waiting`).toBe(true)
    else if (p.status === 'playing') expect(isOn && !inLine, `${p.name} playing`).toBe(true)
    else expect(inLine || isOn, `${p.name} ${p.status}`).toBe(false)
  }
  for (const g of s.games) {
    expect(g.teamA).toHaveLength(2)
    expect(g.teamB).toHaveLength(2)
  }
  expectLocks(s)
}

// ---------- a reference for SPEC's "Sides" and Fair rotation ----------

type Side = string[]

/** The line read as sides, front first: a solo player, or a locked pair (its partners, in the order they joined). */
function lineSides(s: Session): Side[] {
  const out: Side[] = []
  const seen = new Set<string>()
  for (const x of s.line) {
    if (seen.has(x)) continue
    const p = byId(s, x)
    const side = p.partner !== undefined ? joinOrder(s, [x, p.partner]) : [x]
    side.forEach((y) => seen.add(y))
    out.push(side)
  }
  return out
}

/** Can some of these sides make exactly `n` players? */
function canMake(sides: Side[], n: number): boolean {
  const solos = sides.filter((x) => x.length === 1).length
  const pairs = sides.filter((x) => x.length === 2).length
  for (let p = 0; p <= pairs && p * 2 <= n; p++) if (n - p * 2 <= solos) return true
  return false
}

/**
 * SPEC "Sides": a court takes sides from the front of the line while they fit; a pair that would overflow it, or a
 * side after which it could no longer be filled exactly, is skipped and keeps its place. Null when it can't be filled.
 */
function takeSides(sides: Side[], n: number): Side[] | null {
  if (!canMake(sides, n)) return null
  const taken: Side[] = []
  let t = 0
  for (let i = 0; i < sides.length && t < n; i++) {
    const side = sides[i]
    if (t + side.length > n) continue
    if (!canMake(sides.slice(i + 1), n - t - side.length)) continue
    taken.push(side)
    t += side.length
  }
  return taken
}

/** SPEC "Fair rotation": a pair is one team; solos 1 & 3 against 2 & 4; team A holds the side first in line. */
function fairTeams(taken: Side[]): [string[], string[]] {
  const pairs = taken.filter((x) => x.length === 2)
  const solos = taken.filter((x) => x.length === 1).map((x) => x[0])
  if (pairs.length === 2) return [pairs[0], pairs[1]]
  if (pairs.length === 1) return taken[0].length === 2 ? [pairs[0], solos] : [solos, pairs[0]]
  return [
    [solos[0], solos[2]],
    [solos[1], solos[3]],
  ]
}

interface Expected {
  court: number
  a: string[]
  b: string[]
}

/** What fillCourts must start in Fair rotation, court by court, lowest first. */
function expectedFair(s: Session): Expected[] {
  let sides = lineSides(s)
  const out: Expected[] = []
  for (const court of freeCourts(s)) {
    const taken = takeSides(sides, 4)
    if (!taken) break
    const [a, b] = fairTeams(taken)
    out.push({ court, a, b })
    sides = sides.filter((x) => !taken.includes(x))
  }
  return out
}

/** The games fillCourts just started match `expected` (court, team A, team B as sets); the line keeps its order. */
function expectFill(before: Session, after: Session, expected: Expected[]) {
  expect(after.games.slice(0, before.games.length)).toEqual(before.games)
  const fresh = after.games.slice(before.games.length)
  expect(fresh.map((g) => ({ court: g.court, a: set(g.teamA), b: set(g.teamB), status: g.status }))).toEqual(
    expected.map((e) => ({ court: e.court, a: set(e.a), b: set(e.b), status: 'playing' })),
  )
  const went = new Set(fresh.flatMap(playersOf))
  expect(after.line).toEqual(before.line.filter((x) => !went.has(x)))
  expectConsistent(after)
}

/**
 * SPEC "Fair rotation": after a game everyone goes to the back in the order they came on, sides alternating between
 * the teams, team A's first (a locked pair counts as one side, its partners kept together in the order they joined).
 */
function backOrder(s: Session, g: Game): string[] {
  const sidesOf = (team: readonly string[]): Side[] =>
    team.length === 2 && byId(s, team[0]).partner === team[1] ? [joinOrder(s, team)] : team.map((x) => [x])
  const a = sidesOf(g.teamA)
  const b = sidesOf(g.teamB)
  const out: string[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(...a[i])
    if (b[i]) out.push(...b[i])
  }
  return out
}

/** The side at the front goes on the next free court whenever the court can be filled with it. */
function expectFrontGoesOn(before: Session, after: Session) {
  const fresh = after.games.slice(before.games.length)
  let sides = lineSides(before)
  for (const g of fresh) {
    const front = sides[0]
    if (front && canMake(sides.slice(1), 4 - front.length)) {
      expect(playersOf(g), `${named(before, front)} (front of the line) goes on court ${g.court}`).toEqual(expect.arrayContaining(front))
    }
    const on = new Set(playersOf(g))
    sides = sides.filter((x) => !x.some((y) => on.has(y)))
  }
}

/** A free court is left only when the line can't fill it with its sides. */
function expectFreeCourtsUnfillable(s: Session) {
  if (freeCourts(s).length > 0) expect(canMake(lineSides(s), 4), 'a free court the line could fill').toBe(false)
}

/** Mixed lineups: `solos` solo players, then `pairs` locked pairs. */
type Mix = { solos: number; pairs: number; courts: number }
const MIXES: Mix[] = [
  { solos: 2, pairs: 1, courts: 1 },
  { solos: 3, pairs: 2, courts: 1 },
  { solos: 2, pairs: 3, courts: 1 },
  { solos: 4, pairs: 3, courts: 2 },
  { solos: 5, pairs: 2, courts: 2 },
  { solos: 3, pairs: 5, courts: 2 },
  { solos: 6, pairs: 4, courts: 3 },
  { solos: 8, pairs: 2, courts: 3 },
]
const mixLabel = (m: Mix) => `${m.solos} solos and ${m.pairs} pairs on ${m.courts} court(s)`
/** Mixed levels with players of no level in between. */
const MIXED_LEVELS: (Level | undefined)[] = [3, 1, undefined, 2, 3, 2, 1, undefined, 3, 1, 2, undefined, 2, 3, 1, 1, undefined, 2]

function mixed(format: Format, m: Mix, levels?: (Level | undefined)[]): Session {
  const people: NewPlayer[] = NAMES.slice(0, m.solos + m.pairs * 2).map((name, i) =>
    levels?.[i] !== undefined ? { name, level: levels[i] } : name,
  )
  const names = people.slice(0, m.solos)
  const rest = people.slice(m.solos)
  const pairs = Array.from({ length: m.pairs }, (_, i) => [rest[i * 2], rest[i * 2 + 1]] as [NewPlayer, NewPlayer])
  return createSession({ format, courts: m.courts, names, pairs })
}

const solosWaiting = (s: Session) => s.line.filter((x) => byId(s, x).partner === undefined)
const activeSolos = (s: Session) => s.players.filter((p) => p.status !== 'removed' && p.partner === undefined).length

/**
 * Lock events along a run (only on lineups with solos to spare, so two solos always remain): two waiting solos are
 * locked, a pair on court is unlocked, a waiting pair takes a time out and comes back, and a waiting pair is removed.
 */
function lockEvent(s: Session, i: number, state: { out?: string }): Session {
  if (i === 6 && activeSolos(s) >= 6 && solosWaiting(s).length >= 2) {
    const [a, b] = solosWaiting(s)
    return lockPair(s, a, b)
  }
  if (i === 12) {
    const pairOnCourt = playing(s)
      .flatMap(playersOf)
      .find((x) => byId(s, x).partner !== undefined)
    if (pairOnCourt) return unlockPair(s, pairOnCourt)
  }
  if (i === 18) {
    const pair = s.line.find((x) => byId(s, x).partner !== undefined)
    if (pair) {
      state.out = pair
      return timeOut(s, pair)
    }
  }
  if (i === 24 && state.out) return backInLine(s, state.out)
  if (i === 30) {
    const pair = s.line.find((x) => byId(s, x).partner !== undefined)
    if (pair) return removePlayer(s, pair)
  }
  return s
}

/** Counts, per player, the games started while they waited; a turn on court (or a time out) resets it. */
function trackWaits(s: Session, waits: Map<string, number>, started: number) {
  for (const p of s.players) {
    if (p.status === 'waiting') waits.set(p.id, (waits.get(p.id) ?? 0) + started)
    else waits.set(p.id, 0)
  }
  const active = s.players.filter((p) => p.status === 'waiting' || p.status === 'playing').length
  for (const p of s.players) {
    expect(waits.get(p.id) ?? 0, `${p.name} waits through at most ${2 * active} game starts (nobody waits forever)`).toBeLessThanOrEqual(2 * active)
  }
}

// ---------- combinations ----------

describe('locksOffered (SPEC §4 "Combinations": doubles, not Americano or Mexicano)', () => {
  it.each<Format>(['fair', 'winners-split', 'round-robin', 'skill-groups', 'winners-losers'])('doubles %s offers locks', (format) => {
    expect(locksOffered('doubles', format)).toBe(true)
  })

  it.each<Format>(['americano', 'mexicano'])('doubles %s offers no locks (partners rotate)', (format) => {
    expect(locksOffered('doubles', format)).toBe(false)
  })

  it.each(ALL_FORMATS)('singles %s offers no locks', (format) => {
    expect(locksOffered('singles', format)).toBe(false)
  })
})

// ---------- the session ----------

describe('the session has no Teams option (T8.9)', () => {
  it('createSession gives no teams field, with names, with pairs, or with both, in doubles and singles', () => {
    const sessions = [
      createSession({ format: 'fair', courts: 1, names: NAMES.slice(0, 4) }),
      createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }),
      createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }),
      createSession({ format: 'fair', courts: 1, play: 'singles', names: ['Ana', 'Ben'] }),
    ]
    for (const s of sessions) expect(s).not.toHaveProperty('teams')
  })

  it('doubles with names only is an open queue: every player is solo', () => {
    const s = createSession({ format: 'winners-split', courts: 2, names: NAMES.slice(0, 9) })
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
  })
})

describe('createSession with names and locked pairs (T8.9)', () => {
  it('adds the names, then each pair locked, in that order at the back of the line', () => {
    const s = createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee'], ['Eli', 'Fay']] })
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'])
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'])
    expect(partnerName(s, 'Cy')).toBe('Dee')
    expect(partnerName(s, 'Dee')).toBe('Cy')
    expect(partnerName(s, 'Eli')).toBe('Fay')
    expect(partnerName(s, 'Fay')).toBe('Eli')
    expect(player(s, 'Ana').partner).toBeUndefined()
    expect(player(s, 'Ben').partner).toBeUndefined()
    expect(s.players.every((p) => p.status === 'waiting')).toBe(true)
    expectConsistent(s)
  })

  it('a pair with an empty or taken name, or the same name twice, is skipped whole', () => {
    const s = createSession({
      format: 'fair',
      courts: 1,
      names: ['Ana'],
      pairs: [
        ['ana', 'Ben'],
        ['Cy', '  '],
        ['Dee', 'DEE'],
        ['  Eli ', 'Fay'],
        ['Gus', 'fay'],
      ],
    })
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Eli', 'Fay'])
    expect(partnerName(s, 'Eli')).toBe('Fay')
    expect(player(s, 'Ana').partner).toBeUndefined()
  })

  it('pairs may carry levels', () => {
    const s = createSession({ format: 'skill-groups', courts: 1, names: ['Ana'], pairs: [[{ name: 'Ben', level: 3 }, 'Cy']] })
    expect(player(s, 'Ben').level).toBe(3)
    expect(player(s, 'Cy').level).toBeUndefined()
    expect(partnerName(s, 'Ben')).toBe('Cy')
  })

  it.each<[Play, Format]>([
    ['singles', 'fair'],
    ['singles', 'skill-groups'],
    ['singles', 'round-robin'],
    ['doubles', 'americano'],
    ['doubles', 'mexicano'],
  ])('pairs are refused with bad-combo in %s %s', (play, format) => {
    expectCode(() => createSession({ format, play, courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }), 'bad-combo')
  })

  it.each<Format>(['fair', 'winners-split', 'round-robin', 'skill-groups', 'winners-losers'])('doubles %s takes locked pairs', (format) => {
    const s = createSession({ format, courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] })
    expect(partnerName(s, 'Ana')).toBe('Ben')
    expect(partnerName(s, 'Dee')).toBe('Cy')
  })
})

describe('adding players later (T8.9)', () => {
  it('addPlayers adds names one by one as solo players, also when the session has locked pairs (no pairing by order)', () => {
    let s = createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] })
    s = addPlayers(s, ['Eli', 'Fay'])
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'])
    expect(player(s, 'Eli').partner).toBeUndefined()
    expect(player(s, 'Fay').partner).toBeUndefined()
  })

  it('addPairs adds locked pairs at the back of the line, skipping bad pairs whole', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES.slice(0, 5) }))
    expect(lineNames(s)).toEqual(['Eli'])
    s = addPairs(s, [
      ['Gus', 'Hal'],
      ['eli', 'Ida'],
      ['Jo', 'Kit'],
    ])
    expect(lineNames(s)).toEqual(['Eli', 'Gus', 'Hal', 'Jo', 'Kit'])
    expect(s.players.map((p) => p.name)).not.toContain('Ida')
    expect(partnerName(s, 'Gus')).toBe('Hal')
    expect(partnerName(s, 'Kit')).toBe('Jo')
    expect(player(s, 'Eli').partner).toBeUndefined()
    expectConsistent(s)
  })

  it.each<[string, () => Session]>([
    ['singles', () => createSession({ format: 'fair', play: 'singles', courts: 1, names: ['Ana', 'Ben'] })],
    ['Americano', () => createSession({ format: 'americano', courts: 1, names: NAMES.slice(0, 4) })],
    ['Mexicano', () => createSession({ format: 'mexicano', courts: 1, names: NAMES.slice(0, 4) })],
    ['a no-pairs Round Robin', () => createSession({ format: 'round-robin', courts: 1, names: NAMES.slice(0, 4) })],
  ])('addPairs is refused with bad-combo in %s', (_label, make) => {
    const s = deepFreeze(make())
    expectCode(() => addPairs(s, [['Zed', 'Yan']]), 'bad-combo')
  })

  it('addPairs never mutates its input', () => {
    const s = deepFreeze(createSession({ format: 'fair', courts: 1, names: NAMES.slice(0, 4) }))
    const next = addPairs(s, [['Eli', 'Fay']])
    expect(next.players).toHaveLength(6)
    expect(s.players).toHaveLength(4)
  })
})

// ---------- lockPair ----------

describe('lockPair (SPEC §4 "Pair locks")', () => {
  it('locks two waiting players: each partner points at the other, both stay waiting, the input is unchanged', () => {
    const s = deepFreeze(six())
    const next = lock(s, 'Ana', 'Dee')
    expect(partnerName(next, 'Ana')).toBe('Dee')
    expect(partnerName(next, 'Dee')).toBe('Ana')
    expect(status(next, 'Ana')).toBe('waiting')
    expect(status(next, 'Dee')).toBe('waiting')
    expect(next.players.filter((p) => p.partner !== undefined).map((p) => p.name)).toEqual(['Ana', 'Dee'])
    expect(player(s, 'Ana').partner).toBeUndefined()
    expect(next.games).toEqual(s.games)
    expectConsistent(next)
  })

  it('the new pair stands at the spot of the partner further back; the other moves back next to it (nobody jumps the line)', () => {
    const s = six()
    expect(lineNames(lock(s, 'Ana', 'Dee'))).toEqual(['Ben', 'Cy', 'Ana', 'Dee', 'Eli', 'Fay'])
    expect(lineNames(lock(s, 'Dee', 'Ana'))).toEqual(['Ben', 'Cy', 'Ana', 'Dee', 'Eli', 'Fay'])
    expect(lineNames(lock(s, 'Fay', 'Cy'))).toEqual(['Ana', 'Ben', 'Dee', 'Eli', 'Cy', 'Fay'])
  })

  it('neighbours in the line keep their places', () => {
    const s = six()
    expect(lock(s, 'Ben', 'Cy').line).toEqual(s.line)
    expect(lock(s, 'Fay', 'Eli').line).toEqual(s.line)
  })

  it('partners stand in the order they joined, even when the one who joined later was in front', () => {
    let s = fillCourts(six())
    s = recordScore(s, onCourt(s, 1).id, 11, 4)
    expect(lineNames(s)).toEqual(['Eli', 'Fay', 'Ana', 'Ben', 'Cy', 'Dee'])
    s = lock(s, 'Fay', 'Ana')
    expect(lineNames(s)).toEqual(['Eli', 'Ana', 'Fay', 'Ben', 'Cy', 'Dee'])
    expectConsistent(s)
  })

  it('locking a waiting player with one on a time out puts both on the time out; Back in line brings both back together', () => {
    const base = timeOut(six(), id(six(), 'Cy'))
    for (const [a, b] of [
      ['Ana', 'Cy'],
      ['Cy', 'Ana'],
    ]) {
      let s = lock(base, a, b)
      expect(status(s, 'Ana')).toBe('out')
      expect(status(s, 'Cy')).toBe('out')
      expect(partnerName(s, 'Ana')).toBe('Cy')
      expect(lineNames(s)).toEqual(['Ben', 'Dee', 'Eli', 'Fay'])
      s = backInLine(s, id(s, 'Ana'))
      expect(status(s, 'Ana')).toBe('waiting')
      expect(status(s, 'Cy')).toBe('waiting')
      expect(lineNames(s)).toEqual(['Ben', 'Dee', 'Eli', 'Fay', 'Ana', 'Cy'])
      expectConsistent(s)
    }
  })

  it('two players on a time out stay out, locked, and the line is unchanged', () => {
    let s = six()
    s = timeOut(timeOut(s, id(s, 'Ana')), id(s, 'Ben'))
    s = lock(s, 'Ana', 'Ben')
    expect(status(s, 'Ana')).toBe('out')
    expect(status(s, 'Ben')).toBe('out')
    expect(partnerName(s, 'Ben')).toBe('Ana')
    expect(lineNames(s)).toEqual(['Cy', 'Dee', 'Eli', 'Fay'])
  })

  it('is refused while either partner is on court (on-court), changing nothing', () => {
    const s = deepFreeze(fillCourts(six()))
    expect(lineNames(s)).toEqual(['Eli', 'Fay'])
    expectCode(() => lock(s, 'Ana', 'Eli'), 'on-court')
    expectCode(() => lock(s, 'Eli', 'Ana'), 'on-court')
    expectCode(() => lock(s, 'Ana', 'Cy'), 'on-court')
    const t = deepFreeze(timeOut(s, id(s, 'Eli')))
    expectCode(() => lock(t, 'Eli', 'Ben'), 'on-court')
  })

  it('the same player twice, or a player already in a pair, is bad-pair', () => {
    const s = deepFreeze(lock(six(), 'Ana', 'Ben'))
    expectCode(() => lock(s, 'Cy', 'Cy'), 'bad-pair')
    expectCode(() => lock(s, 'Ana', 'Cy'), 'bad-pair')
    expectCode(() => lock(s, 'Cy', 'Ben'), 'bad-pair')
    expectCode(() => lock(s, 'Ana', 'Ben'), 'bad-pair')
  })

  it('an unknown or removed player is not-found', () => {
    let s = six()
    expectCode(() => lockPair(s, 'nobody', id(s, 'Ana')), 'not-found')
    expectCode(() => lockPair(s, id(s, 'Ana'), 'nobody'), 'not-found')
    s = deepFreeze(removePlayer(s, id(s, 'Fay')))
    expectCode(() => lock(s, 'Ana', 'Fay'), 'not-found')
  })

  it.each<[Play, Format]>([
    ['singles', 'fair'],
    ['singles', 'skill-groups'],
    ['singles', 'winners-losers'],
    ['doubles', 'americano'],
    ['doubles', 'mexicano'],
  ])('is refused with bad-combo in %s %s', (play, format) => {
    const s = deepFreeze(six(format, play))
    expectCode(() => lockPair(s, s.players[0].id, s.players[1].id), 'bad-combo')
  })

  it('is refused with bad-combo in Round Robin, before and once it starts (its pairs are set on the start screen)', () => {
    const s = deepFreeze(six('round-robin'))
    expectCode(() => lock(s, 'Ana', 'Ben'), 'bad-combo')
    const started = deepFreeze(fillCourts(s))
    const [a, b] = started.line
    expect(b, 'two players wait').toBeDefined()
    expectCode(() => lockPair(started, a, b), 'bad-combo')
  })

  it.each(MIX_FORMATS)('works in doubles %s', (format) => {
    const s = lock(six(format), 'Ben', 'Eli')
    expect(partnerName(s, 'Ben')).toBe('Eli')
    expectConsistent(s)
  })
})

// ---------- unlockPair ----------

describe('unlockPair (SPEC §4 "Pair locks": any time, leaving both where they are)', () => {
  it('unlocks with either partner’s id: both stay where they are, as two solos, and nothing else changes', () => {
    const s = deepFreeze(lock(six(), 'Ana', 'Dee'))
    expect(lineNames(s)).toEqual(['Ben', 'Cy', 'Ana', 'Dee', 'Eli', 'Fay'])
    for (const who of ['Ana', 'Dee']) {
      const next = unlockPair(s, id(s, who))
      expect(next.line).toEqual(s.line)
      expect(player(next, 'Ana').partner).toBeUndefined()
      expect(player(next, 'Dee').partner).toBeUndefined()
      expect(next.players.map(({ id: pid, name, status: st, level }) => ({ pid, name, st, level }))).toEqual(
        s.players.map(({ id: pid, name, status: st, level }) => ({ pid, name, st, level })),
      )
      expect(next.games).toEqual(s.games)
    }
    expect(partnerName(s, 'Ana')).toBe('Dee')
  })

  it('works on court: the game goes on unchanged, and afterwards the two queue as solos', () => {
    let s = addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }), ['Eli', 'Fay'])
    s = fillCourts(s)
    const g = onCourt(s, 1)
    expect(teamsNamed(s, g)).toEqual(['Ana|Ben', 'Cy|Dee'])
    const next = unlockPair(s, id(s, 'Ben'))
    expect(onCourt(next, 1)).toEqual(g)
    expect(status(next, 'Ana')).toBe('playing')
    expect(status(next, 'Ben')).toBe('playing')
    expect(player(next, 'Ana').partner).toBeUndefined()
    expect(player(next, 'Ben').partner).toBeUndefined()
    expect(partnerName(next, 'Cy')).toBe('Dee')
    const after = recordScore(next, g.id, 11, 3)
    expect(lineNames(after).slice(0, 2)).toEqual(['Eli', 'Fay'])
    expect(named(after, after.line.slice(2))).toBe('Ana|Ben|Cy|Dee')
    expect(partnerName(lock(after, 'Ana', 'Eli'), 'Ana')).toBe('Eli')
  })

  it('works on a time out: both stay out, and Back in line then brings back only that player', () => {
    let s = timeOut(lock(six(), 'Ana', 'Ben'), id(six(), 'Ana'))
    expect(status(s, 'Ben')).toBe('out')
    s = unlockPair(s, id(s, 'Ana'))
    expect(status(s, 'Ana')).toBe('out')
    expect(status(s, 'Ben')).toBe('out')
    s = backInLine(s, id(s, 'Ben'))
    expect(status(s, 'Ben')).toBe('waiting')
    expect(status(s, 'Ana')).toBe('out')
    expect(lineNames(s)).toEqual(['Cy', 'Dee', 'Eli', 'Fay', 'Ben'])
  })

  it('a player not in a pair is bad-pair; an unknown player is not-found', () => {
    const s = deepFreeze(lock(six(), 'Ana', 'Ben'))
    expectCode(() => unlockPair(s, id(s, 'Cy')), 'bad-pair')
    expectCode(() => unlockPair(s, 'nobody'), 'not-found')
  })

  it('is refused with bad-combo in Round Robin: its pairs stay as set at the start', () => {
    const s = deepFreeze(createSession({ format: 'round-robin', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee'], ['Eli', 'Fay']] }))
    expectCode(() => unlockPair(s, id(s, 'Ana')), 'bad-combo')
    const started = deepFreeze(fillCourts(s))
    expectCode(() => unlockPair(started, id(started, 'Eli')), 'bad-combo')
    expectCode(() => unlockPair(started, id(started, 'Ben')), 'bad-combo')
  })

  it('never mutates its input, and unlocked players can be locked again with someone else', () => {
    const s = deepFreeze(lock(six(), 'Ana', 'Ben'))
    const next = unlockPair(s, id(s, 'Ana'))
    expect(partnerName(s, 'Ana')).toBe('Ben')
    const again = lock(lock(next, 'Ana', 'Cy'), 'Ben', 'Dee')
    expect(partnerName(again, 'Ana')).toBe('Cy')
    expect(partnerName(again, 'Ben')).toBe('Dee')
    expectConsistent(again)
  })
})

// ---------- sides: filling a court ----------

describe('courts take sides from the front of the line while they fit, per SPEC §4 "Sides" (Fair rotation)', () => {
  it('two pairs: pair against pair, team A the pair first in line', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Dee')
    expect(s.line).toEqual([])
    expectConsistent(s)
  })

  it('a pair and two solos: the solos are one team, the pair the other; team A holds the side first in line', () => {
    const solosFirst = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }))
    expect(named(solosFirst, onCourt(solosFirst, 1).teamA)).toBe('Ana|Ben')
    expect(named(solosFirst, onCourt(solosFirst, 1).teamB)).toBe('Cy|Dee')

    const pairFirst = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben']] }), ['Cy', 'Dee']))
    expect(named(pairFirst, onCourt(pairFirst, 1).teamA)).toBe('Ana|Ben')
    expect(named(pairFirst, onCourt(pairFirst, 1).teamB)).toBe('Cy|Dee')

    const pairBetween = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana'], pairs: [['Ben', 'Cy']] }), ['Dee']))
    expect(named(pairBetween, onCourt(pairBetween, 1).teamA)).toBe('Ana|Dee')
    expect(named(pairBetween, onCourt(pairBetween, 1).teamB)).toBe('Ben|Cy')
    for (const s of [solosFirst, pairFirst, pairBetween]) expectConsistent(s)
  })

  it('four solos: 1 & 3 against 2 & 4 among themselves, the pair behind them waiting', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES.slice(0, 4), pairs: [['Eli', 'Fay']] }))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Dee'))
    expect(lineNames(s)).toEqual(['Eli', 'Fay'])
  })

  it('a pair that would overflow the court is skipped and keeps its place at the front', () => {
    const start = addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben', 'Cy'], pairs: [['Dee', 'Eli']] }), ['Fay'])
    expect(lineNames(start)).toEqual(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'])
    const s = fillCourts(start)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Cy')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Fay')
    expect(lineNames(s)).toEqual(['Dee', 'Eli'])
  })

  it('a solo after which the court could no longer be filled exactly is skipped and keeps its place', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben', 'Cy'], pairs: [['Dee', 'Eli']] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Dee|Eli')
    expect(lineNames(s)).toEqual(['Cy'])
  })

  it('a lone solo with only pairs behind it waits until another solo is free', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Ana'], pairs: [['Ben', 'Cy'], ['Dee', 'Eli']] }))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ben|Cy', 'Dee|Eli'])
    expect(lineNames(s)).toEqual(['Ana'])
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 6))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ben|Cy', 'Dee|Eli'])
    expect(lineNames(s)).toEqual(['Ana'])
    s = recordScore(addPlayers(s, ['Fay']), onCourt(s, 1).id, 11, 6)
    expect(lineNames(s)).toEqual(['Ana', 'Fay', 'Ben', 'Cy', 'Dee', 'Eli'])
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Fay')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Cy')
    expect(lineNames(s)).toEqual(['Dee', 'Eli'])
  })

  it('a pair and a solo (3 players) fill nothing', () => {
    const s = createSession({ format: 'fair', courts: 1, names: ['Ana'], pairs: [['Ben', 'Cy']] })
    expect(fillCourts(s)).toEqual(s)
  })

  it('two courts: court 1 takes its sides first, court 2 takes its sides from what is left', () => {
    let s = createSession({ format: 'fair', courts: 2, names: ['Ana'], pairs: [['Ben', 'Cy'], ['Dee', 'Eli']] })
    s = addPairs(addPlayers(s, ['Fay', 'Gus']), [['Hal', 'Ida']])
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida'])
    const before = s
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Fay')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Cy')
    expect(named(s, onCourt(s, 2).teamA)).toBe('Dee|Eli')
    expect(named(s, onCourt(s, 2).teamB)).toBe('Hal|Ida')
    expect(lineNames(s)).toEqual(['Gus'])
    expectFill(before, s, expectedFair(before))
  })
})

describe('after a game the sides go to the back alternating between the teams, team A’s first (SPEC §4 "Fair rotation")', () => {
  it('two solos against a pair: A1, the pair, A2', () => {
    let s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }), ['Eli']))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    s = recordScore(s, onCourt(s, 1).id, 4, 11)
    expect(lineNames(s)).toEqual(['Eli', 'Ana', 'Cy', 'Dee', 'Ben'])
    expectConsistent(s)
  })

  it('a pair against two solos: the pair, B1, B2', () => {
    let s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben']] }), ['Cy', 'Dee', 'Eli']))
    s = recordScore(s, onCourt(s, 1).id, 11, 9)
    expect(lineNames(s)).toEqual(['Eli', 'Ana', 'Ben', 'Cy', 'Dee'])
  })

  it('two pairs: pair A, then pair B; a skipped game goes the same way', () => {
    const start = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }), ['Eli']))
    expect(lineNames(recordScore(start, onCourt(start, 1).id, 3, 11))).toEqual(['Eli', 'Ana', 'Ben', 'Cy', 'Dee'])
    expect(lineNames(skipGame(start, onCourt(start, 1).id))).toEqual(['Eli', 'Ana', 'Ben', 'Cy', 'Dee'])
  })
})

// ---------- Fair rotation with mixed sides over many games ----------

describe('Fair rotation with solos and locked pairs over many games (nobody waits forever)', () => {
  it.each(MIXES.map((m) => [mixLabel(m), m] as const))('%s', (_label, m) => {
    for (const events of [false, true]) {
      if (events && m.solos < 6) continue
      let s = mixed('fair', m)
      const waits = new Map<string, number>()
      const state: { out?: string } = {}
      let seen = s.games.length
      for (let i = 0; i < 60; i++) {
        if (events) s = lockEvent(s, i, state)
        const before = s
        s = fillCourts(s)
        expectFill(before, s, expectedFair(before))
        expectFreeCourtsUnfillable(s)
        trackWaits(s, waits, s.games.length - seen)
        seen = s.games.length
        const live = playing(s)
        expect(live.length, `a game is on court (step ${i})`).toBeGreaterThan(0)
        const g = i % 4 === 3 ? live[live.length - 1] : live[0]
        const queue = [...s.line, ...backOrder(s, g)]
        s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, ...score(i))
        expect(s.line, 'everyone in the game goes to the back, sides alternating, team A first').toEqual(queue)
        expectConsistent(s)
      }
    }
  })
})

// ---------- Winners stay & split with locks ----------

describe('Winners stay & split with locked pairs (SPEC §4 "Winners stay, split up")', () => {
  it('a winning pair stays together and plays the next pair; after 2 wins in a row all four go off, losers first', () => {
    let s = lock(createSession({ format: 'winners-split', courts: 1, names: ['Ana', 'Ben', 'Cy', 'Dee'], pairs: [['Eli', 'Fay']] }), 'Ana', 'Ben')
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Dee')
    expect(lineNames(s)).toEqual(['Eli', 'Fay'])
    s = fillCourts(win(s, 1, 'Ana'))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Ben', 'Eli|Fay'])
    expect(lineNames(s)).toEqual(['Cy', 'Dee'])
    expectConsistent(s)
    s = fillCourts(win(s, 1, 'Ana'))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Cy|Dee', 'Eli|Fay'])
    expect(lineNames(s)).toEqual(['Ana', 'Ben'])
    expectConsistent(s)
  })

  it('a winning pair plays the next two solos; a pair standing between them keeps its place', () => {
    let s = lock(createSession({ format: 'winners-split', courts: 1, names: NAMES.slice(0, 5), pairs: [['Fay', 'Gus']] }), 'Ana', 'Ben')
    s = fillCourts(s)
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Ben', 'Cy|Dee'])
    expect(lineNames(s)).toEqual(['Eli', 'Fay', 'Gus'])
    s = fillCourts(win(s, 1, 'Ben'))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Ben', 'Cy|Eli'])
    expect(lineNames(s)).toEqual(['Fay', 'Gus', 'Dee'])
    expectConsistent(s)
  })

  it('winning solos split up: each takes the next solo in line order, and a pair between them keeps its place', () => {
    let s = addPlayers(createSession({ format: 'winners-split', courts: 1, names: NAMES.slice(0, 5), pairs: [['Fay', 'Gus']] }), ['Hal'])
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Dee'))
    s = fillCourts(win(s, 1, 'Ana'))
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Eli', 'Cy|Hal'])
    expect(lineNames(s)).toEqual(['Fay', 'Gus', 'Ben', 'Dee'])
    expectConsistent(s)
  })

  it('when a pair is at the front of the line it plays the winning solos as they stand; the cap still applies', () => {
    const start = () => {
      let s = fillCourts(createSession({ format: 'winners-split', courts: 1, names: NAMES.slice(0, 4), pairs: [['Eli', 'Fay']] }))
      expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Cy', 'Ben|Dee'])
      s = fillCourts(win(s, 1, 'Ana'))
      expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Ana|Cy', 'Eli|Fay'])
      expect(lineNames(s)).toEqual(['Ben', 'Dee'])
      expectConsistent(s)
      return s
    }
    // The solos win again: 2 in a row, all four go off, losers first; the court refills from the front.
    let next = fillCourts(win(start(), 1, 'Cy'))
    expect(teamsNamed(next, onCourt(next, 1))).toEqual(['Ben|Dee', 'Eli|Fay'])
    expect(named(next, next.line)).toBe('Ana|Cy')
    expectConsistent(next)
    // The pair wins instead: it stays together and plays the next two solos.
    next = fillCourts(win(start(), 1, 'Eli'))
    expect(teamsNamed(next, onCourt(next, 1))).toEqual(['Ben|Dee', 'Eli|Fay'])
    expect(named(next, next.line)).toBe('Ana|Cy')
  })

  it.each(MIXES.map((m) => [mixLabel(m), m] as const))(
    '%s over many games: pairs stay together, nobody stays on after 2 wins in a row, nobody waits forever',
    (_label, m) => {
      for (const events of [false, true]) {
        if (events && m.solos < 6) continue
        let s = mixed('winners-split', m)
        const waits = new Map<string, number>()
        const state: { out?: string } = {}
        const stayed = new Map<number, Set<string>>()
        let seen = s.games.length
        for (let i = 0; i < 60; i++) {
          if (events) s = lockEvent(s, i, state)
          s = fillCourts(s)
          expectConsistent(s)
          expectFreeCourtsUnfillable(s)
          trackWaits(s, waits, s.games.length - seen)
          seen = s.games.length
          const live = playing(s)
          expect(live.length, `a game is on court (step ${i})`).toBeGreaterThan(0)
          const g = i % 4 === 3 ? live[live.length - 1] : live[0]
          const skipped = i % 7 === 6
          const [a, b] = score(i)
          const order = backOrder(s, g)
          s = skipped ? skipGame(s, g.id) : recordScore(s, g.id, a, b)
          expectConsistent(s)
          const stillOn = playersOf(g).filter((x) => byId(s, x).status === 'playing')
          if (skipped) expect(stillOn, 'after a skipped game everyone goes to the back').toEqual([])
          const prev = stayed.get(g.court) ?? new Set<string>()
          const winners = skipped ? [] : ((a > b ? g.teamA : g.teamB) as string[])
          const losers = skipped ? [] : playersOf(g).filter((x) => !winners.includes(x))
          if (winners.some((x) => prev.has(x))) {
            // A second win in a row: all four go off, losers first (unless the court was refilled straight away).
            if (!playing(s).some((x) => x.court === g.court)) {
              expect(s.line.slice(-4), 'a second win in a row sends all four to the back, losers first').toEqual([
                ...order.filter((x) => losers.includes(x)),
                ...order.filter((x) => winners.includes(x)),
              ])
            }
            stayed.set(g.court, new Set())
            continue
          }
          // Winners still on court stayed on. (A short line can send the losers straight back on as the next team.)
          const staying = new Set(winners.filter((x) => byId(s, x).status === 'playing'))
          for (const x of staying) {
            const partner = byId(s, x).partner
            if (partner !== undefined) expect(staying.has(partner), 'a winning pair stays together').toBe(true)
          }
          if (stillOn.length > 0) {
            const next = onCourt(s, g.court)
            for (const x of stillOn) expect(playersOf(next), 'whoever is still on plays the next game on that court').toContain(x)
          }
          stayed.set(g.court, staying)
        }
      }
    },
  )
})

// ---------- Skill groups and Winners vs Losers with locks ----------

describe('Skill groups and Winners vs Losers pick sides (SPEC §4)', () => {
  it("Skill groups: a pair's level is the higher of its partners'; a pair and two solos of that level make a group", () => {
    let s = createSession({
      format: 'skill-groups',
      courts: 1,
      names: [
        { name: 'Ana', level: 3 },
        { name: 'Ben', level: 1 },
        { name: 'Cy', level: 3 },
      ],
      pairs: [[{ name: 'Dee', level: 1 }, { name: 'Eli', level: 3 }]],
    })
    s = fillCourts(addPlayers(s, [{ name: 'Fay', level: 1 }]))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Cy')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Dee|Eli')
    expect(lineNames(s)).toEqual(['Ben', 'Fay'])
  })

  it("Skill groups: a pair whose level doesn't match is passed over and keeps its place", () => {
    let s = createSession({
      format: 'skill-groups',
      courts: 1,
      names: [
        { name: 'Ana', level: 2 },
        { name: 'Ben', level: 2 },
      ],
      pairs: [[{ name: 'Cy', level: 3 }, { name: 'Dee', level: 1 }]],
    })
    s = fillCourts(addPlayers(s, [{ name: 'Eli', level: 2 }, { name: 'Fay', level: 2 }]))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Eli'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Fay'))
    expect(lineNames(s)).toEqual(['Cy', 'Dee'])
  })

  /** Eight players, one court: Ana & Cy beat Ben & Dee, so Ana and Cy are winners, Ben and Dee losers. */
  const afterGameOne = () => {
    let s = fillCourts(createSession({ format: 'winners-losers', courts: 1, names: NAMES.slice(0, 8) }))
    s = win(s, 1, 'Ana')
    expect(lineNames(s)).toEqual(['Eli', 'Fay', 'Gus', 'Hal', 'Ana', 'Ben', 'Cy', 'Dee'])
    return s
  }

  it("Winners vs Losers: a pair whose partners' pools differ fits either pool", () => {
    let s = lock(afterGameOne(), 'Ana', 'Ben')
    s = fillCourts(s)
    expect(teamsNamed(s, onCourt(s, 1))).toEqual(['Eli|Gus', 'Fay|Hal'])
    s = fillCourts(win(s, 1, 'Eli'))
    // Line: Ana & Ben (either pool), Cy W, Dee L, Eli W, Fay L, Gus W, Hal L.
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Eli')
    expect(lineNames(s)).toEqual(['Dee', 'Fay', 'Gus', 'Hal'])
  })

  it('Winners vs Losers: a pair whose partners share a pool takes that pool', () => {
    let s = lock(afterGameOne(), 'Ben', 'Dee')
    expect(lineNames(s)).toEqual(['Eli', 'Fay', 'Gus', 'Hal', 'Ana', 'Cy', 'Ben', 'Dee'])
    s = fillCourts(s)
    s = fillCourts(win(s, 1, 'Eli'))
    // Line: Ana W, Cy W, Ben & Dee (L), Eli W, Fay L, Gus W, Hal L: the winners' pool plays.
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Eli'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy', 'Gus'))
    expect(lineNames(s)).toEqual(['Ben', 'Dee', 'Fay', 'Hal'])
  })

  for (const format of ['skill-groups', 'winners-losers'] as const) {
    it.each(MIXES.map((m) => [mixLabel(m), m] as const))(
      `${format}, %s over many games: the side waiting longest goes on when it can, nobody waits forever`,
      (_label, m) => {
        for (const levels of format === 'skill-groups' ? [undefined, MIXED_LEVELS] : [undefined]) {
          for (const events of [false, true]) {
            if (events && m.solos < 6) continue
            let s = mixed(format, m, levels)
            const waits = new Map<string, number>()
            const state: { out?: string } = {}
            let seen = s.games.length
            for (let i = 0; i < 60; i++) {
              if (events) s = lockEvent(s, i, state)
              const before = s
              s = fillCourts(s)
              expectConsistent(s)
              expectFrontGoesOn(before, s)
              expectFreeCourtsUnfillable(s)
              trackWaits(s, waits, s.games.length - seen)
              seen = s.games.length
              const live = playing(s)
              expect(live.length, `a game is on court (step ${i})`).toBeGreaterThan(0)
              const g = i % 4 === 3 ? live[live.length - 1] : live[0]
              const queue = [...s.line, ...backOrder(s, g)]
              s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, ...score(i))
              expect(s.line, 'everyone in the game goes to the back in the order they came on').toEqual(queue)
              expectConsistent(s)
            }
          }
        }
      },
    )
  }
})

// ---------- a pair's time out and removal ----------

describe('a time out, Back in line and Remove apply to the whole pair (SPEC §4 "Pair locks")', () => {
  /** Ana and Ben solo, Cy & Dee locked, Eli and Fay solo. */
  const mix = () => addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }), ['Eli', 'Fay'])

  it('a time out on either partner takes both out of the line', () => {
    for (const who of ['Cy', 'Dee']) {
      let s = timeOut(mix(), id(mix(), who))
      expect(status(s, 'Cy')).toBe('out')
      expect(status(s, 'Dee')).toBe('out')
      expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Eli', 'Fay'])
      s = fillCourts(s)
      expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Eli'))
      expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Fay'))
      expectConsistent(s)
    }
  })

  it('Back in line on either partner puts both at the back, in the order they joined', () => {
    let s = timeOut(mix(), id(mix(), 'Cy'))
    s = backInLine(s, id(s, 'Dee'))
    expect(status(s, 'Cy')).toBe('waiting')
    expect(status(s, 'Dee')).toBe('waiting')
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Eli', 'Fay', 'Cy', 'Dee'])
  })

  it('a pair on court can’t take a time out (not-waiting)', () => {
    const s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben']] }), ['Cy', 'Dee', 'Eli']))
    expectCode(() => timeOut(s, id(s, 'Ben')), 'not-waiting')
  })

  it('removing a waiting partner removes the pair from the line and the standings', () => {
    let s = mix()
    s = removePlayer(s, id(s, 'Cy'))
    expect(status(s, 'Cy')).toBe('removed')
    expect(status(s, 'Dee')).toBe('removed')
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Eli', 'Fay'])
    expect(standings(s).map((r) => r.name)).toEqual(['Ana', 'Ben', 'Eli', 'Fay'])
  })

  it('removing a pair on court cancels the game with no score; the other players go to the front in their order', () => {
    let s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }), ['Eli']))
    const g = onCourt(s, 1)
    expect(teamsNamed(s, g)).toEqual(['Ana|Ben', 'Cy|Dee'])
    s = removePlayer(s, id(s, 'Dee'))
    const cancelled = s.games.find((x) => x.id === g.id)!
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.scoreA).toBeUndefined()
    expect(status(s, 'Cy')).toBe('removed')
    expect(status(s, 'Dee')).toBe('removed')
    expect(lineNames(s)).toEqual(['Ana', 'Ben', 'Eli'])
    expect(status(s, 'Ana')).toBe('waiting')
  })

  it('removing a solo on court: the others go to the front in the order they came on, the pair kept together', () => {
    let s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, names: ['Ana', 'Ben'], pairs: [['Cy', 'Dee']] }), ['Eli']))
    s = removePlayer(s, id(s, 'Ana'))
    expect(lineNames(s)).toEqual(['Cy', 'Dee', 'Ben', 'Eli'])
    expect(partnerName(s, 'Cy')).toBe('Dee')
    expectConsistent(s)
  })
})

// ---------- Round Robin: all pairs or no pairs ----------

describe('Round Robin is all pairs or no pairs (SPEC §4 "Combinations"; user, 2026-11-23)', () => {
  const allPairs = () => createSession({ format: 'round-robin', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee'], ['Eli', 'Fay']] })

  it('all pairs: addPlayers is refused with needs-pair, leaving the session as it was', () => {
    const s = deepFreeze(fillCourts(allPairs()))
    expectCode(() => addPlayers(s, ['Zed']), 'needs-pair')
  })

  it('all pairs: a late pair joins with addPairs at the back, locked, and plays every other pair next', () => {
    let s = allPairs()
    for (let i = 0; i < 3; i++) {
      s = fillCourts(s)
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
    }
    s = addPairs(s, [['Gus', 'Hal']])
    expect(lineNames(s).slice(-2)).toEqual(['Gus', 'Hal'])
    expect(partnerName(s, 'Gus')).toBe('Hal')
    const opponents: string[] = []
    for (let i = 0; i < 3; i++) {
      s = fillCourts(s)
      const g = onCourt(s, 1)
      const teams = teamsNamed(s, g)
      expect(teams, `game ${i + 4} has Gus & Hal as one team`).toContain('Gus|Hal')
      opponents.push(teams.find((t) => t !== 'Gus|Hal')!)
      expectConsistent(s)
      s = recordScore(s, g.id, ...score(i))
    }
    expect(opponents.sort()).toEqual(['Ana|Ben', 'Cy|Dee', 'Eli|Fay'])
  })

  it('all pairs: no unlocking once it starts (bad-combo); every game is pair against pair', () => {
    let s = fillCourts(allPairs())
    expectCode(() => unlockPair(s, id(s, 'Cy')), 'bad-combo')
    for (let i = 0; i < 9; i++) {
      s = fillCourts(recordScore(s, onCourt(s, 1).id, ...score(i)))
      for (const t of [onCourt(s, 1).teamA, onCourt(s, 1).teamB]) expect(byId(s, t[0]).partner).toBe(t[1])
    }
  })

  it('no pairs: addPairs and lockPair are refused with bad-combo; addPlayers adds a solo player', () => {
    let s = deepFreeze(fillCourts(createSession({ format: 'round-robin', courts: 1, names: NAMES.slice(0, 6) })))
    expectCode(() => addPairs(s, [['Zed', 'Yan']]), 'bad-combo')
    expectCode(() => lockPair(s, s.line[0], s.line[1]), 'bad-combo')
    s = addPlayers(s, ['Zed'])
    expect(player(s, 'Zed').partner).toBeUndefined()
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
  })
})

// ---------- saving: version 3, and versions 2 and 1 ----------

type SaveData = { version: number; session: Record<string, unknown> & { players: Record<string, unknown>[] } }

/** A version 2 save, as T8.3–T8.8 wrote it with fixed pairs: Ana & Ben beat Eli & Fay, then play Cy & Dee. */
function v2Fixed(): SaveData {
  return {
    version: 2,
    session: {
      title: 'Friday Pairs',
      play: 'doubles',
      teams: 'fixed',
      format: 'winners-split',
      courts: 1,
      players: [
        { id: 'p1', name: 'Ana', status: 'playing', partner: 'p2' },
        { id: 'p2', name: 'Ben', status: 'playing', partner: 'p1' },
        { id: 'p3', name: 'Cy', status: 'playing', partner: 'p4', level: 2 },
        { id: 'p4', name: 'Dee', status: 'playing', partner: 'p3' },
        { id: 'p5', name: 'Eli', status: 'waiting', partner: 'p6' },
        { id: 'p6', name: 'Fay', status: 'waiting', partner: 'p5' },
        { id: 'p7', name: 'Gus', status: 'out', partner: 'p8' },
        { id: 'p8', name: 'Hal', status: 'out', partner: 'p7' },
      ],
      line: ['p5', 'p6'],
      games: [
        { id: 'g1', court: 1, teamA: ['p1', 'p2'], teamB: ['p5', 'p6'], status: 'scored', scoreA: 11, scoreB: 4 },
        { id: 'g2', court: 1, teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], status: 'playing' },
      ],
    },
  }
}

/** A version 2 save with an open queue (no partners). */
function v2Open(): SaveData {
  return {
    version: 2,
    session: {
      title: '',
      play: 'doubles',
      teams: 'open',
      format: 'fair',
      courts: 1,
      players: [
        { id: 'p1', name: 'Ana', status: 'playing' },
        { id: 'p2', name: 'Ben', status: 'playing' },
        { id: 'p3', name: 'Cy', status: 'playing', level: 3 },
        { id: 'p4', name: 'Dee', status: 'playing' },
        { id: 'p5', name: 'Eli', status: 'waiting' },
      ],
      line: ['p5'],
      games: [{ id: 'g1', court: 1, teamA: ['p1', 'p3'], teamB: ['p2', 'p4'], status: 'playing' }],
    },
  }
}

const withoutTeams = (session: Record<string, unknown>) => {
  const rest = { ...session }
  delete rest.teams
  return rest
}

describe('saving (SPEC §4 "Saving": version 3, no teams)', () => {
  /** Mid-play: solos and locked pairs, a pair on a time out, levels and a title. */
  function mixedMidPlay(): Session {
    let s = createSession({
      format: 'winners-split',
      courts: 2,
      title: 'Friday Night',
      names: [{ name: 'Ana', level: 3 }, 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'],
      pairs: [
        ['Gus', 'Hal'],
        ['Ida', { name: 'Jo', level: 1 }],
        ['Kit', 'Lu'],
      ],
    })
    for (let i = 0; i < 5; i++) {
      s = fillCourts(s)
      s = i % 3 === 2 ? skipGame(s, playing(s)[0].id) : recordScore(s, playing(s)[0].id, ...score(i))
    }
    s = fillCourts(s)
    const solos = solosWaiting(s)
    if (solos.length >= 2) s = lockPair(s, solos[0], solos[1])
    const pair = s.line.find((x) => byId(s, x).partner !== undefined)
    if (pair) s = timeOut(s, pair)
    return s
  }

  it('serialize writes version 3 and no teams', () => {
    const json = serialize(mixedMidPlay())
    expect(JSON.parse(json).version).toBe(3)
    expect(json).not.toContain('"teams"')
  })

  it('version 3 round trip: solos and locked pairs load back equal and play on the same', () => {
    const s = mixedMidPlay()
    expect(s.players.some((p) => p.partner !== undefined && p.status === 'out')).toBe(true)
    expect(s.players.some((p) => p.partner === undefined)).toBe(true)
    const loaded = deserialize(serialize(s))
    expect(loaded).toEqual(s)
    let a = loaded!
    let b = s
    for (let i = 0; i < 6; i++) {
      a = fillCourts(recordScore(a, playing(a)[0].id, ...score(i)))
      b = fillCourts(recordScore(b, playing(b)[0].id, ...score(i)))
      expect(a).toEqual(b)
      expectConsistent(a)
    }
  })

  it('a version 2 save with fixed pairs loads with its pairs locked, no teams, and carries on with the pairs together', () => {
    const s = deserialize(JSON.stringify(v2Fixed()))
    expect(s).not.toBeNull()
    expect(s).not.toHaveProperty('teams')
    expect(s).toEqual(withoutTeams(v2Fixed().session))
    expect(s!.players.map((p) => [p.name, p.partner])).toEqual([
      ['Ana', 'p2'],
      ['Ben', 'p1'],
      ['Cy', 'p4'],
      ['Dee', 'p3'],
      ['Eli', 'p6'],
      ['Fay', 'p5'],
      ['Gus', 'p8'],
      ['Hal', 'p7'],
    ])
    // Ana & Ben win a second game in a row: all four go off, losers first; Eli & Fay play Cy & Dee.
    const next = fillCourts(recordScore(s!, 'g2', 11, 6))
    expect(teamsNamed(next, onCourt(next, 1))).toEqual(['Cy|Dee', 'Eli|Fay'])
    expect(lineNames(next)).toEqual(['Ana', 'Ben'])
    expectConsistent(next)
    expect(JSON.parse(serialize(next)).version).toBe(3)
    expect(deserialize(serialize(next))).toEqual(next)
  })

  it('a version 2 save with an open queue loads with no locks and no teams', () => {
    const s = deserialize(JSON.stringify(v2Open()))
    expect(s).not.toBeNull()
    expect(s).not.toHaveProperty('teams')
    expect(s).toEqual(withoutTeams(v2Open().session))
    expect(s!.players.every((p) => p.partner === undefined)).toBe(true)
    expect(player(s!, 'Cy').level).toBe(3)
    const next = fillCourts(recordScore(s!, 'g1', 11, 8))
    expect(playing(next)).toHaveLength(1)
    expect(JSON.parse(serialize(next)).version).toBe(3)
  })

  it.each<[string, (d: SaveData) => void]>([
    ['fixed pairs in singles', (d) => ((d.session.play = 'singles'), (d.session.games = []), (d.session.format = 'fair'))],
    ['fixed pairs with Americano', (d) => (d.session.format = 'americano')],
    ['fixed pairs with Mexicano', (d) => (d.session.format = 'mexicano')],
    ['a fixed-pairs player without a partner', (d) => delete d.session.players[4].partner],
    ['partners that don’t point at each other', (d) => (d.session.players[4].partner = 'p7')],
    ['an unknown teams value', (d) => (d.session.teams = 'mixed')],
    ['no teams value', (d) => delete d.session.teams],
  ])('a version 2 save with %s is still refused', (_label, edit) => {
    const d = v2Fixed()
    edit(d)
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })

  it('a version 2 open-queue save with a partner on a player is refused (an open queue had no partners)', () => {
    const d = v2Open()
    d.session.players[4].partner = 'p1'
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })

  it('the untouched version 2 saves load', () => {
    expect(deserialize(JSON.stringify(v2Fixed()))).not.toBeNull()
    expect(deserialize(JSON.stringify(v2Open()))).not.toBeNull()
  })
})

describe('deserialize refuses version 3 locks the engine could never make', () => {
  /** On court: Ana & Ben against Cy and Dee; waiting: Eli, Fay, then Gus & Hal (locked). */
  const onCourtSave = (): SaveData & { session: { line: string[] } } => {
    let s = createSession({ format: 'fair', courts: 1, names: NAMES.slice(0, 8) })
    s = lock(lock(s, 'Ana', 'Ben'), 'Gus', 'Hal')
    s = fillCourts(s)
    expect(lineNames(s)).toEqual(['Eli', 'Fay', 'Gus', 'Hal'])
    return JSON.parse(serialize(s))
  }
  /** No games yet: Ana & Ben locked, four solos. */
  const idleSave = (): SaveData => JSON.parse(serialize(lock(six(), 'Ana', 'Ben')))
  const broken = <T>(make: () => T, edit: (d: T) => void) => {
    const d = make()
    edit(d)
    return deserialize(JSON.stringify(d))
  }

  it('accepts the untouched saves', () => {
    expect(broken(onCourtSave, () => {})).not.toBeNull()
    expect(broken(idleSave, () => {})).not.toBeNull()
  })

  it.each<[string, (d: ReturnType<typeof onCourtSave>) => void]>([
    ['a partner who is not a player', (d) => (d.session.players[6].partner = 'p99')],
    ['a lock on one side only', (d) => delete d.session.players[7].partner],
    ['partners that don’t point at each other', (d) => (d.session.players[6].partner = 'p5')],
    ['a player who is their own partner', (d) => (d.session.players[4].partner = 'p5')],
    ['partners with different statuses', (d) => ((d.session.players[7].status = 'out'), (d.session.line = ['p5', 'p6', 'p7']))],
    ['partners apart in the line', (d) => (d.session.line = ['p7', 'p5', 'p6', 'p8'])],
  ])('refuses %s', (_label, edit) => {
    expect(broken(onCourtSave, edit)).toBeNull()
  })

  it.each<[string, (d: SaveData) => void]>([
    ['a lock in singles', (d) => (d.session.play = 'singles')],
    ['a lock in Americano', (d) => (d.session.format = 'americano')],
    ['a lock in Mexicano', (d) => (d.session.format = 'mexicano')],
  ])('refuses %s', (_label, edit) => {
    expect(broken(idleSave, edit)).toBeNull()
  })

  it.each([4, 0, '3', 2.5, null])('refuses version %j instead of guessing', (version) => {
    const d = idleSave()
    d.version = version as number
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })
})
