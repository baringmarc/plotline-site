// T8.4 Four more formats: Mexicano, Skill groups, Winners vs Losers, and the shared rules (TASKS.md T8.4; SPEC §4
// "Paddle Stack rules": Formats, Combinations, Sides, Filling courts, Mexicano, Skill groups, Winners vs Losers;
// plan gate (user, 2026-11-18): Mexicano runs in rounds; Round Robin, Skill groups and Winners vs Losers are
// continuous; Winners vs Losers with a short pool takes the longest waiting from both pools; groups are built from the
// side waiting longest and keep line order on court, 1 & 3 against 2 & 4). Round Robin: engine.t84.roundrobin.test.ts.
//
// Names the tests rely on (the plan's):
// - types: `Format` gains 'round-robin' | 'mexicano' | 'skill-groups' | 'winners-losers';
// - engine: `isRoundFormat(format)`, and the existing API (`createSession`, `addPlayers`, `addPairs`, `setLevel`,
//   `timeOut`, `backInLine`, `removePlayer`, `fillCourts`, `recordScore`, `skipGame`, `standings`, `serialize`,
//   `deserialize`, `StackError` code `bad-combo`); saves are version 3 since T8.9.
// T8.9 (Teams removed): what was "fixed pairs" is a session whose players are all in locked pairs (`pairs`, no
// `names`); it must play as fixed pairs did. Mixed solos and pairs: engine.t89.test.ts.
//
// Team order: a team is compared as a set of players (which player is listed first inside a team is not a rule);
// which team is A is checked where SPEC names it (Mexicano: 1 & 4 is team A; groups: 1 & 3 is team A).
import { describe, expect, it } from 'vitest'
import {
  StackError,
  addPairs,
  addPlayers,
  backInLine,
  createSession,
  deserialize,
  fillCourts,
  isRoundFormat,
  recordScore,
  removePlayer,
  serialize,
  skipGame,
  standings,
  timeOut,
  type NewPlayer,
} from './engine'
import type { Format, Game, Level, Play, Session } from './types'

// ---------- helpers ----------

const NAMES = [
  'Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida',
  'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia', 'Quin', 'Ray',
]
const NEW_FORMATS: Format[] = ['round-robin', 'mexicano', 'skill-groups', 'winners-losers']

function id(s: Session, name: string): string {
  const p = s.players.find((x) => x.name === name)
  if (!p) throw new Error(`no player ${name}`)
  return p.id
}
const ids = (s: Session, ...ns: string[]) => ns.map((n) => id(s, n))
const nameOf = (s: Session, pid: string) => s.players.find((p) => p.id === pid)!.name
const set = (xs: readonly string[]) => [...xs].sort().join('|')
const named = (s: Session, xs: readonly string[]) => [...xs].map((x) => nameOf(s, x)).sort().join('|')

const playing = (s: Session) => s.games.filter((g) => g.status === 'playing')
const finished = (s: Session) => s.games.filter((g) => g.status === 'scored' || g.status === 'skipped')
const onCourt = (s: Session, court: number) => {
  const gs = playing(s).filter((g) => g.court === court)
  expect(gs, `one game on court ${court}`).toHaveLength(1)
  return gs[0]
}
const playersOf = (g: Game) => [...g.teamA, ...g.teamB]
const perCourt = (s: Session) => (s.play === 'singles' ? 2 : 4)
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

/** Mixed levels with wildcards (no level) in between. */
const MIXED: (Level | undefined)[] = [3, 1, undefined, 2, 3, 2, 1, undefined, 3, 1, 2, undefined, 2, 3, 1, 1, undefined, 2]

function people(n: number, levels?: (Level | undefined)[]): NewPlayer[] {
  return NAMES.slice(0, n).map((name, i) => (levels?.[i] !== undefined ? { name, level: levels[i] } : name))
}
function pairList(n: number, levels?: (Level | undefined)[]): [NewPlayer, NewPlayer][] {
  const ps = people(n * 2, levels)
  return Array.from({ length: n }, (_, i) => [ps[i * 2], ps[i * 2 + 1]] as [NewPlayer, NewPlayer])
}

/** `pairs`: `count` locked pairs and no solo players; otherwise `count` solo players. */
function make(
  format: Format,
  count: number,
  opts: { courts: number; play?: Play; pairs?: boolean; levels?: (Level | undefined)[] },
): Session {
  const play = opts.play ?? 'doubles'
  return opts.pairs
    ? createSession({ format, courts: opts.courts, play, pairs: pairList(count, opts.levels) })
    : createSession({ format, courts: opts.courts, play, names: people(count, opts.levels) })
}

/** Every player still in the session is in a locked pair (what fixed pairs were before T8.9). */
const allPaired = (s: Session) => {
  const active = s.players.filter((p) => p.status !== 'removed')
  return active.length > 0 && active.every((p) => p.partner !== undefined)
}

/**
 * Runs `assertion` only when `ok` is false: the same check and the same failure message, without an `expect` call
 * on every pass. The many-games sweeps make about 100,000 of these checks, and `expect` itself was most of their
 * time (T1.15), which pushed them past Vitest's 5 s limit under load.
 */
