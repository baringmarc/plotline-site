import { describe, expect, it } from 'vitest'
import {
  StackError,
  addPlayers,
  backInLine,
  createSession,
  deserialize,
  fillCourts,
  recordScore,
  removePlayer,
  serialize,
  skipGame,
  standings,
  timeOut,
} from './engine'
import type { Format, Game, Session } from './types'

// ---------- helpers ----------

const NAMES = [
  'Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida',
  'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia', 'Quin', 'Ray',
]
const names = (n: number) => NAMES.slice(0, n)

/** Player id by name. */
function id(s: Session, name: string): string {
  const p = s.players.find((x) => x.name === name)
  if (!p) throw new Error(`no player ${name}`)
  return p.id
}
const ids = (s: Session, ...ns: string[]) => ns.map((n) => id(s, n))
const nameOf = (s: Session, pid: string) => s.players.find((p) => p.id === pid)?.name
const status = (s: Session, name: string) => s.players.find((p) => p.name === name)?.status

const playing = (s: Session) => s.games.filter((g) => g.status === 'playing')
const onCourt = (s: Session, court: number) => {
  const gs = playing(s).filter((g) => g.court === court)
  expect(gs).toHaveLength(1)
  return gs[0]
}
const playersOf = (g: Game) => [...g.teamA, ...g.teamB]
/** The order the four came on in Fair rotation: line positions 1, 2, 3, 4. */
const cameOn = (g: Game) => [g.teamA[0], g.teamB[0], g.teamA[1], g.teamB[1]]
const pairKey = (a: string, b: string) => [a, b].sort().join('|')
const teamsKey = (g: Game) => [pairKey(...g.teamA), pairKey(...g.teamB)].sort()

function expectCode(fn: () => unknown, code: StackError['code']) {
  let caught: unknown
  try {
    fn()
  } catch (e) {
    caught = e
  }
  expect(caught).toBeInstanceOf(StackError)
  expect(caught).toBeInstanceOf(Error)
  expect((caught as StackError).code).toBe(code)
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}

/** Games a player has had a turn in (on court, scored or skipped). */
function turns(s: Session, pid: string, opts: { includePlaying: boolean }) {
  return s.games.filter(
    (g) =>
      (g.status === 'scored' || g.status === 'skipped' || (opts.includePlaying && g.status === 'playing')) &&
      playersOf(g).includes(pid),
  ).length
}

/** Every active player is in the line or on court, exactly once; statuses agree. */
function expectConsistent(s: Session) {
  const onCourtIds = playing(s).flatMap(playersOf)
  expect(new Set(onCourtIds).size).toBe(onCourtIds.length)
  expect(new Set(s.line).size).toBe(s.line.length)
  for (const p of s.players) {
    const inLine = s.line.includes(p.id)
    const isOn = onCourtIds.includes(p.id)
    if (p.status === 'waiting') expect(inLine && !isOn).toBe(true)
    else if (p.status === 'playing') expect(isOn && !inLine).toBe(true)
    else expect(inLine || isOn).toBe(false)
  }
  for (const g of s.games) expect(new Set(playersOf(g)).size).toBe(4)
}

/** A pseudo-random but repeatable score, never a tie. */
function score(i: number): [number, number] {
  const loser = (i * 7) % 10
  return i % 3 === 1 ? [loser, 11] : [11, loser]
}

/** Can these players be split into pairs with no pair in `forbidden`? */
function canPairAvoiding(players: string[], forbidden: Set<string>): boolean {
  if (players.length === 0) return true
  const [first, ...rest] = players
  for (let i = 0; i < rest.length; i++) {
    if (forbidden.has(pairKey(first, rest[i]))) continue
    if (canPairAvoiding([...rest.slice(0, i), ...rest.slice(i + 1)], forbidden)) return true
  }
  return false
}

const SIZES = [4, 5, 9, 17]
const COURTS = [1, 2, 3]
const GRID = SIZES.flatMap((n) => COURTS.map((c) => [n, c] as const))

// ---------- session ----------

