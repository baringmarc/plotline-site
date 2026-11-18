// T8.4 Round Robin in the engine (TASKS.md T8.4; SPEC §4 "Round Robin"; plan gate (user, 2026-11-18): a fixed
// circle-method schedule — singles and fixed pairs: every side plays every other; open doubles: everyone partners
// everyone — continuous, rebuilt when sides join or leave; Americano stays as it is).
//
// Names the tests rely on (the plan's): `roundRobinOrder` from `./schedule` (its own order is tested in
// schedule.test.ts; here it is the schedule the engine must follow), `Format` 'round-robin', and the existing engine
// API. Teams are compared as sets of players; in open doubles team A is the first partnership taken (SPEC).
import { describe, expect, it } from 'vitest'
import {
  addPairs,
  addPlayers,
  backInLine,
  createSession,
  fillCourts,
  isRoundFormat,
  recordScore,
  removePlayer,
  skipGame,
  timeOut,
} from './engine'
import { roundRobinOrder } from './schedule'
import type { Game, Play, Session, Teams } from './types'

// ---------- helpers ----------

const NAMES = [
  'Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida',
  'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia', 'Quin', 'Ray',
]

function id(s: Session, name: string): string {
  const p = s.players.find((x) => x.name === name)
  if (!p) throw new Error(`no player ${name}`)
  return p.id
}
const nameOf = (s: Session, pid: string) => s.players.find((p) => p.id === pid)!.name
const set = (xs: readonly string[]) => [...xs].sort().join('|')
const playing = (s: Session) => s.games.filter((g) => g.status === 'playing')
const finished = (s: Session) => s.games.filter((g) => g.status === 'scored' || g.status === 'skipped')
const playersOf = (g: Game) => [...g.teamA, ...g.teamB]
const perCourt = (s: Session) => (s.play === 'singles' ? 2 : 4)
const freeCourts = (s: Session) => {
  const busy = new Set(playing(s).map((g) => g.court))
  return Array.from({ length: s.courts }, (_, i) => i + 1).filter((c) => !busy.has(c))
}
const onCourt = (s: Session, court: number) => {
  const gs = playing(s).filter((g) => g.court === court)
  expect(gs, `one game on court ${court}`).toHaveLength(1)
  return gs[0]
}
/** A game's two sides as an order-free key: "teamA vs teamB" with the sides sorted. */
const matchKey = (a: readonly string[], b: readonly string[]) => [set(a), set(b)].sort().join(' vs ')

function score(i: number): [number, number] {
  const loser = (i * 7) % 10
  return i % 3 === 1 ? [loser, 11] : [11, loser]
}

function make(count: number, opts: { courts: number; play?: Play; teams?: Teams }): Session {
  const play = opts.play ?? 'doubles'
  const teams = opts.teams ?? 'open'
  if (teams === 'fixed') {
    const pairs = Array.from({ length: count }, (_, i) => [NAMES[i * 2], NAMES[i * 2 + 1]] as [string, string])
    return createSession({ format: 'round-robin', courts: opts.courts, play, teams, pairs })
  }
  return createSession({ format: 'round-robin', courts: opts.courts, play, teams, names: NAMES.slice(0, count) })
}

function expectConsistent(s: Session) {
  const perSide = s.play === 'singles' ? 1 : 2
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
    expect(g.teamA).toHaveLength(perSide)
    expect(g.teamB).toHaveLength(perSide)
    expect(new Set(playersOf(g)).size).toBe(perSide * 2)
  }
  if (s.teams === 'fixed')
    for (let i = 0; i < s.line.length; i += 2)
      expect(s.players.find((p) => p.id === s.line[i])!.partner).toBe(s.line[i + 1])
}

// ---------- a reference for SPEC's Round Robin rule ----------

/** The sides that are waiting or playing, in the order they joined (a fixed pair as its two partners). */
function rrSides(s: Session): string[][] {
  const active = s.players.filter((p) => p.status === 'waiting' || p.status === 'playing')
  if (s.teams !== 'fixed') return active.map((p) => [p.id])
  const index = (pid: string) => s.players.findIndex((p) => p.id === pid)
  return active.filter((p) => index(p.id) < index(p.partner!)).map((p) => [p.id, p.partner!])
}

interface Pairing {
  /** Matches: the two sides. Partnerships: the two players of the team. */
  a: string[]
  b: string[]
  ids: string[]
  count: number
}