function unless(ok: boolean, assertion: () => void) {
  if (!ok) assertion()
}

/** Every active player is in the line or on court exactly once, each game has the right number a side. */
function expectConsistent(s: Session) {
  const perSide = s.play === 'singles' ? 1 : 2
  const on = playing(s).flatMap(playersOf)
  unless(new Set(on).size === on.length, () => expect(new Set(on).size).toBe(on.length))
  unless(new Set(s.line).size === s.line.length, () => expect(new Set(s.line).size).toBe(s.line.length))
  for (const p of s.players) {
    const inLine = s.line.includes(p.id)
    const isOn = on.includes(p.id)
    if (p.status === 'waiting') unless(inLine && !isOn, () => expect(inLine && !isOn, `${p.name} waiting`).toBe(true))
    else if (p.status === 'playing') unless(isOn && !inLine, () => expect(isOn && !inLine, `${p.name} playing`).toBe(true))
    else unless(!(inLine || isOn), () => expect(inLine || isOn, `${p.name} ${p.status}`).toBe(false))
  }
  for (const g of s.games) {
    unless(g.teamA.length === perSide, () => expect(g.teamA).toHaveLength(perSide))
    unless(g.teamB.length === perSide, () => expect(g.teamB).toHaveLength(perSide))
  }
  if (allPaired(s)) {
    unless(!('teams' in s), () => expect(s).not.toHaveProperty('teams'))
    const partnerOf = (pid: string) => s.players.find((p) => p.id === pid)!.partner
    const still = (pid: string) => s.players.find((p) => p.id === pid)!.status !== 'removed'
    for (const g of s.games)
      for (const t of [g.teamA, g.teamB])
        if (still(t[0])) unless(partnerOf(t[0]) === t[1], () => expect(partnerOf(t[0])).toBe(t[1]))
    for (let i = 0; i < s.line.length; i += 2)
      unless(partnerOf(s.line[i]) === s.line[i + 1], () => expect(partnerOf(s.line[i])).toBe(s.line[i + 1]))
  }
}

interface Expected {
  court: number
  a: string[]
  b: string[]
}

/** The games fillCourts just started match `expected` (court, team A, team B); old games are untouched; the
 * line is the old line without the players who went on, in the same order. */
function expectFill(before: Session, after: Session, expected: Expected[]) {
  expect(after.games.slice(0, before.games.length)).toEqual(before.games)
  const fresh = after.games.slice(before.games.length)
  expect(
    fresh.map((g) => ({ court: g.court, a: named(after, g.teamA), b: named(after, g.teamB), status: g.status })),
  ).toEqual(expected.map((e) => ({ court: e.court, a: named(after, e.a), b: named(after, e.b), status: 'playing' })))
  const went = new Set(fresh.flatMap(playersOf))
  expect(after.line).toEqual(before.line.filter((x) => !went.has(x)))
  expectConsistent(after)
}

// ---------- group formats: a reference for SPEC's group rule ----------

/** The line read as sides: a player, or (all locked pairs) the two partners standing together. */
function lineSides(s: Session): string[][] {
  if (!allPaired(s)) return s.line.map((x) => [x])
  return Array.from({ length: s.line.length / 2 }, (_, i) => [s.line[i * 2], s.line[i * 2 + 1]])
}

/** A side's skill level: a fixed pair takes the higher of its partners' levels; none if neither has one. */
function levelOf(s: Session, side: string[]): Level | undefined {
  const levels = side.map((x) => s.players.find((p) => p.id === x)!.level).filter((l): l is Level => l !== undefined)
  return levels.length ? (Math.max(...levels) as Level) : undefined
}

/** A side's pool: the result of its last scored game (skipped games don't count); none before its first. */
function poolOf(s: Session, side: string[]): 'W' | 'L' | undefined {
  const scored = s.games.filter((g) => g.status === 'scored' && playersOf(g).includes(side[0]))
  const last = scored[scored.length - 1]
  if (!last) return undefined
  const aWon = last.scoreA! > last.scoreB!
  return (last.teamA as string[]).includes(side[0]) === aWon ? 'W' : 'L'
}

/**
 * SPEC's group rule (Skill groups; Winners vs Losers with the pool in place of the level): walking the line from
 * the side waiting longest, take each side whose key matches the group's, or that has none, until the court is
 * full; the group's key is the first key taken. If the line can't fill a group that way, take the sides at the front
 * of the line. Players keep line order on court: 1 & 3 against 2 & 4 (pairs: pair against pair; singles 1 against 2).
 */
function expectedGroups<K>(s: Session, keyOf: (side: string[]) => K | undefined): Expected[] {
  const sideSize = allPaired(s) ? 2 : 1
  const need = perCourt(s) / sideSize
  let sides = lineSides(s)
  const out: Expected[] = []
  for (const court of freeCourts(s)) {
    if (sides.length < need) break
    let groupKey: K | undefined
    let taken: string[][] = []
    for (const side of sides) {
      const k = keyOf(side)
      if (k === undefined || groupKey === undefined || k === groupKey) {
        taken.push(side)
        if (groupKey === undefined && k !== undefined) groupKey = k
        if (taken.length === need) break
      }
    }
    if (taken.length < need) taken = sides.slice(0, need)
    const p = taken.flat()
    const [a, b] =
      s.play === 'singles' ? [[p[0]], [p[1]]] : sideSize === 2 ? [taken[0], taken[1]] : [[p[0], p[2]], [p[1], p[3]]]
    out.push({ court, a, b })
    sides = sides.filter((x) => !taken.includes(x))
  }
  return out
}