describe('createSession', () => {
  it('puts the names in the line in the order given, all waiting, no games', () => {
    const s = createSession({ format: 'fair', courts: 2, names: ['Ana', 'Ben', 'Cy'] })
    expect(s.format).toBe('fair')
    expect(s.courts).toBe(2)
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cy'])
    expect(s.players.every((p) => p.status === 'waiting')).toBe(true)
    expect(s.line).toEqual(s.players.map((p) => p.id))
    expect(new Set(s.line).size).toBe(3)
    expect(s.games).toEqual([])
  })

  it('trims names and skips empty ones and duplicates ignoring case', () => {
    const s = createSession({ format: 'fair', courts: 1, names: ['  Ana ', '', '   ', 'ana', 'Ben', 'BEN', 'Cy'] })
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cy'])
    expect(s.line).toHaveLength(3)
  })

  it.each([1, 12])('accepts %i courts (boundary)', (courts) => {
    expect(createSession({ format: 'americano', courts, names: [] }).courts).toBe(courts)
  })

  it.each([0, 13, -1, 2.5, Number.NaN])('refuses %s courts with bad-courts', (courts) => {
    expectCode(() => createSession({ format: 'fair', courts, names: ['Ana'] }), 'bad-courts')
  })
})

describe('addPlayers', () => {
  it('late arrivals join the back of the line, skipping names already in the session', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(5) }))
    s = addPlayers(s, [' Gus ', 'ana', 'Hal', 'gus', ''])
    expect(s.players.map((p) => p.name)).toEqual([...names(5), 'Gus', 'Hal'])
    expect(s.line).toEqual(ids(s, 'Eli', 'Gus', 'Hal'))
    expect(status(s, 'Gus')).toBe('waiting')
  })

  it('a late arrival in Fair rotation goes on after those already waiting', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(4) }))
    s = addPlayers(s, ['Eli'])
    s = recordScore(s, playing(s)[0].id, 11, 4)
    s = fillCourts(s)
    // line was Eli, Ana, Ben, Cy, Dee → Eli & Ben against Ana & Cy
    const g = onCourt(s, 1)
    expect(g.teamA).toEqual(ids(s, 'Eli', 'Ben'))
    expect(g.teamB).toEqual(ids(s, 'Ana', 'Cy'))
    expect(s.line).toEqual(ids(s, 'Dee'))
  })
})

describe('purity', () => {
  it('never mutates the session it is given', () => {
    let s = deepFreeze(createSession({ format: 'fair', courts: 2, names: names(9) }))
    s = deepFreeze(fillCourts(s))
    s = deepFreeze(addPlayers(s, ['Zed']))
    s = deepFreeze(timeOut(s, id(s, 'Ida')))
    s = deepFreeze(backInLine(s, id(s, 'Ida')))
    s = deepFreeze(recordScore(s, playing(s)[0].id, 11, 9))
    s = deepFreeze(skipGame(s, playing(s)[0].id))
    s = deepFreeze(fillCourts(s))
    s = deepFreeze(removePlayer(s, playing(s)[0].teamA[0]))
    expect(standings(s).length).toBeGreaterThan(0)
    expect(deserialize(serialize(s))).toEqual(s)
  })

  it('a refused action leaves the session unchanged', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(5) }))
    const before = JSON.stringify(s)
    expectCode(() => recordScore(s, playing(s)[0].id, 7, 7), 'tie')
    expectCode(() => timeOut(s, playing(s)[0].teamA[0]), 'not-waiting')
    expect(JSON.stringify(s)).toBe(before)
  })
})

// ---------- results ----------