/** The schedule with each pairing's count (finished games it has been in: as a match, or as a partnership). */
function rrSchedule(s: Session): { match: boolean; pairings: Pairing[] } {
  const match = s.play === 'singles' || s.teams === 'fixed'
  const done = finished(s)
  const pairings = roundRobinOrder(rrSides(s)).map(([x, y]) => {
    if (match) {
      const k = matchKey(x, y)
      return { a: x, b: y, ids: [...x, ...y], count: done.filter((g) => matchKey(g.teamA, g.teamB) === k).length }
    }
    const team = [x[0], y[0]]
    const k = set(team)
    return { a: team, b: [], ids: team, count: done.filter((g) => set(g.teamA) === k || set(g.teamB) === k).length }
  })
  return { match, pairings }
}

interface Expected {
  court: number
  a: string[]
  b: string[]
}

/**
 * SPEC: a free court (lowest first) takes the first pairing in schedule order with the current cycle's count whose
 * players are all waiting; none → the court stays free. Open doubles then adds the partnership with no player in
 * common, all waiting, with the lowest count, then first in schedule order; none → the court stays free.
 */
function expectedRoundRobin(s: Session): Expected[] {
  const { match, pairings } = rrSchedule(s)
  if (pairings.length === 0) return []
  const cycle = Math.min(...pairings.map((p) => p.count))
  const waiting = new Set(s.line)
  const allWaiting = (p: Pairing) => p.ids.every((x) => waiting.has(x))
  const out: Expected[] = []
  for (const court of freeCourts(s)) {
    if (waiting.size < perCourt(s)) break
    const first = pairings.find((p) => p.count === cycle && allWaiting(p))
    if (!first) break
    if (match) {
      out.push({ court, a: first.a, b: first.b })
      first.ids.forEach((x) => waiting.delete(x))
      continue
    }
    const options = pairings.filter((p) => p !== first && allWaiting(p) && !p.ids.some((x) => first.ids.includes(x)))
    if (options.length === 0) break
    const low = Math.min(...options.map((p) => p.count))
    const second = options.find((p) => p.count === low)!
    out.push({ court, a: first.a, b: second.a })
    ;[...first.ids, ...second.ids].forEach((x) => waiting.delete(x))
  }
  return out
}

function expectFill(before: Session, after: Session) {
  const expected = expectedRoundRobin(before)
  expect(after.games.slice(0, before.games.length)).toEqual(before.games)
  const fresh = after.games.slice(before.games.length)
  const match = before.play === 'singles' || before.teams === 'fixed'
  const shape = (court: number, a: readonly string[], b: readonly string[]) =>
    match ? { court, game: matchKey(a, b) } : { court, a: set(a), b: set(b) }
  expect(fresh.map((g) => ({ ...shape(g.court, g.teamA, g.teamB), status: g.status }))).toEqual(
    expected.map((e) => ({ ...shape(e.court, e.a, e.b), status: 'playing' })),
  )
  const went = new Set(fresh.flatMap(playersOf))
  expect(after.line, 'the line only shows who is waiting, in the same order').toEqual(before.line.filter((x) => !went.has(x)))
  expectConsistent(after)
}

type Config = { label: string; count: number; courts: number; play: Play; teams: Teams }
const COURTS = [1, 2, 3]
const CONFIGS: Config[] = [
  ...[4, 5, 9, 17].flatMap((n) =>
    COURTS.map((c) => ({ label: `${n} players, ${c} court(s), doubles`, count: n, courts: c, play: 'doubles' as Play, teams: 'open' as Teams })),
  ),
  ...[2, 3, 7].flatMap((n) =>
    COURTS.map((c) => ({ label: `${n} players, ${c} court(s), singles`, count: n, courts: c, play: 'singles' as Play, teams: 'open' as Teams })),
  ),
  ...[2, 3, 5, 8].flatMap((n) =>
    COURTS.map((c) => ({ label: `${n} fixed pairs, ${c} court(s)`, count: n, courts: c, play: 'doubles' as Play, teams: 'fixed' as Teams })),
  ),
]

function play(start: Session, games: number, opts: { events?: boolean; each?: (s: Session) => void } = {}): Session {
  let s = start
  let outId: string | undefined
  for (let i = 0; i < games; i++) {
    if (opts.events) {
      if (i === 8) s = s.teams === 'fixed' ? addPairs(s, [['Zed', 'Yan']]) : addPlayers(s, ['Zed'])
      if (i === 16 && s.line.length > 0) {
        outId = s.line[0]
        s = timeOut(s, outId)
      }
      if (i === 24 && outId) s = backInLine(s, outId)
      if (i === 32 && playing(s).length > 0) s = removePlayer(s, playing(s)[0].teamA[0])
    }
    const before = s
    s = fillCourts(s)
    expectFill(before, s)
    const live = playing(s)
    expect(live.length, `a game is on court after filling (step ${i})`).toBeGreaterThan(0)
    const g = i % 4 === 3 ? live[live.length - 1] : live[0]
    s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, ...score(i))
    expectConsistent(s)
    opts.each?.(s)
  }
  return s
}