/** Lineups and events to play many games through. */
type Config = { label: string; count: number; courts: number; play: Play; pairs: boolean }
const COURTS = [1, 2, 3]
const DOUBLES: Config[] = [4, 5, 9, 17].flatMap((n) =>
  COURTS.map((c) => ({ label: `${n} players, ${c} court(s), doubles`, count: n, courts: c, play: 'doubles' as Play, pairs: false })),
)
const SINGLES: Config[] = [2, 3, 7].flatMap((n) =>
  COURTS.map((c) => ({ label: `${n} players, ${c} court(s), singles`, count: n, courts: c, play: 'singles' as Play, pairs: false })),
)
const FIXED: Config[] = [2, 3, 5, 8].flatMap((n) =>
  COURTS.map((c) => ({ label: `${n} locked pairs, ${c} court(s)`, count: n, courts: c, play: 'doubles' as Play, pairs: true })),
)

/**
 * Plays `games` games on a continuous format: each step fills the courts (checked against `expected`), then ends
 * one game (the oldest, or sometimes the newest; every fifth is skipped). With `events`, a side joins, takes a time
 * out, comes back and someone on court is removed along the way.
 */
function playContinuous(
  start: Session,
  games: number,
  expected: (s: Session) => Expected[],
  opts: { events?: boolean } = {},
): Session {
  let s = start
  let outId: string | undefined
  for (let i = 0; i < games; i++) {
    if (opts.events) {
      if (i === 8) s = allPaired(s) ? addPairs(s, [['Zed', 'Yan']]) : addPlayers(s, ['Zed'])
      if (i === 16 && s.line.length > 0) {
        outId = s.line[0]
        s = timeOut(s, outId)
      }
      if (i === 24 && outId) s = backInLine(s, outId)
      if (i === 32 && playing(s).length > 0) s = removePlayer(s, playing(s)[0].teamA[0])
    }
    const before = s
    s = fillCourts(s)
    expectFill(before, s, expected(before))
    const live = playing(s)
    expect(live.length, `a game is on court after filling (step ${i})`).toBeGreaterThan(0)
    const g = i % 4 === 3 ? live[live.length - 1] : live[0]
    s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, ...score(i))
    expectConsistent(s)
  }
  return s
}

// ---------- formats and combinations ----------

describe('formats (T8.4: seven formats; round formats are Americano and Mexicano)', () => {
  it('isRoundFormat is true for Americano and Mexicano only', () => {
    expect(isRoundFormat('americano')).toBe(true)
    expect(isRoundFormat('mexicano')).toBe(true)
    for (const f of ['fair', 'winners-split', 'round-robin', 'skill-groups', 'winners-losers'] as Format[]) {
      expect(isRoundFormat(f), f).toBe(false)
    }
  })

  it.each(NEW_FORMATS)('createSession accepts %s and keeps the format', (format) => {
    const s = make(format, 4, { courts: 1 })
    expect(s.format).toBe(format)
    expect(s.players).toHaveLength(4)
  })

  it('an unknown format is still refused with bad-format', () => {
    expectCode(() => createSession({ format: 'swiss' as Format, courts: 1, names: people(4) }), 'bad-format')
  })
})

describe('combinations (T8.4: bad-combo)', () => {
  it('Mexicano (changing partners) is not offered with locked pairs', () => {
    expectCode(() => createSession({ format: 'mexicano', courts: 1, pairs: pairList(2) }), 'bad-combo')
  })

  it.each(NEW_FORMATS)('locked pairs are not offered in singles (%s)', (format) => {
    expectCode(() => createSession({ format, courts: 1, play: 'singles', pairs: pairList(2) }), 'bad-combo')
  })

  it('Mexicano works in singles and open doubles', () => {
    expect(make('mexicano', 4, { courts: 1, play: 'singles' }).play).toBe('singles')
    expect(make('mexicano', 4, { courts: 1, play: 'doubles' }).play).toBe('doubles')
  })

  it.each<Format>(['round-robin', 'skill-groups', 'winners-losers'])(
    '%s works in singles, doubles with no locks and doubles with every player locked in a pair',
    (format) => {
      const singles = make(format, 3, { courts: 1, play: 'singles' })
      const open = make(format, 4, { courts: 1 })
      const fixed = make(format, 2, { courts: 1, pairs: true })
      expect([singles.play, allPaired(singles)]).toEqual(['singles', false])
      expect([open.play, allPaired(open)]).toEqual(['doubles', false])
      expect([fixed.play, allPaired(fixed)]).toEqual(['doubles', true])
    },
  )
})