describe('recordScore and skipGame', () => {
  const start = () => fillCourts(createSession({ format: 'fair', courts: 1, names: names(5) }))

  it('records a score and ends the game', () => {
    const s0 = start()
    const g0 = playing(s0)[0]
    const s = recordScore(s0, g0.id, 11, 7)
    const g = s.games.find((x) => x.id === g0.id)
    expect(g).toMatchObject({ status: 'scored', scoreA: 11, scoreB: 7 })
  })

  it('refuses a tie with code tie', () => {
    const s = start()
    expectCode(() => recordScore(s, playing(s)[0].id, 11, 11), 'tie')
    expectCode(() => recordScore(s, playing(s)[0].id, 0, 0), 'tie')
  })

  it.each([
    [-1, 5],
    [5, -1],
    [100, 5],
    [11, 100],
    [10.5, 3],
    [Number.NaN, 3],
  ])('refuses %s–%s with code bad-score', (a, b) => {
    const s = start()
    expectCode(() => recordScore(s, playing(s)[0].id, a, b), 'bad-score')
  })

  it('accepts the boundary scores 0 and 99', () => {
    const s = start()
    const g = recordScore(s, playing(s)[0].id, 0, 99).games[0]
    expect(g).toMatchObject({ status: 'scored', scoreA: 0, scoreB: 99 })
  })

  it('refuses an unknown game with not-found', () => {
    const s = start()
    expectCode(() => recordScore(s, 'no-such-game', 11, 3), 'not-found')
    expectCode(() => skipGame(s, 'no-such-game'), 'not-found')
  })

  it('refuses to score or skip a game that already ended with game-over', () => {
    const s0 = start()
    const gid = playing(s0)[0].id
    const scored = recordScore(s0, gid, 11, 3)
    expectCode(() => recordScore(scored, gid, 11, 5), 'game-over')
    expectCode(() => skipGame(scored, gid), 'game-over')
    const skipped = skipGame(s0, gid)
    expectCode(() => recordScore(skipped, gid, 11, 5), 'game-over')
    expectCode(() => skipGame(skipped, gid), 'game-over')
  })

  it('skip score ends the game with no score and no winner, and rotates', () => {
    const s0 = start()
    const gid = playing(s0)[0].id
    const s = fillCourts(skipGame(s0, gid))
    const g = s.games.find((x) => x.id === gid)!
    expect(g.status).toBe('skipped')
    expect(g.scoreA).toBeUndefined()
    expect(g.scoreB).toBeUndefined()
    // line was Eli, then Ana, Ben, Cy, Dee went to the back
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Eli', 'Ben'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ana', 'Cy'))
    // skipped games count for nobody in the standings
    expect(standings(s).every((r) => r.games === 0 && r.wins === 0 && r.losses === 0)).toBe(true)
  })
})

// ---------- players ----------

describe('time out and back in line', () => {
  it('time out takes a waiting player out of the line; fillCourts passes them by', () => {
    let s = createSession({ format: 'fair', courts: 1, names: names(6) })
    s = timeOut(s, id(s, 'Ana'))
    expect(status(s, 'Ana')).toBe('out')
    expect(s.line).not.toContain(id(s, 'Ana'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ben', 'Dee'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy', 'Eli'))
    expect(s.line).toEqual(ids(s, 'Fay'))
    expectConsistent(s)
  })

  it('back in line puts the player at the back of the line', () => {
    let s = createSession({ format: 'fair', courts: 1, names: names(6) })
    s = backInLine(timeOut(s, id(s, 'Ben')), id(s, 'Ben'))
    expect(status(s, 'Ben')).toBe('waiting')
    expect(s.line).toEqual(ids(s, 'Ana', 'Cy', 'Dee', 'Eli', 'Fay', 'Ben'))
  })

  it('a player on time out keeps their record in the standings', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(4) }))
    s = recordScore(s, playing(s)[0].id, 11, 6) // Ana & Cy win
    s = timeOut(s, id(s, 'Ana'))
    const row = standings(s).find((r) => r.name === 'Ana')
    expect(row).toMatchObject({ wins: 1, losses: 0, games: 1, pointsFor: 11, pointsAgainst: 6 })
  })

  it('only a waiting player can take a time out (not-waiting)', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(5) }))
    expectCode(() => timeOut(s, id(s, 'Ana')), 'not-waiting')
    const out = timeOut(s, id(s, 'Eli'))
    expectCode(() => timeOut(out, id(out, 'Eli')), 'not-waiting')
  })

  it('back in line refuses a player who is not on time out', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(5) }))
    expect(() => backInLine(s, id(s, 'Eli'))).toThrow(StackError)
    expect(() => backInLine(s, id(s, 'Ana'))).toThrow(StackError)
  })

  it('unknown player ids give not-found', () => {
    const s = createSession({ format: 'fair', courts: 1, names: names(5) })
    expectCode(() => timeOut(s, 'nobody'), 'not-found')
    expectCode(() => backInLine(s, 'nobody'), 'not-found')
    expectCode(() => removePlayer(s, 'nobody'), 'not-found')
  })
})

