// T8.3 Engine: title, singles, levels and fixed pairs (TASKS.md T8.3; SPEC §4 "Paddle Stack rules", updated for
// T8.3, and the plan gate: singles mirrors doubles, three levels, Winners stay with fixed pairs keeps the winning pair
// together against the next pair with the 2-win cap).
//
// Names the tests rely on (the plan's):
// - types: `Play = 'singles' | 'doubles'`, `Teams = 'open' | 'fixed'`, `Level = 1 | 2 | 3`,
//   `Team = [string] | [string, string]`; `Session.title` ('' when none), `Session.play`, `Session.teams`;
//   `Player.level?`, `Player.partner?` (the partner's player id, fixed pairs only); `Game.teamA` / `teamB` are `Team`;
// - engine: `createSession({ format, courts, title?, play?, teams?, names?, pairs? })`, `NewPlayer`,
//   `addPlayers` (throws `needs-pair` with fixed pairs), `addPairs`, `setLevel(session, id, level | null)`,
//   `MAX_TITLE = 60`, `LEVELS = [1, 2, 3]`, codes `bad-combo`, `bad-title`, `needs-pair`, `bad-level`;
//   `serialize` writes version 2, `deserialize` loads version 1 as doubles / open / title ''.
import { describe, expect, it } from 'vitest'
import {
  LEVELS,
  MAX_TITLE,
  StackError,
  addPairs,
  addPlayers,
  backInLine,
  createSession,
  deserialize,
  fillCourts,
  recordScore,
  removePlayer,
  serialize,
  setLevel,
  skipGame,
  standings,
  timeOut,
  type NewPlayer,
} from './engine'
import type { Format, Game, Level, Session } from './types'

// ---------- helpers ----------

const NAMES = [
  'Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida',
  'Jo', 'Kit', 'Lu', 'Mo', 'Ned', 'Oli', 'Pia', 'Quin', 'Ray',
]
const names = (n: number) => NAMES.slice(0, n)
/** n pairs from NAMES: [Ana, Ben], [Cy, Dee], … */
const pairsOf = (n: number): [string, string][] =>
  Array.from({ length: n }, (_, i) => [NAMES[i * 2], NAMES[i * 2 + 1]] as [string, string])

function id(s: Session, name: string): string {
  const p = s.players.find((x) => x.name === name)
  if (!p) throw new Error(`no player ${name}`)
  return p.id
}
const ids = (s: Session, ...ns: string[]) => ns.map((n) => id(s, n))
const player = (s: Session, name: string) => s.players.find((p) => p.name === name)!
const status = (s: Session, name: string) => player(s, name).status

const playing = (s: Session) => s.games.filter((g) => g.status === 'playing')
const onCourt = (s: Session, court: number) => {
  const gs = playing(s).filter((g) => g.court === court)
  expect(gs, `one game on court ${court}`).toHaveLength(1)
  return gs[0]
}
const side = (t: readonly string[]): string[] => [...t]
const playersOf = (g: Game) => [...side(g.teamA), ...side(g.teamB)]
const key = (...xs: string[]) => [...xs].sort().join('|')

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

function turns(s: Session, pid: string, opts: { includePlaying: boolean }) {
  return s.games.filter(
    (g) =>
      (g.status === 'scored' || g.status === 'skipped' || (opts.includePlaying && g.status === 'playing')) &&
      playersOf(g).includes(pid),
  ).length
}

/** Every active player is in the line or on court exactly once; each game has `perSide` a side. */
function expectConsistent(s: Session, perSide: 1 | 2) {
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
  for (const g of s.games) {
    expect(g.teamA).toHaveLength(perSide)
    expect(g.teamB).toHaveLength(perSide)
    expect(new Set(playersOf(g)).size).toBe(perSide * 2)
  }
}

/** Fixed pairs: every team is a pair, partners point at each other, and partners stand next to each other in line. */
function expectPairsTogether(s: Session) {
  for (const p of s.players) {
    expect(p.partner, `${p.name} has a partner`).toBeDefined()
    const partner = s.players.find((x) => x.id === p.partner)!
    expect(partner.partner).toBe(p.id)
    expect(partner.status).toBe(p.status)
  }
  for (const g of s.games) {
    for (const t of [side(g.teamA), side(g.teamB)]) {
      expect(t).toHaveLength(2)
      expect(s.players.find((p) => p.id === t[0])!.partner).toBe(t[1])
    }
  }
  expect(s.line.length % 2).toBe(0)
  for (let i = 0; i < s.line.length; i += 2) {
    expect(s.players.find((p) => p.id === s.line[i])!.partner, `line positions ${i + 1} and ${i + 2} are partners`).toBe(s.line[i + 1])
  }
}

/** The line read pair by pair (fixed pairs). */
const linePairs = (s: Session) => Array.from({ length: s.line.length / 2 }, (_, i) => key(s.line[i * 2], s.line[i * 2 + 1]))
const teamKeys = (g: Game) => [key(...side(g.teamA)), key(...side(g.teamB))].sort()

function score(i: number): [number, number] {
  const loser = (i * 7) % 10
  return i % 3 === 1 ? [loser, 11] : [11, loser]
}

/** Can these players be split into twos with no two in `forbidden`? */
function canPairAvoiding(players: string[], forbidden: Set<string>): boolean {
  if (players.length === 0) return true
  const [first, ...rest] = players
  for (let i = 0; i < rest.length; i++) {
    if (forbidden.has(key(first, rest[i]))) continue
    if (canPairAvoiding([...rest.slice(0, i), ...rest.slice(i + 1)], forbidden)) return true
  }
  return false
}