describe('continuous formats refill a court while others play (T8.4 plan gate)', () => {
  it.each<Format>(['round-robin', 'skill-groups', 'winners-losers'])('%s: a free court is filled while court 2 plays', (format) => {
    // Singles, 6 players, 2 courts: after one game ends there are 4 waiting.
    let s = fillCourts(make(format, 6, { courts: 2, play: 'singles' }))
    expect(playing(s)).toHaveLength(2)
    const court2 = onCourt(s, 2)
    s = recordScore(s, onCourt(s, 1).id, 11, 4)
    s = fillCourts(s)
    // Round Robin: round 1's third pairing is still free to start.
    expect(onCourt(s, 1).status).toBe('playing')
    expect(onCourt(s, 2)).toEqual(court2)
  })
})

// ---------- Mexicano ----------

/** SPEC's Mexicano round: who plays (fewest turns, then line order), then their order (levels in the first round,
 * standings after), taken four (two) at a time: 1 & 4 against 2 & 3 (singles 1 against 2), courts lowest first. */
function expectedMexicano(s: Session): Expected[] {
  if (playing(s).length > 0) return []
  const n = perCourt(s)
  const courts = Math.min(s.courts, Math.floor(s.line.length / n))
  if (courts === 0) return []
  const turns = new Map<string, number>()
  for (const g of finished(s)) for (const x of playersOf(g)) turns.set(x, (turns.get(x) ?? 0) + 1)
  const pos = new Map(s.line.map((x, i) => [x, i]))
  const chosen = [...s.line]
    .sort((a, b) => (turns.get(a) ?? 0) - (turns.get(b) ?? 0) || pos.get(a)! - pos.get(b)!)
    .slice(0, courts * n)
  const anyScored = s.games.some((g) => g.status === 'scored')
  const level = (x: string) => s.players.find((p) => p.id === x)!.level ?? 2
  const place = new Map(standings(s).map((r) => [r.playerId, r.place]))
  const ordered = [...chosen].sort((a, b) =>
    anyScored ? place.get(a)! - place.get(b)! || pos.get(a)! - pos.get(b)! : level(b) - level(a) || pos.get(a)! - pos.get(b)!,
  )
  const out: Expected[] = []
  for (let c = 0; c < courts; c++) {
    const g = ordered.slice(c * n, c * n + n)
    out.push(n === 2 ? { court: c + 1, a: [g[0]], b: [g[1]] } : { court: c + 1, a: [g[0], g[3]], b: [g[1], g[2]] })
  }
  return out
}

/** Plays `rounds` Mexicano rounds, checking each round against SPEC and that nothing starts mid-round. */
function playMexicano(start: Session, rounds: number, each?: (s: Session, round: number) => void): Session {
  let s = start
  let k = 0
  for (let r = 0; r < rounds; r++) {
    const before = s
    s = fillCourts(s)
    expectFill(before, s, expectedMexicano(before))
    expect(playing(s).length, `round ${r + 1} started`).toBeGreaterThan(0)
    while (playing(s).length > 0) {
      const g = playing(s)[k % 2 === 0 ? 0 : playing(s).length - 1]
      s = k % 7 === 6 ? skipGame(s, g.id) : recordScore(s, g.id, ...score(k))
      k++
      if (playing(s).length > 0) {
        const mid = fillCourts(s)
        expect(mid.games, 'no game starts until the round is over').toEqual(s.games)
      }
    }
    expectConsistent(s)
    each?.(s, r)
  }
  return s
}

describe('Mexicano: who plays a round (T8.4: like Americano)', () => {
  it('a round uses min(courts, floor(available / 4)) courts; those who sit out keep their place in line', () => {
    const start = make('mexicano', 9, { courts: 3 })
    const s = fillCourts(start)
    expect(playing(s)).toHaveLength(2)
    expect(s.line).toEqual(ids(s, 'Ida'))
  })

  it('starts a new round only when no game is on any court', () => {
    let s = fillCourts(make('mexicano', 8, { courts: 2 }))
    s = recordScore(s, onCourt(s, 1).id, 11, 5)
    const again = fillCourts(s)
    expect(again.games).toEqual(s.games)
    expect(playing(again)).toHaveLength(1)
  })

  it('the round is chosen by fewest turns, then line order, even over a higher level', () => {
    // 9 players, Ida (level 3) is last in line: round 1 takes the first 8 by line order.
    const s = fillCourts(make('mexicano', 9, { courts: 2, levels: [1, 1, 1, 1, 1, 1, 1, 1, 3] }))
    expect(s.line).toEqual(ids(s, 'Ida'))
    // Round 2: Ida has the fewest turns and plays.
    let t = s
    for (const g of playing(t)) t = recordScore(t, g.id, 11, 3)
    t = fillCourts(t)
    expect(playing(t).flatMap(playersOf)).toContain(id(t, 'Ida'))
  })

  it('out players are not available: they neither play nor count', () => {
    let s = make('mexicano', 5, { courts: 2 })
    s = timeOut(s, id(s, 'Ana'))
    s = fillCourts(s)
    expect(playing(s)).toHaveLength(1)
    expect(playing(s).flatMap(playersOf)).not.toContain(id(s, 'Ana'))
  })
})