// ---------- tests ----------

describe('Round Robin is continuous (T8.4 plan gate)', () => {
  it('isRoundFormat is false for Round Robin', () => {
    expect(isRoundFormat('round-robin')).toBe(false)
  })
})

describe('Round Robin in singles: every player plays every other (T8.4)', () => {
  it('on one court the games follow the schedule exactly, cycle after cycle', () => {
    let s = make(5, { courts: 1, play: 'singles' })
    const sides = s.players.map((p) => [p.id])
    const order = roundRobinOrder(sides).map(([x, y]) => matchKey(x, y))
    expect(order).toHaveLength(10)
    const seen: string[] = []
    for (let i = 0; i < 20; i++) {
      s = fillCourts(s)
      const g = onCourt(s, 1)
      seen.push(matchKey(g.teamA, g.teamB))
      s = recordScore(s, g.id, ...score(i))
    }
    expect(seen).toEqual([...order, ...order])
  })

  it('after each full cycle everyone has played the same number of games', () => {
    let s = make(5, { courts: 1, play: 'singles' })
    for (let i = 0; i < 20; i++) {
      s = fillCourts(s)
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
      if ((i + 1) % 10 === 0) {
        const turns = s.players.map((p) => finished(s).filter((g) => playersOf(g).includes(p.id)).length)
        expect(new Set(turns).size, `after ${i + 1} games`).toBe(1)
        expect(turns[0]).toBe(((i + 1) / 10) * 4)
      }
    }
  })

  it('the first fill puts the first pairings of the schedule on the courts, lowest court first', () => {
    const start = make(4, { courts: 2, play: 'singles' })
    const s = fillCourts(start)
    const order = roundRobinOrder(start.players.map((p) => [p.id]))
    expect(matchKey(onCourt(s, 1).teamA, onCourt(s, 1).teamB)).toBe(matchKey(...order[0]))
    expect(matchKey(onCourt(s, 2).teamA, onCourt(s, 2).teamB)).toBe(matchKey(...order[1]))
    expect(s.line).toEqual([])
  })

  it('a court stays free until a game ends when no pairing of the current cycle is all waiting', () => {
    // 4 players, 2 courts: round 1 fills both. When court 1 ends, its two players have already met, and every other
    // pairing of the cycle needs someone still on court 2.
    let s = fillCourts(make(4, { courts: 2, play: 'singles' }))
    const court1 = onCourt(s, 1)
    s = recordScore(s, court1.id, 11, 6)
    const held = fillCourts(s)
    expect(held.games).toEqual(s.games)
    expect(playing(held)).toHaveLength(1)
    expect(held.line).toEqual([court1.teamA[0], court1.teamB[0]])
    // When court 2 ends, both courts take round 2.
    s = recordScore(held, onCourt(held, 2).id, 11, 9)
    const before = s
    s = fillCourts(s)
    expectFill(before, s)
    expect(playing(s)).toHaveLength(2)
  })

  it('after a game both players go to the back of the line in the order they came on', () => {
    let s = fillCourts(make(4, { courts: 1, play: 'singles' }))
    const g = onCourt(s, 1)
    s = recordScore(s, g.id, 11, 3)
    expect(s.line.slice(-2)).toEqual([g.teamA[0], g.teamB[0]])
  })

  it('games do not come from the front of the line', () => {
    // Over a cycle of 5 players on 1 court, some game must start without the player at the front of the line.
    let s = make(5, { courts: 1, play: 'singles' })
    let skippedFront = false
    for (let i = 0; i < 10; i++) {
      const front = s.line[0]
      s = fillCourts(s)
      if (!playersOf(onCourt(s, 1)).includes(front)) skippedFront = true
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
    }
    expect(skippedFront).toBe(true)
  })
})

describe('Round Robin with fixed pairs: every pair plays every other pair (T8.4)', () => {
  it('on one court the games follow the schedule of pairs exactly', () => {
    let s = make(4, { courts: 1, teams: 'fixed' })
    const sides = [0, 2, 4, 6].map((i) => [s.players[i].id, s.players[i + 1].id])
    const order = roundRobinOrder(sides).map(([x, y]) => matchKey(x, y))
    const seen: string[] = []
    for (let i = 0; i < 12; i++) {
      s = fillCourts(s)
      const g = onCourt(s, 1)
      seen.push(matchKey(g.teamA, g.teamB))
      s = recordScore(s, g.id, ...score(i))
    }
    expect(seen).toEqual([...order, ...order])
  })

  it('partners always play together', () => {
    let s = make(5, { courts: 2, teams: 'fixed' })
    s = play(s, 30)
    for (const g of s.games)
      for (const t of [g.teamA, g.teamB]) expect(s.players.find((p) => p.id === t[0])!.partner).toBe(t[1])
  })
})