describe('removePlayer', () => {
  it('removes a waiting player from the line and the standings', () => {
    let s = createSession({ format: 'fair', courts: 1, names: names(6) })
    s = removePlayer(s, id(s, 'Cy'))
    expect(status(s, 'Cy')).toBe('removed')
    expect(s.line).toEqual(ids(s, 'Ana', 'Ben', 'Dee', 'Eli', 'Fay'))
    expect(standings(s).map((r) => r.name)).not.toContain('Cy')
    expect(onCourt(fillCourts(s), 1).teamA).toEqual(ids(s, 'Ana', 'Dee'))
  })

  it('removing a player on court cancels the game with no score; the other three go to the front in their order', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(9) }))
    const gid = playing(s)[0].id
    s = removePlayer(s, id(s, 'Cy'))
    const g = s.games.find((x) => x.id === gid)!
    expect(g.status).toBe('cancelled')
    expect(g.scoreA).toBeUndefined()
    expect(g.scoreB).toBeUndefined()
    expect(status(s, 'Cy')).toBe('removed')
    expect(s.line).toEqual(ids(s, 'Ana', 'Ben', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida'))
    expect(playing(s)).toHaveLength(0)
    expectConsistent(s)
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Dee'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Eli'))
    expectCode(() => recordScore(s, gid, 11, 2), 'game-over')
  })

  it('keeps the removed player’s finished games for everyone else', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(4) }))
    s = recordScore(s, playing(s)[0].id, 11, 8) // Ana & Cy beat Ben & Dee
    s = removePlayer(s, id(s, 'Cy'))
    expect(s.games.filter((g) => g.status === 'scored')).toHaveLength(1)
    const rows = standings(s)
    expect(rows.map((r) => r.name).sort()).toEqual(['Ana', 'Ben', 'Dee'])
    expect(rows.find((r) => r.name === 'Ana')).toMatchObject({ wins: 1, games: 1, pointsFor: 11, pointsAgainst: 8 })
    expect(rows.find((r) => r.name === 'Ben')).toMatchObject({ losses: 1, games: 1 })
  })

  it('in Americano the other three wait for the next round, which starts once the round is over', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 2, names: names(8) }))
    expect(playing(s)).toHaveLength(2)
    const [g1, g2] = playing(s)
    s = removePlayer(s, g1.teamA[0])
    expect(s.games.find((g) => g.id === g1.id)!.status).toBe('cancelled')
    const others = playersOf(g1).slice(1)
    for (const pid of others) expect(s.players.find((p) => p.id === pid)!.status).toBe('waiting')
    // the other court is still playing, so no new round yet
    expect(playing(fillCourts(s)).map((g) => g.id)).toEqual([g2.id])
    s = fillCourts(recordScore(s, g2.id, 11, 5))
    // 7 left → floor(7 / 4) = 1 court
    expect(playing(s)).toHaveLength(1)
    expect(playersOf(playing(s)[0])).not.toContain(g1.teamA[0])
    expectConsistent(s)
  })
})

// ---------- Fair rotation ----------

describe('Fair rotation', () => {
  it('fills courts lowest first: line positions 1 & 3 against 2 & 4', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 3, names: names(9) }))
    expect(playing(s)).toHaveLength(2)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Dee'))
    expect(onCourt(s, 2).teamA).toEqual(ids(s, 'Eli', 'Gus'))
    expect(onCourt(s, 2).teamB).toEqual(ids(s, 'Fay', 'Hal'))
    expect(s.line).toEqual(ids(s, 'Ida'))
    expect(status(s, 'Ana')).toBe('playing')
  })

  it('does nothing with fewer than 4 waiting', () => {
    const s = createSession({ format: 'fair', courts: 2, names: names(3) })
    expect(fillCourts(s)).toEqual(s)
  })

  it('after a game all four go to the back in the order they came on', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(6) }))
    s = recordScore(s, playing(s)[0].id, 4, 11)
    expect(s.line).toEqual(ids(s, 'Eli', 'Fay', 'Ana', 'Ben', 'Cy', 'Dee'))
    expect(status(s, 'Ana')).toBe('waiting')
  })

  it.each(GRID)('%i players on %i courts: rotation over many games, nobody waits more than one game longer', (n, courts) => {
    let s = fillCourts(createSession({ format: 'fair', courts, names: names(n) }))
    const busy = Math.min(courts, Math.floor(n / 4))
    const seen = new Map<string, number>()
    const note = () => playing(s).forEach((g) => seen.has(g.id) || seen.set(g.id, seen.size))
    note()
    for (let i = 0; i < 60; i++) {
      expect(playing(s)).toHaveLength(busy)
      expectConsistent(s)
      const counts = s.players.map((p) => turns(s, p.id, { includePlaying: true }))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)

      // finish the game that started first
      const g = [...playing(s)].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)[0]
      const queue = [...s.line, ...cameOn(g)]
      const [a, b] = score(i)
      s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, a, b)
      s = fillCourts(s)
      note()
      const next = onCourt(s, g.court)
      expect(next.teamA).toEqual([queue[0], queue[2]])
      expect(next.teamB).toEqual([queue[1], queue[3]])
      expect(s.line).toEqual(queue.slice(4))
    }
  })
})