describe('Mexicano: the first round is seeded by skill level, then line order (T8.4)', () => {
  it('level 3 first, no level counts as 2, then line order; groups of four play 1 & 4 against 2 & 3', () => {
    // Ana 1, Ben 3, Cy none, Dee 2, Eli 3, Fay none, Gus 1, Hal 2
    // → Ben, Eli | Cy, Dee, Fay, Hal | Ana, Gus
    const start = make('mexicano', 8, { courts: 2, levels: [1, 3, undefined, 2, 3, undefined, 1, 2] })
    const s = fillCourts(start)
    const c1 = onCourt(s, 1)
    const c2 = onCourt(s, 2)
    expect(named(s, c1.teamA)).toBe('Ben|Dee')
    expect(named(s, c1.teamB)).toBe('Cy|Eli')
    expect(named(s, c2.teamA)).toBe('Fay|Gus')
    expect(named(s, c2.teamB)).toBe('Ana|Hal')
  })

  it('with no levels the first round goes by line order: 1 & 4 against 2 & 3', () => {
    const s = fillCourts(make('mexicano', 8, { courts: 2 }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Dee')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Cy')
    expect(named(s, onCourt(s, 2).teamA)).toBe('Eli|Hal')
    expect(named(s, onCourt(s, 2).teamB)).toBe('Fay|Gus')
  })

  it('singles: by level, two at a time, 1 against 2', () => {
    const s = fillCourts(make('mexicano', 4, { courts: 2, play: 'singles', levels: [1, 3, undefined, 3] }))
    // Ben 3, Dee 3, Cy (2), Ana 1
    expect([named(s, onCourt(s, 1).teamA), named(s, onCourt(s, 1).teamB)]).toEqual(['Ben', 'Dee'])
    expect([named(s, onCourt(s, 2).teamA), named(s, onCourt(s, 2).teamB)]).toEqual(['Cy', 'Ana'])
  })

  it('a round of only skipped games is not "scored": the next round is still seeded by level', () => {
    // Ana 3, Ben 3, Cy 2, Dee 1 → Ana & Dee against Ben & Cy.
    let s = fillCourts(make('mexicano', 4, { courts: 1, levels: [3, 3, 2, 1] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Dee')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Cy')
    s = skipGame(s, onCourt(s, 1).id)
    // The line is now in came-on order, which differs from level order; level order must win again.
    const before = s
    s = fillCourts(s)
    expectFill(before, s, expectedMexicano(before))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Dee')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Cy')
  })
})

describe('Mexicano: later rounds pair from the live standings (T8.4)', () => {
  it('after a scored round, places 1 & 4 play 2 & 3 in each group of four', () => {
    let s = fillCourts(make('mexicano', 8, { courts: 2 }))
    // Court 1: Ana & Dee beat Ben & Cy 11–3 (+8). Court 2: Fay & Gus beat Eli & Hal 11–4 (+7).
    s = recordScore(s, onCourt(s, 1).id, 11, 3)
    s = recordScore(s, onCourt(s, 2).id, 4, 11)
    const places = new Map(standings(s).map((r) => [r.name, r.place]))
    expect(places.get('Ana')).toBe(1)
    expect(places.get('Fay')).toBe(3)
    expect(places.get('Eli')).toBe(5)
    expect(places.get('Ben')).toBe(7)
    const before = s
    s = fillCourts(s)
    expectFill(before, s, expectedMexicano(before))
    // Court 1 is places 1–4 (Ana, Dee, Fay, Gus): the two leaders are split up, each with one of Fay and Gus.
    const c1 = onCourt(s, 1)
    expect(named(s, playersOf(c1))).toBe('Ana|Dee|Fay|Gus')
    expect(named(s, c1.teamA).split('|').filter((n) => n === 'Ana' || n === 'Dee')).toHaveLength(1)
    expect(named(s, playersOf(onCourt(s, 2)))).toBe('Ben|Cy|Eli|Hal')
  })

  it('singles: after a scored round, place 1 plays place 2 and 3 plays 4', () => {
    let s = fillCourts(make('mexicano', 4, { courts: 2, play: 'singles' }))
    // Ana beats Ben 11–2, Cy beats Dee 11–9.
    s = recordScore(s, onCourt(s, 1).id, 11, 2)
    s = recordScore(s, onCourt(s, 2).id, 11, 9)
    s = fillCourts(s)
    expect(named(s, playersOf(onCourt(s, 1)))).toBe('Ana|Cy')
    expect(named(s, playersOf(onCourt(s, 2)))).toBe('Ben|Dee')
  })

  it('after a game everyone goes to the back of the line in the order they came on', () => {
    let s = fillCourts(make('mexicano', 5, { courts: 1, play: 'singles' }))
    const g = onCourt(s, 1)
    s = recordScore(s, g.id, 11, 6)
    expect(s.line.slice(-2)).toEqual([g.teamA[0], g.teamB[0]])
  })
})

describe('Mexicano over many rounds (T8.4: fairness — turns never differ by more than one)', () => {
  const configs = [...DOUBLES, ...SINGLES]
  it.each(configs.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    for (const levels of [undefined, MIXED]) {
      const start = make('mexicano', c.count, { courts: c.courts, play: c.play, levels })
      playMexicano(start, 20, (s) => {
        const turns = s.players.map((p) => finished(s).filter((g) => playersOf(g).includes(p.id)).length)
        expect(Math.max(...turns) - Math.min(...turns), 'nobody waits more than one game longer than anyone else').toBeLessThanOrEqual(1)
      })
    }
  })
})

// ---------- Skill groups ----------

const skillGroups = (s: Session) => expectedGroups(s, (side) => levelOf(s, side))

describe('Skill groups: building a group (T8.4)', () => {
  it('from the side waiting longest, it takes the same level or no level, keeping line order: 1 & 3 against 2 & 4', () => {
    // Ana 3, Ben 1, Cy 3, Dee none, Eli 1, Fay 3, Gus 1
    const start = make('skill-groups', 7, { courts: 1, levels: [3, 1, 3, undefined, 1, 3, 1] })
    const s = fillCourts(start)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Dee')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Fay')
    expect(s.line).toEqual(ids(s, 'Ben', 'Eli', 'Gus'))
  })

  it("a front side with no level doesn't set the group's level: the first level taken does", () => {
    // Ana none, Ben 1, Cy 3, Dee 1, Eli 1 → Ana, Ben (level 1), Dee, Eli
    const s = fillCourts(make('skill-groups', 5, { courts: 1, levels: [undefined, 1, 3, 1, 1] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Dee')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Eli')
    expect(s.line).toEqual(ids(s, 'Cy'))
  })

  it("when the line can't fill a group, the court takes the front of the line, whatever the levels", () => {
    // Ana 3 is the only level 3: the court takes Ana, Ben, Cy, Dee.
    const s = fillCourts(make('skill-groups', 5, { courts: 1, levels: [3, 1, 2, 1, 2] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Cy')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ben|Dee')
    expect(s.line).toEqual(ids(s, 'Eli'))
  })

  it('with no levels at all it plays exactly like Fair rotation', () => {
    for (const [n, courts] of [[5, 1], [9, 2], [17, 3]] as const) {
      let a = make('skill-groups', n, { courts })
      let b = make('fair', n, { courts })
      for (let i = 0; i < 40; i++) {
        a = fillCourts(a)
        b = fillCourts(b)
        expect(a.games.map((g) => [g.court, set(g.teamA), set(g.teamB)])).toEqual(b.games.map((g) => [g.court, set(g.teamA), set(g.teamB)]))
        expect(a.line).toEqual(b.line)
        const ga = playing(a)[0]
        const gb = playing(b)[0]
        a = recordScore(a, ga.id, ...score(i))
        b = recordScore(b, gb.id, ...score(i))
      }
    }
  })

  it('two free courts: court 1 builds its group first, court 2 builds from what is left', () => {
    // Ana 1, Ben 2, Cy 1, Dee 2, Eli 1, Fay 2, Gus 1, Hal 2
    const start = make('skill-groups', 8, { courts: 2, levels: [1, 2, 1, 2, 1, 2, 1, 2] })
    const s = fillCourts(start)
    expect(named(s, playersOf(onCourt(s, 1)))).toBe('Ana|Cy|Eli|Gus')
    expect(named(s, playersOf(onCourt(s, 2)))).toBe('Ben|Dee|Fay|Hal')
    expectFill(start, s, skillGroups(start))
  })

  it('singles: the next 2 from the same level, 1 against 2', () => {
    const s = fillCourts(make('skill-groups', 3, { courts: 1, play: 'singles', levels: [2, 1, 2] }))
    expect([named(s, onCourt(s, 1).teamA), named(s, onCourt(s, 1).teamB)]).toEqual(['Ana', 'Cy'])
    expect(s.line).toEqual(ids(s, 'Ben'))
  })

  it("locked pairs: a pair's level is the higher of its partners'; pair against pair in line order", () => {
    // Pairs: Ana 1 + Ben 3 (3), Cy 1 + Dee 1 (1), Eli 3 + Fay none (3), Gus + Hal none (none)
    const start = make('skill-groups', 4, { courts: 1, pairs: true, levels: [1, 3, 1, 1, 3, undefined] })
    const s = fillCourts(start)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Eli|Fay')
    expect(s.line).toEqual(ids(s, 'Cy', 'Dee', 'Gus', 'Hal'))
  })

  it('a locked pair with no level fits any group', () => {
    // Pairs: Ana 2 + Ben 2 (2), Cy 1 + Dee 1 (1), Eli + Fay none
    const s = fillCourts(make('skill-groups', 3, { courts: 1, pairs: true, levels: [2, 2, 1, 1] }))
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Eli|Fay')
  })

  it('after a game everyone goes to the back of the line in the order they came on', () => {
    let s = fillCourts(make('skill-groups', 6, { courts: 1 }))
    const g = onCourt(s, 1)
    s = recordScore(s, g.id, 11, 7)
    expect(s.line.slice(-4)).toEqual([g.teamA[0], g.teamB[0], g.teamA[1], g.teamB[1]])
  })
})

describe('Skill groups over many games (T8.4: no levels, mixed levels and wildcard players)', () => {
  const levelSets: [string, (Level | undefined)[] | undefined][] = [
    ['no levels', undefined],
    ['mixed levels with wildcards', MIXED],
    ['every player levelled', [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]],
  ]
  const configs = [...DOUBLES, ...SINGLES, ...FIXED]
  it.each(configs.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    for (const [, levels] of levelSets) {
      for (const events of [false, true]) {
        const start = make('skill-groups', c.count, { courts: c.courts, play: c.play, pairs: c.pairs, levels })
        playContinuous(start, 60, skillGroups, { events })
      }
    }
  })

  it('nobody waits forever: the side waiting longest goes on the next free court', () => {
    // A lone level-3 player among level-1 players still gets on as soon as they reach the front.
    let s = make('skill-groups', 9, { courts: 1, levels: [1, 1, 1, 1, 1, 1, 1, 1, 3] })
    let waited = 0
    for (let i = 0; i < 20; i++) {
      const front = s.line[0]
      s = fillCourts(s)
      expect(playersOf(onCourt(s, 1))).toContain(front)
      if (!playersOf(onCourt(s, 1)).includes(id(s, 'Ida'))) waited++
      else break
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
    }
    expect(waited, 'Ida plays within the games it takes to reach the front').toBeLessThanOrEqual(8)
  })
})

// ---------- Winners vs Losers ----------

const winnersLosers = (s: Session) => expectedGroups(s, (side) => poolOf(s, side))

describe('Winners vs Losers: pools (T8.4)', () => {
  it('winners queue to play winners and losers to play losers; no scored game yet fits either pool', () => {
    let s = fillCourts(make('winners-losers', 6, { courts: 1 }))
    // Game 1: Ana & Cy beat Ben & Dee.
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Cy')
    s = recordScore(s, onCourt(s, 1).id, 11, 6)
    expect(s.line).toEqual(ids(s, 'Eli', 'Fay', 'Ana', 'Ben', 'Cy', 'Dee'))
    // Game 2: Eli and Fay fit any pool; Ana (winner) sets it; Ben (loser) is passed over; Cy (winner).
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Eli')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Fay')
    expect(s.line).toEqual(ids(s, 'Ben', 'Dee'))
    // Eli & Ana beat Fay & Cy: line Ben L, Dee L, Eli W, Fay L, Ana W, Cy L.
    s = recordScore(s, onCourt(s, 1).id, 11, 5)
    s = fillCourts(s)
    // Game 3: losers from the front: Ben, Dee, Fay, Cy.
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ben|Fay')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Cy|Dee')
    expect(s.line).toEqual(ids(s, 'Eli', 'Ana'))
  })

  it('a short pool: the court takes the longest waiting from both pools', () => {
    // 5 players: game 1 Ana & Cy beat Ben & Dee; line Eli, Ana(W), Ben(L), Cy(W), Dee(L).
    let s = fillCourts(make('winners-losers', 5, { courts: 1 }))
    s = recordScore(s, onCourt(s, 1).id, 11, 2)
    // Eli (none), Ana (W), Cy (W) — only 3 in the winners' pool, so the front 4 go on: Eli, Ana, Ben, Cy.
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ben|Eli')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Ana|Cy')
    expect(s.line).toEqual(ids(s, 'Dee'))
  })

  it('a skipped game leaves the pool as it was (the last scored game counts)', () => {
    // Singles, 3 players: Ana beats Ben; then Cy vs Ana is skipped; Ana stays a winner, Cy fits any pool.
    let s = fillCourts(make('winners-losers', 3, { courts: 1, play: 'singles' }))
    s = recordScore(s, onCourt(s, 1).id, 11, 4)
    expect(s.line).toEqual(ids(s, 'Cy', 'Ana', 'Ben'))
    s = fillCourts(s)
    expect(named(s, playersOf(onCourt(s, 1)))).toBe('Ana|Cy')
    s = skipGame(s, onCourt(s, 1).id)
    expect(s.line).toEqual(ids(s, 'Ben', 'Cy', 'Ana'))
    expect(poolOf(s, [id(s, 'Ana')])).toBe('W')
    // Ben (L) sets the pool; Cy (none) fits it. Ana waits.
    const before = s
    s = fillCourts(s)
    expectFill(before, s, winnersLosers(before))
    expect(named(s, playersOf(onCourt(s, 1)))).toBe('Ben|Cy')
  })

  it('locked pairs: the pair is the side and its last result is its pool', () => {
    // Pairs Ana+Ben, Cy+Dee, Eli+Fay, Gus+Hal. Game 1: Ana+Ben beat Cy+Dee.
    let s = fillCourts(make('winners-losers', 4, { courts: 1, pairs: true }))
    s = recordScore(s, onCourt(s, 1).id, 11, 8)
    // Line: Eli+Fay, Gus+Hal, Ana+Ben (W), Cy+Dee (L). Fresh pairs fit any pool: Eli+Fay vs Gus+Hal.
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Eli|Fay')
    // Gus+Hal win: line Ana+Ben (W), Cy+Dee (L), Eli+Fay (L), Gus+Hal (W).
    s = recordScore(s, onCourt(s, 1).id, 3, 11)
    s = fillCourts(s)
    expect(named(s, onCourt(s, 1).teamA)).toBe('Ana|Ben')
    expect(named(s, onCourt(s, 1).teamB)).toBe('Gus|Hal')
  })

  it('pools come from scored games only, in open doubles each player by their own last result', () => {
    let s = fillCourts(make('winners-losers', 8, { courts: 2 }))
    s = recordScore(s, onCourt(s, 1).id, 11, 3)
    s = recordScore(s, onCourt(s, 2).id, 7, 11)
    const before = s
    s = fillCourts(s)
    expectFill(before, s, winnersLosers(before))
    // Each court is all winners or all losers.
    for (const c of [1, 2]) {
      const pools = new Set(playersOf(onCourt(s, c)).map((x) => poolOf(before, [x])))
      expect(pools.size, `court ${c} is one pool`).toBe(1)
    }
  })
})