const COURTS = [1, 2, 3]
const SINGLES_GRID = [2, 3, 5, 7].flatMap((n) => COURTS.map((c) => [n, c] as const))
const PAIRS_GRID = [2, 3, 5, 9].flatMap((n) => COURTS.map((c) => [n, c] as const))

// ---------- session: title, play, teams ----------

describe('createSession defaults (T8.3)', () => {
  it('defaults to doubles, an open queue and no title', () => {
    const s = createSession({ format: 'fair', courts: 2, names: names(4) })
    expect(s.title).toBe('')
    expect(s.play).toBe('doubles')
    expect(s.teams).toBe('open')
    for (const p of s.players) {
      expect(p.level).toBeUndefined()
      expect(p.partner).toBeUndefined()
    }
  })

  it('keeps the chosen play and teams', () => {
    expect(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(2) }).play).toBe('singles')
    const fixed = createSession({ format: 'fair', courts: 1, play: 'doubles', teams: 'fixed', pairs: pairsOf(2) })
    expect(fixed.play).toBe('doubles')
    expect(fixed.teams).toBe('fixed')
  })

  it('an open queue may start with no names at all', () => {
    expect(createSession({ format: 'americano', courts: 1, play: 'singles' }).players).toEqual([])
  })
})

describe('title (T8.3: trimmed, up to 60 characters)', () => {
  it('MAX_TITLE is 60', () => {
    expect(MAX_TITLE).toBe(60)
  })

  it('stores the title trimmed', () => {
    const s = createSession({ format: 'fair', courts: 1, title: '  Sunday Open Play (ALL LEVELS)  ', names: names(4) })
    expect(s.title).toBe('Sunday Open Play (ALL LEVELS)')
  })

  it('a blank title is stored as no title', () => {
    expect(createSession({ format: 'fair', courts: 1, title: '   ', names: [] }).title).toBe('')
    expect(createSession({ format: 'fair', courts: 1, title: '', names: [] }).title).toBe('')
  })

  it('accepts exactly 60 characters (boundary), also with spaces around it', () => {
    const sixty = 'A'.repeat(60)
    expect(createSession({ format: 'fair', courts: 1, title: sixty, names: [] }).title).toBe(sixty)
    expect(createSession({ format: 'fair', courts: 1, title: `   ${sixty}   `, names: [] }).title).toBe(sixty)
  })

  it('refuses 61 characters with bad-title', () => {
    expectCode(() => createSession({ format: 'fair', courts: 1, title: 'A'.repeat(61), names: names(4) }), 'bad-title')
  })
})

describe('refused combinations (T8.3: bad-combo)', () => {
  it('Winners stay & split is not offered in singles', () => {
    expectCode(() => createSession({ format: 'winners-split', courts: 1, play: 'singles', names: names(4) }), 'bad-combo')
  })

  it.each<Format>(['fair', 'winners-split', 'americano'])('fixed pairs are not offered in singles (%s)', (format) => {
    expectCode(() => createSession({ format, courts: 1, play: 'singles', teams: 'fixed', pairs: pairsOf(2) }), 'bad-combo')
  })

  it('Americano (changing partners) is not offered with fixed pairs', () => {
    expectCode(() => createSession({ format: 'americano', courts: 1, teams: 'fixed', pairs: pairsOf(2) }), 'bad-combo')
  })

  it('accepts every offered combination', () => {
    const offered: [Format, 'singles' | 'doubles', 'open' | 'fixed'][] = [
      ['fair', 'singles', 'open'],
      ['americano', 'singles', 'open'],
      ['fair', 'doubles', 'open'],
      ['winners-split', 'doubles', 'open'],
      ['americano', 'doubles', 'open'],
      ['fair', 'doubles', 'fixed'],
      ['winners-split', 'doubles', 'fixed'],
    ]
    for (const [format, play, teams] of offered) {
      const s =
        teams === 'fixed'
          ? createSession({ format, courts: 1, play, teams, pairs: pairsOf(2) })
          : createSession({ format, courts: 1, play, teams, names: names(4) })
      expect([s.format, s.play, s.teams]).toEqual([format, play, teams])
    }
  })

  it('an unknown play or teams value is refused with a StackError', () => {
    expect(() =>
      createSession({ format: 'fair', courts: 1, play: 'triples' as unknown as 'singles', names: names(4) }),
    ).toThrow(StackError)
    expect(() =>
      createSession({ format: 'fair', courts: 1, teams: 'mixed' as unknown as 'open', names: names(4) }),
    ).toThrow(StackError)
  })
})

// ---------- singles ----------