// ---------- Winners stay, split up ----------

describe('Winners stay, split up', () => {
  it('the first game is taken like Fair rotation', () => {
    const s = fillCourts(createSession({ format: 'winners-split', courts: 1, names: names(9) }))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Dee'))
  })

  it('losers go to the back; each winner partners one of the next two in line', () => {
    let s = fillCourts(createSession({ format: 'winners-split', courts: 1, names: names(9) }))
    s = fillCourts(recordScore(s, playing(s)[0].id, 11, 6)) // Ana & Cy beat Ben & Dee
    const g = onCourt(s, 1)
    // Ana + Eli against Cy + Fay
    expect(teamsKey(g)).toEqual([pairKey(id(s, 'Ana'), id(s, 'Eli')), pairKey(id(s, 'Cy'), id(s, 'Fay'))].sort())
    expect(s.line).toEqual(ids(s, 'Gus', 'Hal', 'Ida', 'Ben', 'Dee'))
  })

  it('after 2 wins in a row on the court, all four go to the back, losers first, and the court refills from the front', () => {
    let s = fillCourts(createSession({ format: 'winners-split', courts: 1, names: names(9) }))
    s = fillCourts(recordScore(s, playing(s)[0].id, 11, 6))
    const g2 = onCourt(s, 1)
    const anaTeamIsA = g2.teamA.includes(id(s, 'Ana'))
    // Ana & Eli win: Ana has 2 wins in a row
    s = recordScore(s, g2.id, anaTeamIsA ? 11 : 3, anaTeamIsA ? 3 : 11)
    const winners = anaTeamIsA ? g2.teamA : g2.teamB
    const losers = anaTeamIsA ? g2.teamB : g2.teamA
    s = fillCourts(s)
    const g3 = onCourt(s, 1)
    // line was Gus, Hal, Ida, Ben, Dee → Gus & Ida against Hal & Ben
    expect(g3.teamA).toEqual(ids(s, 'Gus', 'Ida'))
    expect(g3.teamB).toEqual(ids(s, 'Hal', 'Ben'))
    expect(s.line).toEqual([id(s, 'Dee'), ...losers, ...winners])
  })

  it('after a skipped game all four go to the back in the order they came on', () => {
    let s = fillCourts(createSession({ format: 'winners-split', courts: 1, names: names(9) }))
    s = skipGame(s, playing(s)[0].id)
    expect(s.line).toEqual(ids(s, 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Ana', 'Ben', 'Cy', 'Dee'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Eli', 'Gus'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Fay', 'Hal'))
  })

  it.each(GRID)('%i players on %i courts: rotation over many games, never more than 2 wins in a row on a court', (n, courts) => {
    let s = fillCourts(createSession({ format: 'winners-split', courts, names: names(n) }))
    const busy = Math.min(courts, Math.floor(n / 4))
    const seen = new Map<string, number>()
    const note = () => playing(s).forEach((g) => seen.has(g.id) || seen.set(g.id, seen.size))
    note()
    // wins in a row on each court for the winners who stayed on
    const streaks = new Map<number, Map<string, number>>()
    for (let i = 0; i < 60; i++) {
      expect(playing(s)).toHaveLength(busy)
      expectConsistent(s)

      const g = [...playing(s)].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)[0]
      const court = streaks.get(g.court) ?? new Map<string, number>()
      const line0 = [...s.line]
      const [a, b] = score(i)
      const winners = a > b ? g.teamA : g.teamB
      const losers = a > b ? g.teamB : g.teamA
      s = fillCourts(recordScore(s, g.id, a, b))
      note()
      const next = onCourt(s, g.court)
      const run = winners.map((w) => (court.get(w) ?? 0) + 1)
      if (Math.max(...run) >= 2) {
        const queue = [...line0, ...losers, ...winners]
        expect(next.teamA).toEqual([queue[0], queue[2]])
        expect(next.teamB).toEqual([queue[1], queue[3]])
        expect(s.line).toEqual(queue.slice(4))
        streaks.set(g.court, new Map())
      } else {
        const queue = [...line0, ...losers]
        expect(teamsKey(next)).toEqual([pairKey(winners[0], queue[0]), pairKey(winners[1], queue[1])].sort())
        expect(s.line).toEqual(queue.slice(2))
        streaks.set(g.court, new Map([[winners[0], run[0]], [winners[1], run[1]]]))
      }
    }
  })
})

// ---------- Americano ----------

describe('Americano', () => {
  it('4 players: a new partner every game for 3 rounds, then a repeat because it can’t be avoided', () => {
    let s = createSession({ format: 'americano', courts: 1, names: names(4) })
    const pairings = new Set<string>()
    const partners = new Set<string>()
    for (let r = 0; r < 3; r++) {
      s = fillCourts(s)
      const g = onCourt(s, 1)
      for (const t of [g.teamA, g.teamB]) {
        expect(partners.has(pairKey(...t))).toBe(false)
        partners.add(pairKey(...t))
      }
      pairings.add(teamsKey(g).join('/'))
      s = recordScore(s, g.id, 11, r)
    }
    expect(pairings.size).toBe(3)
    s = fillCourts(s)
    expect(playing(s)).toHaveLength(1)
  })

  it('starts a new round only when no game is on any court', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 2, names: names(9) }))
    const [g1, g2] = playing(s)
    s = fillCourts(recordScore(s, g1.id, 11, 4))
    expect(playing(s).map((g) => g.id)).toEqual([g2.id])
    s = fillCourts(skipGame(s, g2.id))
    expect(playing(s)).toHaveLength(2)
    expect(playing(s).map((g) => g.id)).not.toContain(g2.id)
  })

  it('a round uses min(courts, floor(available / 4)) courts; players on time out are not available', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 3, names: names(9) }))
    expect(playing(s)).toHaveLength(2)
    for (const g of playing(s)) s = recordScore(s, g.id, 11, 2)
    s = timeOut(s, s.line[0])
    s = fillCourts(s) // 8 available
    expect(playing(s)).toHaveLength(2)
    for (const g of playing(s)) s = recordScore(s, g.id, 11, 2)
    s = timeOut(s, s.line[0])
    s = fillCourts(s) // 7 available
    expect(playing(s)).toHaveLength(1)
    expectConsistent(s)
  })

  it('keeps individual wins, losses and points', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 1, names: names(4) }))
    const g = playing(s)[0]
    s = recordScore(s, g.id, 11, 7)
    const rows = standings(s)
    for (const pid of g.teamA)
      expect(rows.find((r) => r.playerId === pid)).toMatchObject({ wins: 1, losses: 0, games: 1, pointsFor: 11, pointsAgainst: 7 })
    for (const pid of g.teamB)
      expect(rows.find((r) => r.playerId === pid)).toMatchObject({ wins: 0, losses: 1, games: 1, pointsFor: 7, pointsAgainst: 11 })
  })

  it.each(GRID)('%i players on %i courts: fewest turns play, and no repeat partner until it can’t be avoided', (n, courts) => {
    let s = createSession({ format: 'americano', courts, names: names(n) })
    const busy = Math.min(courts, Math.floor(n / 4))
    const partnered = new Set<string>()
    for (let r = 0; r < 14; r++) {
      const before = s
      s = fillCourts(s)
      const round = playing(s)
      expect(round).toHaveLength(busy)
      expectConsistent(s)
      expect(new Set(round.map((g) => g.court)).size).toBe(busy)

      const inRound = round.flatMap(playersOf)
      const sitting = s.players.filter((p) => !inRound.includes(p.id)).map((p) => p.id)
      const t = (pid: string) => turns(before, pid, { includePlaying: false })
      if (sitting.length > 0)
        expect(Math.max(...inRound.map(t))).toBeLessThanOrEqual(Math.min(...sitting.map(t)))

      const teams = round.flatMap((g) => [pairKey(...g.teamA), pairKey(...g.teamB)])
      if (canPairAvoiding(inRound, partnered)) for (const k of teams) expect(partnered.has(k)).toBe(false)
      teams.forEach((k) => partnered.add(k))

      round.forEach((g, i) => {
        const [a, b] = score(r * 3 + i)
        s = recordScore(s, g.id, a, b)
      })
      const counts = s.players.map((p) => turns(s, p.id, { includePlaying: false }))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })
})