describe('Round Robin in open doubles: everyone partners everyone (T8.4)', () => {
  it('4 players on 1 court: 3 games, each of the 6 partnerships exactly once, rounds in schedule order', () => {
    let s = make(4, { courts: 1 })
    const order = roundRobinOrder(s.players.map((p) => [p.id])).map(([x, y]) => set([x[0], y[0]]))
    const teams: string[] = []
    for (let i = 0; i < 3; i++) {
      s = fillCourts(s)
      const g = onCourt(s, 1)
      // Team A is the first partnership taken: the round's first pairing.
      expect(set(g.teamA)).toBe(order[i * 2])
      teams.push(set(g.teamA), set(g.teamB))
      s = recordScore(s, g.id, ...score(i))
    }
    expect([...teams].sort()).toEqual([...order].sort())
  })

  it('the second team is a partnership with nobody in common with the first', () => {
    const s = play(make(9, { courts: 2 }), 40)
    for (const g of s.games) {
      expect(new Set(playersOf(g)).size).toBe(4)
      expect(g.teamA.some((x) => g.teamB.includes(x))).toBe(false)
    }
  })

  it('names the game from the first partnership in schedule order with the lowest count', () => {
    // 5 players on 1 court, checked game by game against SPEC's rule.
    play(make(5, { courts: 1 }), 30)
  })
})

describe('Round Robin rebuilds its schedule when sides join or leave (T8.4)', () => {
  it('a late arrival: the next games are the new pairings, finished games still count', () => {
    // Singles, 3 players, 1 court: one full cycle (3 games), then Dee joins.
    let s = make(3, { courts: 1, play: 'singles' })
    for (let i = 0; i < 3; i++) {
      s = fillCourts(s)
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
    }
    s = addPlayers(s, ['Dee'])
    const opponents: string[] = []
    for (let i = 0; i < 3; i++) {
      const before = s
      s = fillCourts(s)
      expectFill(before, s)
      const g = onCourt(s, 1)
      expect(playersOf(g), `game ${i + 4} has Dee`).toContain(id(s, 'Dee'))
      opponents.push(...playersOf(g).filter((x) => x !== id(s, 'Dee')).map((x) => nameOf(s, x)))
      s = recordScore(s, g.id, ...score(i))
    }
    expect(opponents.sort()).toEqual(['Ana', 'Ben', 'Cy'])
  })

  it('a time out leaves the schedule; nobody is scheduled against an absent player', () => {
    let s = make(5, { courts: 1, play: 'singles' })
    s = timeOut(s, id(s, 'Ana'))
    for (let i = 0; i < 6; i++) {
      const before = s
      s = fillCourts(s)
      expectFill(before, s)
      expect(playersOf(onCourt(s, 1))).not.toContain(id(s, 'Ana'))
      s = recordScore(s, onCourt(s, 1).id, ...score(i))
    }
    s = backInLine(s, id(s, 'Ana'))
    const before = s
    s = fillCourts(s)
    expectFill(before, s)
    // Ana has met nobody: every pairing of hers is in the lowest cycle again.
    expect(playersOf(onCourt(s, 1))).toContain(id(s, 'Ana'))
  })

  it('removing a player on court cancels the game, which does not count', () => {
    let s = fillCourts(make(4, { courts: 1, play: 'singles' }))
    const g = onCourt(s, 1)
    s = removePlayer(s, g.teamA[0])
    expect(s.games.find((x) => x.id === g.id)!.status).toBe('cancelled')
    const before = s
    s = fillCourts(s)
    expectFill(before, s)
    expect(playersOf(onCourt(s, 1))).not.toContain(g.teamA[0])
  })
})

describe('Round Robin over many games (T8.4: 4, 5, 9, 17 players; singles 2, 3, 7; fixed pairs; 1–3 courts)', () => {
  it.each(CONFIGS.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    for (const events of [false, true]) {
      const start = make(c.count, { courts: c.courts, play: c.play, teams: c.teams })
      play(start, 60, {
        events,
        each: (s) => {
          if (events || !(s.play === 'singles' || s.teams === 'fixed')) return
          // Matches: every pairing is played once before any is played twice.
          const counts = rrSchedule(s).pairings.map((p) => p.count)
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
        },
      })
    }
  })
})