describe('Fair rotation in singles (T8.3: the 2 waiting longest play each other)', () => {
  it('fills courts lowest first with one player a side, line positions 1 against 2', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 3, play: 'singles', names: names(5) }))
    expect(playing(s)).toHaveLength(2)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben'))
    expect(onCourt(s, 2).teamA).toEqual(ids(s, 'Cy'))
    expect(onCourt(s, 2).teamB).toEqual(ids(s, 'Dee'))
    expect(s.line).toEqual(ids(s, 'Eli'))
    expect(status(s, 'Ana')).toBe('playing')
    expectConsistent(s, 1)
  })

  it('needs 2 waiting: 1 player fills nothing, 2 players fill a court', () => {
    const one = createSession({ format: 'fair', courts: 2, play: 'singles', names: names(1) })
    expect(fillCourts(one)).toEqual(one)
    expect(playing(fillCourts(createSession({ format: 'fair', courts: 2, play: 'singles', names: names(2) })))).toHaveLength(1)
  })

  it('after a game both go to the back in the order they came on, and the next 2 take the court', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(4) }))
    s = recordScore(s, onCourt(s, 1).id, 5, 11)
    expect(s.line).toEqual(ids(s, 'Cy', 'Dee', 'Ana', 'Ben'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Dee'))
    expect(s.line).toEqual(ids(s, 'Ana', 'Ben'))
  })

  it('a skipped singles game rotates the same way and counts for nobody', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(3) }))
    s = fillCourts(skipGame(s, onCourt(s, 1).id))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ana'))
    expect(s.line).toEqual(ids(s, 'Ben'))
    expect(standings(s).every((r) => r.games === 0)).toBe(true)
  })

  it('a scored singles game counts one win and one loss with the points', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(3) }))
    s = recordScore(s, onCourt(s, 1).id, 11, 7)
    const rows = standings(s)
    expect(rows[0]).toMatchObject({ name: 'Ana', place: 1, wins: 1, losses: 0, games: 1, pointsFor: 11, pointsAgainst: 7 })
    expect(rows.find((r) => r.name === 'Ben')).toMatchObject({ wins: 0, losses: 1, games: 1, pointsFor: 7, pointsAgainst: 11 })
    expect(rows.find((r) => r.name === 'Cy')).toMatchObject({ wins: 0, losses: 0, games: 0 })
  })

  it('removing a player on court cancels the game; the opponent goes to the front of the line', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(4) }))
    const gid = onCourt(s, 1).id
    s = removePlayer(s, id(s, 'Ana'))
    expect(s.games.find((g) => g.id === gid)!.status).toBe('cancelled')
    expect(status(s, 'Ana')).toBe('removed')
    expect(s.line).toEqual(ids(s, 'Ben', 'Cy', 'Dee'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ben'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy'))
    expectConsistent(s, 1)
  })

  it('time out and back in line work as in doubles', () => {
    let s = createSession({ format: 'fair', courts: 1, play: 'singles', names: names(4) })
    s = fillCourts(timeOut(s, id(s, 'Ana')))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ben'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy'))
    s = backInLine(s, id(s, 'Ana'))
    expect(s.line).toEqual(ids(s, 'Dee', 'Ana'))
  })

  it('players added later join the back of the line', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(3) }))
    s = addPlayers(s, ['Zed'])
    expect(s.line).toEqual([id(s, 'Cy'), id(s, 'Zed')])
  })

  it.each(SINGLES_GRID)('%i players on %i courts: rotation over many games, nobody waits more than one game longer', (n, courts) => {
    let s = fillCourts(createSession({ format: 'fair', courts, play: 'singles', names: names(n) }))
    const busy = Math.min(courts, Math.floor(n / 2))
    const seen = new Map<string, number>()
    const note = () => playing(s).forEach((g) => seen.has(g.id) || seen.set(g.id, seen.size))
    note()
    for (let i = 0; i < 40; i++) {
      expect(playing(s)).toHaveLength(busy)
      expectConsistent(s, 1)
      const counts = s.players.map((p) => turns(s, p.id, { includePlaying: true }))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)

      const g = [...playing(s)].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)[0]
      const queue = [...s.line, side(g.teamA)[0], side(g.teamB)[0]]
      const [a, b] = score(i)
      s = i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, a, b)
      s = fillCourts(s)
      note()
      const next = onCourt(s, g.court)
      expect(next.teamA).toEqual([queue[0]])
      expect(next.teamB).toEqual([queue[1]])
      expect(s.line).toEqual(queue.slice(2))
    }
  })
})

describe('Americano in singles (T8.3: rounds, fewest turns first, avoiding repeat opponents)', () => {
  it('a round uses min(courts, floor(available / 2)) courts, one a side', () => {
    const s = fillCourts(createSession({ format: 'americano', courts: 3, play: 'singles', names: names(5) }))
    expect(playing(s)).toHaveLength(2)
    expectConsistent(s, 1)
    expect(s.line).toHaveLength(1)
  })

  it('starts a new round only when no game is on any court', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 2, play: 'singles', names: names(5) }))
    const [g1, g2] = playing(s)
    s = fillCourts(recordScore(s, g1.id, 11, 4))
    expect(playing(s).map((g) => g.id)).toEqual([g2.id])
    s = fillCourts(skipGame(s, g2.id))
    expect(playing(s)).toHaveLength(2)
    expect(playing(s).map((g) => g.id)).not.toContain(g2.id)
  })

  it('the player who sat out plays in the next round', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 1, play: 'singles', names: names(3) }))
    const sat = s.line[0]
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 6))
    expect(playersOf(onCourt(s, 1))).toContain(sat)
  })

  it('4 players on 2 courts: everyone meets everyone once in 3 rounds', () => {
    let s = createSession({ format: 'americano', courts: 2, play: 'singles', names: names(4) })
    const met = new Set<string>()
    for (let r = 0; r < 3; r++) {
      s = fillCourts(s)
      expect(playing(s)).toHaveLength(2)
      for (const g of playing(s)) {
        const k = key(...playersOf(g))
        expect(met.has(k), `repeat opponents in round ${r + 1}`).toBe(false)
        met.add(k)
        s = recordScore(s, g.id, 11, r)
      }
    }
    expect(met.size).toBe(6)
  })

  it('removing a player on court: the opponent waits for the next round', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 2, play: 'singles', names: names(5) }))
    const [g1, g2] = playing(s)
    const [gone, other] = playersOf(g1)
    s = removePlayer(s, gone)
    expect(s.games.find((g) => g.id === g1.id)!.status).toBe('cancelled')
    expect(s.players.find((p) => p.id === other)!.status).toBe('waiting')
    expect(playing(fillCourts(s)).map((g) => g.id)).toEqual([g2.id])
    expectConsistent(s, 1)
  })

  it('keeps individual wins, losses and points', () => {
    let s = fillCourts(createSession({ format: 'americano', courts: 1, play: 'singles', names: names(2) }))
    const g = onCourt(s, 1)
    s = recordScore(s, g.id, 9, 11)
    expect(standings(s).find((r) => r.playerId === side(g.teamB)[0])).toMatchObject({ wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 9 })
    expect(standings(s).find((r) => r.playerId === side(g.teamA)[0])).toMatchObject({ wins: 0, losses: 1, pointsFor: 9, pointsAgainst: 11 })
  })

  it.each(SINGLES_GRID)('%i players on %i courts: fewest turns play, and no repeat opponent until it can’t be avoided', (n, courts) => {
    let s = createSession({ format: 'americano', courts, play: 'singles', names: names(n) })
    const busy = Math.min(courts, Math.floor(n / 2))
    const opposed = new Set<string>()
    for (let r = 0; r < 12; r++) {
      const before = s
      s = fillCourts(s)
      const round = playing(s)
      expect(round).toHaveLength(busy)
      expectConsistent(s, 1)
      expect(new Set(round.map((g) => g.court)).size).toBe(busy)

      const inRound = round.flatMap(playersOf)
      const sitting = s.players.filter((p) => !inRound.includes(p.id)).map((p) => p.id)
      const t = (pid: string) => turns(before, pid, { includePlaying: false })
      if (sitting.length > 0) expect(Math.max(...inRound.map(t))).toBeLessThanOrEqual(Math.min(...sitting.map(t)))

      const matchups = round.map((g) => key(...playersOf(g)))
      if (canPairAvoiding(inRound, opposed)) for (const k of matchups) expect(opposed.has(k), `round ${r + 1} repeats ${k}`).toBe(false)
      matchups.forEach((k) => opposed.add(k))

      round.forEach((g, i) => {
        const [a, b] = score(r * 3 + i)
        s = recordScore(s, g.id, a, b)
      })
      const counts = s.players.map((p) => turns(s, p.id, { includePlaying: false }))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })
})