describe('Winners vs Losers over many games (T8.4, incl. a short pool)', () => {
  const configs = [...DOUBLES, ...SINGLES, ...FIXED]
  it.each(configs.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    for (const events of [false, true]) {
      const start = make('winners-losers', c.count, { courts: c.courts, play: c.play, pairs: c.pairs })
      playContinuous(start, 60, winnersLosers, { events })
    }
  })

  it('the side waiting longest always goes on the next free court', () => {
    let s = make('winners-losers', 9, { courts: 2 })
    for (let i = 0; i < 60; i++) {
      const free = freeCourts(s)
      const front = s.line[0]
      const before = s
      s = fillCourts(s)
      if (free.length > 0 && before.line.length >= 4) {
        const fresh = s.games.slice(before.games.length)
        expect(fresh.length).toBeGreaterThan(0)
        expect(playersOf(fresh[0])).toContain(front)
      }
      s = recordScore(s, playing(s)[0].id, ...score(i))
    }
  })
})

// ---------- purity and saving ----------

describe('the new formats never mutate their input (T8.4)', () => {
  it.each(NEW_FORMATS)('%s: fillCourts, recordScore and skipGame on a frozen session', (format) => {
    const s = deepFreeze(make(format, 9, { courts: 2, levels: MIXED }))
    const snapshot = JSON.stringify(s)
    const filled = deepFreeze(fillCourts(s))
    expect(JSON.stringify(s)).toBe(snapshot)
    const g = playing(filled)[0]
    expect(() => recordScore(filled, g.id, 11, 4)).not.toThrow()
    expect(() => skipGame(filled, g.id)).not.toThrow()
  })
})