// ---------- standings ----------

describe('standings', () => {
  /** A session with hand-made games, built on a real one so the ids are the engine's. */
  function withGames(format: Format, spec: Array<[string[], string[], Game['status'], number?, number?]>) {
    const base = createSession({ format, courts: 3, names: names(8) })
    const games: Game[] = spec.map(([a, b, st, sa, sb], i): Game => ({
      id: `g${i}`,
      court: 1,
      teamA: [id(base, a[0]), id(base, a[1])],
      teamB: [id(base, b[0]), id(base, b[1])],
      status: st,
      ...(sa === undefined ? {} : { scoreA: sa, scoreB: sb }),
    }))
    return { ...base, games } satisfies Session
  }

  const tiebreaks = () =>
    withGames('americano', [
      [['Ana', 'Ben'], ['Cy', 'Dee'], 'scored', 11, 5],
      [['Ana', 'Cy'], ['Eli', 'Fay'], 'scored', 11, 9],
      [['Ben', 'Eli'], ['Gus', 'Hal'], 'scored', 3, 11],
      [['Ana', 'Dee'], ['Fay', 'Hal'], 'skipped'],
      [['Ben', 'Cy'], ['Gus', 'Eli'], 'cancelled'],
    ])

  it('ranks by wins, then win rate, then point difference; only scored games count', () => {
    const s = tiebreaks()
    const rows = standings(s)
    expect(rows.map((r) => r.name)).toHaveLength(8)
    expect(rows[0]).toEqual({
      playerId: id(s, 'Ana'), name: 'Ana', place: 1, wins: 2, losses: 0, games: 2, pointsFor: 22, pointsAgainst: 14,
    })
    // Gus and Hal: 1 win from 1 game beats Ben and Cy's 1 from 2
    expect(rows.slice(1, 3).map((r) => r.name).sort()).toEqual(['Gus', 'Hal'])
    // Ben (−2) ahead of Cy (−4) on point difference
    expect(rows.slice(3).map((r) => r.name)).toEqual(['Ben', 'Cy', 'Fay', 'Dee', 'Eli'])
    expect(rows.find((r) => r.name === 'Ben')).toMatchObject({ wins: 1, losses: 1, games: 2, pointsFor: 14, pointsAgainst: 16 })
    expect(rows.find((r) => r.name === 'Eli')).toMatchObject({ wins: 0, losses: 2, games: 2, pointsFor: 12, pointsAgainst: 22 })
    expect(rows.find((r) => r.name === 'Dee')).toMatchObject({ games: 1, pointsFor: 5, pointsAgainst: 11 })
  })

  it('players equal on all four share a place', () => {
    const rows = standings(tiebreaks())
    const gus = rows.find((r) => r.name === 'Gus')!
    const hal = rows.find((r) => r.name === 'Hal')!
    expect(gus.place).toBe(2)
    expect(hal.place).toBe(2)
    const places = rows.map((r) => r.place)
    expect(places).toEqual([...places].sort((a, b) => a - b))
    expect(rows.find((r) => r.name === 'Ben')!.place).toBeGreaterThan(2)
    expect(new Set(places).size).toBe(7)
  })

  it('win rate comes before point difference when wins are equal', () => {
    const s = withGames('fair', [
      [['Ana', 'Ben'], ['Cy', 'Dee'], 'scored', 11, 10],
      [['Eli', 'Fay'], ['Gus', 'Hal'], 'scored', 11, 0],
      [['Eli', 'Fay'], ['Cy', 'Dee'], 'scored', 10, 11],
    ])
    const rows = standings(s)
    // Ana & Ben: 1–0, +1. Eli & Fay: 1–1, +10. Cy & Dee: 1–1, 0. Gus & Hal: 0–1, −11.
    expect(rows.slice(0, 2).map((r) => r.name).sort()).toEqual(['Ana', 'Ben'])
    expect(rows.slice(2, 4).map((r) => r.name).sort()).toEqual(['Eli', 'Fay'])
    expect(rows.slice(4, 6).map((r) => r.name).sort()).toEqual(['Cy', 'Dee'])
    expect(rows.slice(6).map((r) => r.name).sort()).toEqual(['Gus', 'Hal'])
    for (const i of [0, 2, 4, 6]) expect(rows[i + 1].place).toBe(rows[i].place)
    expect(rows[2].place).toBeGreaterThan(rows[0].place)
    expect(rows[4].place).toBeGreaterThan(rows[2].place)
  })

  it('then points scored when wins, win rate and point difference are equal', () => {
    const s = withGames('fair', [
      [['Ana', 'Ben'], ['Cy', 'Dee'], 'scored', 11, 9],
      [['Gus', 'Hal'], ['Eli', 'Fay'], 'scored', 13, 15],
    ])
    const rows = standings(s)
    expect(rows.slice(0, 2).map((r) => r.name).sort()).toEqual(['Eli', 'Fay'])
    expect(rows.slice(2, 4).map((r) => r.name).sort()).toEqual(['Ana', 'Ben'])
    expect(rows.slice(4, 6).map((r) => r.name).sort()).toEqual(['Gus', 'Hal'])
    expect(rows.slice(6).map((r) => r.name).sort()).toEqual(['Cy', 'Dee'])
    expect(rows[2].place).toBeGreaterThan(rows[0].place)
    expect(rows[4].place).toBeGreaterThan(rows[2].place)
    expect(rows[6].place).toBeGreaterThan(rows[4].place)
  })

  it('leaves out removed players but keeps their games for the others', () => {
    let s = tiebreaks()
    s = removePlayer(s, id(s, 'Dee'))
    const rows = standings(s)
    expect(rows.map((r) => r.name)).not.toContain('Dee')
    expect(rows).toHaveLength(7)
    expect(rows[0]).toMatchObject({ name: 'Ana', wins: 2, pointsFor: 22, pointsAgainst: 14 })
    expect(rows.find((r) => r.name === 'Cy')).toMatchObject({ wins: 1, losses: 1, pointsFor: 16, pointsAgainst: 20 })
  })
})