describe('doubles stays as it was (T8.3)', () => {
  it('play: doubles explicitly fills like the default: positions 1 & 3 against 2 & 4', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'doubles', names: names(5) }))
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Cy'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Ben', 'Dee'))
    expectConsistent(s, 2)
  })

  it('doubles still needs 4 waiting', () => {
    const s = createSession({ format: 'fair', courts: 1, play: 'doubles', names: names(3) })
    expect(fillCourts(s)).toEqual(s)
  })
})

// ---------- fixed pairs ----------

describe('fixed pairs: entering pairs (T8.3)', () => {
  it('createSession with pairs: partners point at each other and stand next to each other in line', () => {
    const s = createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) })
    expect(s.players.map((p) => p.name)).toEqual(names(6))
    expect(s.line).toEqual(ids(s, ...names(6)))
    expect(player(s, 'Ana').partner).toBe(id(s, 'Ben'))
    expect(player(s, 'Ben').partner).toBe(id(s, 'Ana'))
    expect(player(s, 'Eli').partner).toBe(id(s, 'Fay'))
    expectPairsTogether(s)
  })

  it('a pair with an empty or taken name, or the same name twice, is skipped whole', () => {
    const s = createSession({
      format: 'fair',
      courts: 1,
      teams: 'fixed',
      pairs: [
        ['Ana', 'Ben'],
        ['ana', 'Gus'],
        ['Hal', '   '],
        ['Ida', 'IDA'],
        ['  Jo ', 'Kit'],
      ],
    })
    expect(s.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Jo', 'Kit'])
    expectPairsTogether(s)
  })

  it('pairs may carry levels', () => {
    const s = createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: [[{ name: 'Ana', level: 3 }, 'Ben'], pairsOf(2)[1]] })
    expect(player(s, 'Ana').level).toBe(3)
    expect(player(s, 'Ben').level).toBeUndefined()
  })

  it('addPlayers is refused with needs-pair, leaving the session as it was', () => {
    const s = deepFreeze(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(2) }))
    const before = JSON.stringify(s)
    expectCode(() => addPlayers(s, ['Zed']), 'needs-pair')
    expect(JSON.stringify(s)).toBe(before)
  })

  it('createSession with single names on a fixed-pairs session is refused with needs-pair', () => {
    expectCode(() => createSession({ format: 'fair', courts: 1, teams: 'fixed', names: names(4) }), 'needs-pair')
  })

  it('addPairs adds pairs to the back of the line, partners together, skipping bad pairs whole', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    s = addPairs(s, [
      ['Gus', 'Hal'],
      ['Ana', 'Ida'],
      ['Jo', 'Kit'],
    ])
    expect(s.line).toEqual(ids(s, 'Eli', 'Fay', 'Gus', 'Hal', 'Jo', 'Kit'))
    expect(s.players.map((p) => p.name)).not.toContain('Ida')
    expect(player(s, 'Gus').partner).toBe(id(s, 'Hal'))
    expectPairsTogether(s)
  })

  it('addPairs never mutates its input', () => {
    const s = deepFreeze(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(2) }))
    const next = addPairs(s, [['Eli', 'Fay']])
    expect(next.players).toHaveLength(6)
    expect(s.players).toHaveLength(4)
  })
})