describe('saving the new formats (T8.4: JSON round trip; version 3 since T8.9)', () => {
  const cases: [Format, Play, 'solos' | 'pairs'][] = [
    ['round-robin', 'doubles', 'solos'],
    ['round-robin', 'singles', 'solos'],
    ['round-robin', 'doubles', 'pairs'],
    ['mexicano', 'doubles', 'solos'],
    ['mexicano', 'singles', 'solos'],
    ['skill-groups', 'doubles', 'solos'],
    ['skill-groups', 'singles', 'solos'],
    ['skill-groups', 'doubles', 'pairs'],
    ['winners-losers', 'doubles', 'solos'],
    ['winners-losers', 'singles', 'solos'],
    ['winners-losers', 'doubles', 'pairs'],
  ]
  it.each(cases)('%s (%s, %s): a session mid-play loads back equal and plays on the same', (format, play, who) => {
    const pairs = who === 'pairs'
    let s = make(format, pairs ? 4 : 9, { courts: 2, play, pairs, levels: MIXED })
    for (let i = 0; i < 7; i++) {
      s = fillCourts(s)
      s = i % 4 === 3 ? skipGame(s, playing(s)[0].id) : recordScore(s, playing(s)[0].id, ...score(i))
    }
    s = fillCourts(s)
    const json = serialize(s)
    expect(JSON.parse(json).version).toBe(3)
    const loaded = deserialize(json)
    expect(loaded).toEqual(s)
    let a = loaded!
    let b = s
    for (let i = 0; i < 5; i++) {
      const ga = playing(a)[0]
      const gb = playing(b)[0]
      a = fillCourts(recordScore(a, ga.id, ...score(i)))
      b = fillCourts(recordScore(b, gb.id, ...score(i)))
      expect(a).toEqual(b)
    }
  })

  it('a save of Mexicano with locked pairs (a refused combination) loads as null', () => {
    const s = make('skill-groups', 2, { courts: 1, pairs: true })
    const data = JSON.parse(serialize(s))
    data.session.format = 'mexicano'
    expect(deserialize(JSON.stringify(data))).toBeNull()
  })

  it.each(NEW_FORMATS)('a singles save with locked pairs is refused for %s', (format) => {
    const s = make('skill-groups', 2, { courts: 1, pairs: true })
    const data = JSON.parse(serialize(s))
    data.session.format = format
    data.session.play = 'singles'
    expect(deserialize(JSON.stringify(data))).toBeNull()
  })
})