// ---------- saving ----------

describe('serialize and deserialize', () => {
  function played() {
    let s = fillCourts(createSession({ format: 'winners-split', courts: 2, names: names(11) }))
    s = recordScore(s, playing(s)[0].id, 11, 8)
    s = fillCourts(s)
    s = skipGame(s, playing(s)[1].id)
    s = timeOut(s, s.line[0])
    s = removePlayer(s, playing(s)[0].teamB[1])
    return fillCourts(s)
  }

  it('round-trips a session through JSON unchanged', () => {
    const s = played()
    const json = serialize(s)
    expect(typeof json).toBe('string')
    expect(deserialize(json)).toEqual(s)
  })

  it('writes version 1', () => {
    expect(JSON.parse(serialize(played())).version).toBe(1)
  })

  it('a restored session carries on', () => {
    const s = deserialize(serialize(played()))!
    const g = playing(s)[0]
    const next = recordScore(s, g.id, 11, 9)
    expect(next.games.find((x) => x.id === g.id)!.status).toBe('scored')
    expect(standings(next).length).toBe(s.players.filter((p) => p.status !== 'removed').length)
    expect(nameOf(s, s.players[0].id)).toBe('Ana')
  })

  it.each([2, 0, '1', null])('refuses version %s instead of guessing', (version) => {
    const obj = JSON.parse(serialize(played()))
    obj.version = version
    expect(deserialize(JSON.stringify(obj))).toBeNull()
  })

  it('refuses a missing version', () => {
    const obj = JSON.parse(serialize(played()))
    delete obj.version
    expect(deserialize(JSON.stringify(obj))).toBeNull()
  })

  it.each(['', 'not json', 'null', '[]', '{}', '42', '"text"'])('returns null for malformed input %j', (json) => {
    expect(deserialize(json)).toBeNull()
  })

  it.each([
    ['players', 'oops'],
    ['line', { a: 1 }],
    ['games', null],
    ['format', 'king-of-the-court'],
    ['courts', 40],
  ])('returns null when %s is broken', (key, value) => {
    const obj = JSON.parse(serialize(played()))
    const breakKey = (o: unknown): void => {
      if (!o || typeof o !== 'object') return
      for (const [k, v] of Object.entries(o)) {
        if (k === key) (o as Record<string, unknown>)[k] = value
        else breakKey(v)
      }
    }
    breakKey(obj)
    expect(deserialize(JSON.stringify(obj))).toBeNull()
  })
})