describe('fixed pairs: queueing (T8.3)', () => {
  it('Fair rotation: the first pair in line plays the second pair', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 3, teams: 'fixed', pairs: pairsOf(5) }))
    expect(playing(s)).toHaveLength(2)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Ben'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy', 'Dee'))
    expect(onCourt(s, 2).teamA).toEqual(ids(s, 'Eli', 'Fay'))
    expect(onCourt(s, 2).teamB).toEqual(ids(s, 'Gus', 'Hal'))
    expect(s.line).toEqual(ids(s, 'Ida', 'Jo'))
    expectPairsTogether(s)
  })

  it('Fair rotation: after a game both pairs go to the back, pair by pair, in the order they came on', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    s = recordScore(s, onCourt(s, 1).id, 4, 11)
    expect(linePairs(s)).toEqual([key(...ids(s, 'Eli', 'Fay')), key(...ids(s, 'Ana', 'Ben')), key(...ids(s, 'Cy', 'Dee'))])
    expectPairsTogether(s)
    s = fillCourts(s)
    expect(teamKeys(onCourt(s, 1))).toEqual([key(...ids(s, 'Eli', 'Fay')), key(...ids(s, 'Ana', 'Ben'))].sort())
  })

  it('a court waits until two pairs are free', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 2, teams: 'fixed', pairs: pairsOf(3) }))
    expect(playing(s)).toHaveLength(1)
    expect(s.line).toEqual(ids(s, 'Eli', 'Fay'))
  })

  it.each(PAIRS_GRID)('Fair rotation, %i pairs on %i courts: pairs stay together and rotate fairly over many games', (n, courts) => {
    let s = fillCourts(createSession({ format: 'fair', courts, teams: 'fixed', pairs: pairsOf(n) }))
    const busy = Math.min(courts, Math.floor(n / 2))
    const seen = new Map<string, number>()
    const note = () => playing(s).forEach((g) => seen.has(g.id) || seen.set(g.id, seen.size))
    note()
    for (let i = 0; i < 40; i++) {
      expect(playing(s)).toHaveLength(busy)
      expectConsistent(s, 2)
      expectPairsTogether(s)
      const counts = s.players.map((p) => turns(s, p.id, { includePlaying: true }))
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)

      const g = [...playing(s)].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)[0]
      const queue = [...linePairs(s), key(...side(g.teamA)), key(...side(g.teamB))]
      const [a, b] = score(i)
      s = fillCourts(i % 5 === 4 ? skipGame(s, g.id) : recordScore(s, g.id, a, b))
      note()
      expect(teamKeys(onCourt(s, g.court))).toEqual([queue[0], queue[1]].sort())
      expect(linePairs(s)).toEqual(queue.slice(2))
    }
  })
})

describe('fixed pairs: a time out and removal apply to the pair (T8.3)', () => {
  it('a time out on either partner takes both out of the line', () => {
    let s = createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) })
    s = timeOut(s, id(s, 'Ben'))
    expect(status(s, 'Ana')).toBe('out')
    expect(status(s, 'Ben')).toBe('out')
    expect(s.line).toEqual(ids(s, 'Cy', 'Dee', 'Eli', 'Fay'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Cy', 'Dee'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Eli', 'Fay'))
  })

  it('back in line on either partner puts both at the back, together', () => {
    let s = createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) })
    s = backInLine(timeOut(s, id(s, 'Ana')), id(s, 'Ben'))
    expect(status(s, 'Ana')).toBe('waiting')
    expect(status(s, 'Ben')).toBe('waiting')
    expect(s.line.slice(0, 4)).toEqual(ids(s, 'Cy', 'Dee', 'Eli', 'Fay'))
    expect([...s.line.slice(4)].sort()).toEqual(ids(s, 'Ana', 'Ben').sort())
    expectPairsTogether(s)
  })

  it('a pair on court can’t take a time out (not-waiting)', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    expectCode(() => timeOut(s, id(s, 'Ana')), 'not-waiting')
  })

  it('removing a waiting partner removes the pair from the line and the standings', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    s = removePlayer(s, id(s, 'Fay'))
    expect(status(s, 'Eli')).toBe('removed')
    expect(status(s, 'Fay')).toBe('removed')
    expect(s.line).toEqual([])
    expect(standings(s).map((r) => r.name)).toEqual(names(4))
  })

  it('removing a pair on court cancels the game; the other pair goes to the front of the line', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    const gid = onCourt(s, 1).id
    s = removePlayer(s, id(s, 'Ben'))
    const g = s.games.find((x) => x.id === gid)!
    expect(g.status).toBe('cancelled')
    expect(g.scoreA).toBeUndefined()
    expect(status(s, 'Ana')).toBe('removed')
    expect(status(s, 'Ben')).toBe('removed')
    expect(s.line).toEqual(ids(s, 'Cy', 'Dee', 'Eli', 'Fay'))
    s = fillCourts(s)
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Cy', 'Dee'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Eli', 'Fay'))
    expectPairsTogether({ ...s, players: s.players.filter((p) => p.status !== 'removed'), games: playing(s) })
  })
})

describe('fixed pairs: Winners stay keeps the winning pair together (plan gate, 2026-11-18)', () => {
  const start = () => fillCourts(createSession({ format: 'winners-split', courts: 1, teams: 'fixed', pairs: pairsOf(4) }))

  it('the first game is pair 1 against pair 2', () => {
    const s = start()
    expect(onCourt(s, 1).teamA).toEqual(ids(s, 'Ana', 'Ben'))
    expect(onCourt(s, 1).teamB).toEqual(ids(s, 'Cy', 'Dee'))
  })

  it('the losing pair goes to the back; the winning pair stays together against the next pair', () => {
    let s = start()
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 6)) // Ana & Ben win
    expect(teamKeys(onCourt(s, 1))).toEqual([key(...ids(s, 'Ana', 'Ben')), key(...ids(s, 'Eli', 'Fay'))].sort())
    expect(linePairs(s)).toEqual([key(...ids(s, 'Gus', 'Hal')), key(...ids(s, 'Cy', 'Dee'))])
    expectPairsTogether(s)
  })

  it('after 2 wins in a row the winning pair goes off too, losers first, and the court refills from the front', () => {
    let s = start()
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 6))
    const g2 = onCourt(s, 1)
    const anaIsA = side(g2.teamA).includes(id(s, 'Ana'))
    s = fillCourts(recordScore(s, g2.id, anaIsA ? 11 : 3, anaIsA ? 3 : 11)) // Ana & Ben win again
    // line was Gus/Hal, Cy/Dee; then the losers Eli/Fay, then Ana/Ben
    expect(teamKeys(onCourt(s, 1))).toEqual([key(...ids(s, 'Gus', 'Hal')), key(...ids(s, 'Cy', 'Dee'))].sort())
    expect(linePairs(s)).toEqual([key(...ids(s, 'Eli', 'Fay')), key(...ids(s, 'Ana', 'Ben'))])
    expectPairsTogether(s)
  })

  it('when the challengers win, they stay together and the old winners go to the back', () => {
    let s = start()
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 6))
    const g2 = onCourt(s, 1)
    const anaIsA = side(g2.teamA).includes(id(s, 'Ana'))
    s = fillCourts(recordScore(s, g2.id, anaIsA ? 3 : 11, anaIsA ? 11 : 3)) // Eli & Fay win
    expect(teamKeys(onCourt(s, 1))).toEqual([key(...ids(s, 'Eli', 'Fay')), key(...ids(s, 'Gus', 'Hal'))].sort())
    expect(linePairs(s)).toEqual([key(...ids(s, 'Cy', 'Dee')), key(...ids(s, 'Ana', 'Ben'))])
  })

  it('after a skipped game both pairs go to the back', () => {
    let s = start()
    s = fillCourts(skipGame(s, onCourt(s, 1).id))
    expect(teamKeys(onCourt(s, 1))).toEqual([key(...ids(s, 'Eli', 'Fay')), key(...ids(s, 'Gus', 'Hal'))].sort())
    expect(linePairs(s)).toEqual([key(...ids(s, 'Ana', 'Ben')), key(...ids(s, 'Cy', 'Dee'))])
  })

  it.each(PAIRS_GRID)('%i pairs on %i courts: over many games the winners stay together, never more than 2 wins in a row', (n, courts) => {
    let s = fillCourts(createSession({ format: 'winners-split', courts, teams: 'fixed', pairs: pairsOf(n) }))
    const busy = Math.min(courts, Math.floor(n / 2))
    const seen = new Map<string, number>()
    const note = () => playing(s).forEach((g) => seen.has(g.id) || seen.set(g.id, seen.size))
    note()
    /** The pair staying on each court and its wins in a row there. */
    const streaks = new Map<number, { pair: string; run: number }>()
    for (let i = 0; i < 40; i++) {
      expect(playing(s)).toHaveLength(busy)
      expectConsistent(s, 2)
      expectPairsTogether(s)

      const g = [...playing(s)].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)[0]
      const line0 = linePairs(s)
      const [a, b] = score(i)
      const winners = key(...side(a > b ? g.teamA : g.teamB))
      const losers = key(...side(a > b ? g.teamB : g.teamA))
      s = fillCourts(recordScore(s, g.id, a, b))
      note()
      const prev = streaks.get(g.court)
      const run = prev?.pair === winners ? prev.run + 1 : 1
      const next = onCourt(s, g.court)
      if (run >= 2) {
        const queue = [...line0, losers, winners]
        expect(teamKeys(next)).toEqual([queue[0], queue[1]].sort())
        expect(linePairs(s)).toEqual(queue.slice(2))
        streaks.delete(g.court)
      } else {
        const queue = [...line0, losers]
        expect(teamKeys(next)).toEqual([winners, queue[0]].sort())
        expect(linePairs(s)).toEqual(queue.slice(1))
        streaks.set(g.court, { pair: winners, run })
      }
    }
  })
})

// ---------- levels ----------

describe('skill levels (T8.3: 1–3, none fits any group)', () => {
  it('LEVELS is [1, 2, 3]', () => {
    expect(LEVELS).toEqual([1, 2, 3])
  })

  it('createSession and addPlayers take a name or a { name, level }', () => {
    const list: NewPlayer[] = [{ name: 'Ana', level: 1 }, 'Ben', { name: '  Cy  ' }, { name: 'Dee', level: 3 }]
    let s = createSession({ format: 'fair', courts: 1, names: list })
    expect(s.players.map((p) => [p.name, p.level])).toEqual([
      ['Ana', 1],
      ['Ben', undefined],
      ['Cy', undefined],
      ['Dee', 3],
    ])
    s = addPlayers(s, [{ name: 'Eli', level: 2 }, 'Fay'])
    expect(player(s, 'Eli').level).toBe(2)
    expect(player(s, 'Fay').level).toBeUndefined()
  })

  it('a duplicate { name, level } is skipped like a duplicate name', () => {
    const s = createSession({ format: 'fair', courts: 1, names: ['Ana', { name: 'ANA', level: 2 }] })
    expect(s.players).toHaveLength(1)
    expect(s.players[0].level).toBeUndefined()
  })

  it.each([0, 4, 1.5, -1])('a new player with level %s is refused with bad-level', (level) => {
    expectCode(() => createSession({ format: 'fair', courts: 1, names: [{ name: 'Ana', level: level as Level }] }), 'bad-level')
  })

  it('setLevel sets a level and returns a new session', () => {
    const s = deepFreeze(createSession({ format: 'fair', courts: 1, names: names(4) }))
    const next = setLevel(s, id(s, 'Ben'), 2)
    expect(player(next, 'Ben').level).toBe(2)
    expect(player(s, 'Ben').level).toBeUndefined()
    expect(setLevel(next, id(next, 'Ben'), 3).players.find((p) => p.name === 'Ben')!.level).toBe(3)
  })

  it('setLevel with null clears the level', () => {
    let s = createSession({ format: 'fair', courts: 1, names: [{ name: 'Ana', level: 2 }, 'Ben'] })
    s = setLevel(s, id(s, 'Ana'), null)
    expect(player(s, 'Ana').level).toBeUndefined()
  })

  it.each([0, 4, 2.5, '2', undefined])('setLevel refuses %j with bad-level and changes nothing', (level) => {
    const s = deepFreeze(createSession({ format: 'fair', courts: 1, names: names(4) }))
    expectCode(() => setLevel(s, id(s, 'Ana'), level as unknown as Level), 'bad-level')
  })

  it('setLevel on an unknown or removed player gives not-found', () => {
    let s = createSession({ format: 'fair', courts: 1, names: names(4) })
    expectCode(() => setLevel(s, 'nobody', 1), 'not-found')
    s = removePlayer(s, id(s, 'Dee'))
    expectCode(() => setLevel(s, id(s, 'Dee'), 1), 'not-found')
  })

  it('setLevel works on a player on court, and the game goes on', () => {
    let s = fillCourts(createSession({ format: 'fair', courts: 1, names: names(4) }))
    s = setLevel(s, id(s, 'Ana'), 1)
    expect(status(s, 'Ana')).toBe('playing')
    expect(playing(s)).toHaveLength(1)
  })

  it('levels don’t change Fair rotation, Winners stay or Americano', () => {
    const plain = names(9)
    const levelled: NewPlayer[] = plain.map((name, i) => ({ name, level: ((i % 3) + 1) as Level }))
    for (const format of ['fair', 'winners-split', 'americano'] as Format[]) {
      const a = fillCourts(createSession({ format, courts: 2, names: plain }))
      const b = fillCourts(createSession({ format, courts: 2, names: levelled }))
      expect(b.games.map((g) => [g.teamA, g.teamB])).toEqual(a.games.map((g) => [g.teamA, g.teamB]))
      expect(b.line).toEqual(a.line)
    }
  })
})

// ---------- saving ----------

/** A version 1 save, as T5.2–T8.2 wrote it: doubles, no title, no play/teams, no levels. */
function v1Save() {
  return {
    version: 1,
    session: {
      format: 'fair',
      courts: 2,
      players: [
        { id: 'p1', name: 'Ana', status: 'waiting' },
        { id: 'p2', name: 'Ben', status: 'playing' },
        { id: 'p3', name: 'Cy', status: 'playing' },
        { id: 'p4', name: 'Dee', status: 'playing' },
        { id: 'p5', name: 'Eli', status: 'playing' },
        { id: 'p6', name: 'Fay', status: 'out' },
      ],
      line: ['p1'],
      games: [
        { id: 'g1', court: 1, teamA: ['p1', 'p3'], teamB: ['p2', 'p4'], status: 'scored', scoreA: 11, scoreB: 7 },
        { id: 'g2', court: 1, teamA: ['p2', 'p4'], teamB: ['p3', 'p5'], status: 'playing' },
      ],
    },
  }
}

describe('serialize version 2 (T8.3)', () => {
  it('writes version 2', () => {
    expect(JSON.parse(serialize(createSession({ format: 'fair', courts: 1, names: names(4) }))).version).toBe(2)
  })

  it('round-trips the title, singles and levels unchanged', () => {
    let s = createSession({
      format: 'americano',
      courts: 2,
      play: 'singles',
      title: 'Sunday Open Play (ALL LEVELS)',
      names: [{ name: 'Ana', level: 1 }, { name: 'Ben', level: 3 }, 'Cy', { name: 'Dee', level: 2 }, 'Eli'],
    })
    s = fillCourts(s)
    s = recordScore(s, playing(s)[0].id, 11, 4)
    const back = deserialize(serialize(s))
    expect(back).toEqual(s)
    expect(back!.title).toBe('Sunday Open Play (ALL LEVELS)')
    expect(back!.play).toBe('singles')
    expect(back!.players.find((p) => p.name === 'Ben')!.level).toBe(3)
    expect(back!.players.find((p) => p.name === 'Cy')!.level).toBeUndefined()
  })

  it('round-trips a fixed-pairs session, and it carries on with the pairs together', () => {
    let s = fillCourts(createSession({ format: 'winners-split', courts: 1, teams: 'fixed', pairs: pairsOf(3) }))
    s = fillCourts(recordScore(s, onCourt(s, 1).id, 11, 5))
    s = timeOut(s, s.line[0])
    const back = deserialize(serialize(s))!
    expect(back).toEqual(s)
    expect(back.teams).toBe('fixed')
    const next = fillCourts(backInLine(back, back.players.find((p) => p.status === 'out')!.id))
    expectPairsTogether(next)
  })

  it('a restored singles session carries on', () => {
    const s = fillCourts(createSession({ format: 'fair', courts: 1, play: 'singles', names: names(3) }))
    const back = deserialize(serialize(s))!
    const next = fillCourts(recordScore(back, onCourt(back, 1).id, 11, 2))
    expect(onCourt(next, 1).teamA).toEqual(ids(next, 'Cy'))
    expect(onCourt(next, 1).teamB).toEqual(ids(next, 'Ana'))
  })

  it.each([3, 0, '2', 1.5, null, 99])('refuses version %j instead of guessing', (version) => {
    const obj = JSON.parse(serialize(createSession({ format: 'fair', courts: 1, names: names(4) })))
    obj.version = version
    expect(deserialize(JSON.stringify(obj))).toBeNull()
  })
})

describe('deserialize a version 1 save (T8.3: doubles, open queue, no title)', () => {
  it('loads as doubles with an open queue and no title, players and games as saved', () => {
    const s = deserialize(JSON.stringify(v1Save()))
    expect(s).not.toBeNull()
    expect(s!.title).toBe('')
    expect(s!.play).toBe('doubles')
    expect(s!.teams).toBe('open')
    expect(s!.format).toBe('fair')
    expect(s!.courts).toBe(2)
    expect(s!.players.map((p) => [p.id, p.name, p.status])).toEqual(v1Save().session.players.map((p) => [p.id, p.name, p.status]))
    expect(s!.players.every((p) => p.level === undefined && p.partner === undefined)).toBe(true)
    expect(s!.line).toEqual(['p1'])
    expect(s!.games).toEqual(v1Save().session.games)
  })

  it('the resumed stack carries on and is saved again as version 2', () => {
    const s = deserialize(JSON.stringify(v1Save()))!
    const next = fillCourts(recordScore(s, 'g2', 11, 9))
    expect(next.games.find((g) => g.id === 'g2')!.status).toBe('scored')
    expect(standings(next).find((r) => r.name === 'Ana')).toMatchObject({ wins: 1, games: 1 })
    expect(JSON.parse(serialize(next)).version).toBe(2)
    expect(deserialize(serialize(next))).toEqual(next)
  })

  it('refuses a version 1 save with a one-a-side game (version 1 was doubles only)', () => {
    const d = v1Save()
    ;(d.session.games[1] as { teamA: string[] }).teamA = ['p2']
    ;(d.session.games[1] as { teamB: string[] }).teamB = ['p3']
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })

  it('still refuses a broken version 1 save', () => {
    const d = v1Save()
    d.session.line.push('p99')
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })
})

describe('deserialize refuses version 2 saves the engine could never make (T8.3)', () => {
  const saved = () => {
    let s = createSession({ format: 'fair', courts: 2, play: 'singles', title: 'Friday', names: [{ name: 'Ana', level: 2 }, 'Ben', 'Cy'] })
    s = fillCourts(s)
    return JSON.parse(serialize(s)) as { version: number; session: Record<string, unknown> & { players: Record<string, unknown>[]; games: Record<string, unknown>[] } }
  }
  const pairsSaved = () =>
    JSON.parse(serialize(fillCourts(createSession({ format: 'fair', courts: 1, teams: 'fixed', pairs: pairsOf(2) })))) as {
      version: number
      session: Record<string, unknown> & { players: Record<string, unknown>[] }
    }
  const broken = <T>(make: () => T, edit: (d: T) => void) => {
    const d = make()
    edit(d)
    return deserialize(JSON.stringify(d))
  }

  it('accepts the untouched saves', () => {
    expect(broken(saved, () => {})).not.toBeNull()
    expect(broken(pairsSaved, () => {})).not.toBeNull()
  })

  it.each([
    ['an unknown play', (d: ReturnType<typeof saved>) => (d.session.play = 'triples')],
    ['an unknown teams value', (d: ReturnType<typeof saved>) => (d.session.teams = 'mixed')],
    ['a title that is not a string', (d: ReturnType<typeof saved>) => (d.session.title = 42)],
    ['a missing title', (d: ReturnType<typeof saved>) => delete d.session.title],
    ['a title over 60 characters', (d: ReturnType<typeof saved>) => (d.session.title = 'A'.repeat(61))],
    ['a level of 4', (d: ReturnType<typeof saved>) => (d.session.players[0].level = 4)],
    ['a level of 0', (d: ReturnType<typeof saved>) => (d.session.players[0].level = 0)],
    ['a level that is a string', (d: ReturnType<typeof saved>) => (d.session.players[0].level = '2')],
    ['Winners stay in singles', (d: ReturnType<typeof saved>) => (d.session.format = 'winners-split')],
    ['fixed pairs in singles', (d: ReturnType<typeof saved>) => (d.session.teams = 'fixed')],
    ['a singles game with two a side', (d: ReturnType<typeof saved>) => ((d.session.games[0].teamA as string[]).push('p3'))],
  ])('refuses %s', (_label, edit) => {
    expect(broken(saved, edit)).toBeNull()
  })

  it.each([
    ['a partner who is not a player', (d: ReturnType<typeof pairsSaved>) => (d.session.players[0].partner = 'p99')],
    ['a player without a partner', (d: ReturnType<typeof pairsSaved>) => delete d.session.players[0].partner],
    ['partners that don’t point at each other', (d: ReturnType<typeof pairsSaved>) => (d.session.players[0].partner = 'p3')],
    ['Americano with fixed pairs', (d: ReturnType<typeof pairsSaved>) => (d.session.format = 'americano')],
  ])('refuses %s', (_label, edit) => {
    expect(broken(pairsSaved, edit)).toBeNull()
  })

  it('refuses a doubles game with one a side', () => {
    const d = JSON.parse(serialize(fillCourts(createSession({ format: 'fair', courts: 1, names: names(4) }))))
    d.session.games[0].teamA = [d.session.games[0].teamA[0]]
    d.session.games[0].teamB = [d.session.games[0].teamB[0]]
    expect(deserialize(JSON.stringify(d))).toBeNull()
  })
})
