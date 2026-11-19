// T6.1 Live layer: the snapshot format (TASKS.md T6.1; court-booking-system docs/PLATFORM.md §4 "Live stacks":
// "A JSON object with an integer `v` ... at most 64 KB. Its other fields belong to plotline-site").
// Names from the approved plan: `SNAPSHOT_VERSION` (1), `MAX_SNAPSHOT_BYTES` (64 * 1024), `buildSnapshot(session)`,
// `snapshotFits(snapshot)` (UTF-8 JSON size <= the cap), `readSnapshot(value)` (null for unknown `v`, over the cap
// or a bad shape), types `LiveSnapshot`, `SnapshotPlayer`, `SnapshotGame`.
import { describe, expect, it } from 'vitest'
import { addPlayers, createSession, fillCourts, recordScore, removePlayer, skipGame, timeOut } from '../engine'
import type { Session } from '../types'
import { MAX_SNAPSHOT_BYTES, SNAPSHOT_VERSION, buildSnapshot, readSnapshot, snapshotFits, type LiveSnapshot } from './snapshot'

// ---------- helpers ----------

const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kit', 'Lu']

/** A session mid-play: 2 courts, one game scored, the next ones on court, someone on a break, a line waiting. */
function midSession(): Session {
  let s = createSession({ format: 'fair', courts: 2, title: 'Tuesday Open Play' })
  s = addPlayers(s, NAMES)
  s = fillCourts(s)
  s = recordScore(s, s.games[0].id, 11, 7)
  s = fillCourts(s)
  const waiting = s.players.find((p) => p.status === 'waiting')
  if (!waiting) throw new Error('expected a waiting player')
  return timeOut(s, waiting.id)
}

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length

/** A valid snapshot as plain JSON, free to break. */
type Loose = Record<string, unknown> & {
  players: Record<string, unknown>[]
  line: unknown[]
  games: Record<string, unknown>[]
}
const valid = (s: Session = midSession()): Loose => JSON.parse(JSON.stringify(buildSnapshot(s))) as Loose

/** A snapshot whose first player's name is padded so the JSON is exactly `size` bytes (ASCII padding). */
function sizedTo(size: number): LiveSnapshot {
  const snap = valid()
  const base = bytes(snap)
  snap.players[0] = { ...snap.players[0], name: `${String(snap.players[0].name)}${'a'.repeat(size - base)}` }
  expect(bytes(snap)).toBe(size)
  return snap as unknown as LiveSnapshot
}

/** A session with so many long names that its snapshot is well over 64 KB. */
function hugeSession(): Session {
  const names = Array.from({ length: 1500 }, (_, i) => `Player number ${i} with a rather long display name`)
  return addPlayers(createSession({ format: 'fair', courts: 12 }), names)
}

// ---------- constants ----------

describe('snapshot constants (T6.1)', () => {
  it('the format version is 1 and the cap is 64 KB (PLATFORM.md §4)', () => {
    expect(SNAPSHOT_VERSION).toBe(1)
    expect(MAX_SNAPSHOT_BYTES).toBe(64 * 1024)
  })
})

// ---------- builder ----------

describe('buildSnapshot (T6.1)', () => {
  it('writes v: 1 and copies title, play, format and courts', () => {
    const s = midSession()
    const snap = buildSnapshot(s)
    expect(snap.v).toBe(1)
    expect(snap.title).toBe('Tuesday Open Play')
    expect(snap.play).toBe('doubles')
    expect(snap.format).toBe('fair')
    expect(snap.courts).toBe(2)
  })

  it('keeps only v, title, play, format, courts, players, line and games at the top level', () => {
    expect(Object.keys(buildSnapshot(midSession())).sort()).toEqual(
      ['courts', 'format', 'games', 'line', 'play', 'players', 'title', 'v'].sort(),
    )
  })

  it('keeps every player as { id, name, status }, in order, with the break and the courts visible', () => {
    const s = midSession()
    const snap = buildSnapshot(s)
    expect(snap.players).toEqual(s.players.map((p) => ({ id: p.id, name: p.name, status: p.status })))
    expect(snap.players.some((p) => p.status === 'out')).toBe(true)
    expect(snap.players.some((p) => p.status === 'playing')).toBe(true)
  })

  it('keeps the line (Up next) as player ids, front first', () => {
    const s = midSession()
    expect(s.line.length).toBeGreaterThan(0)
    expect(buildSnapshot(s).line).toEqual(s.line)
  })

  it('keeps every game with its court, teams (player ids), status and scores', () => {
    const s = midSession()
    const snap = buildSnapshot(s)
    expect(snap.games).toEqual(
      s.games.map((g) => ({
        id: g.id,
        court: g.court,
        teamA: [...g.teamA],
        teamB: [...g.teamB],
        status: g.status,
        ...(g.scoreA !== undefined ? { scoreA: g.scoreA } : {}),
        ...(g.scoreB !== undefined ? { scoreB: g.scoreB } : {}),
      })),
    )
    const scored = snap.games.find((g) => g.status === 'scored')
    expect(scored).toMatchObject({ scoreA: 11, scoreB: 7 })
  })

  it('leaves out skill levels and fixed partners', () => {
    const s = createSession({
      format: 'fair',
      courts: 1,
      teams: 'fixed',
      pairs: [
        [{ name: 'Ana', level: 3 }, { name: 'Ben', level: 2 }],
        [{ name: 'Cy', level: 1 }, 'Dee'],
      ],
    })
    expect(s.players.some((p) => p.level !== undefined)).toBe(true)
    expect(s.players.some((p) => p.partner !== undefined)).toBe(true)
    const snap = buildSnapshot(s)
    for (const p of snap.players) expect(Object.keys(p).sort()).toEqual(['id', 'name', 'status'])
    const json = JSON.stringify(snap)
    expect(json).not.toContain('"level"')
    expect(json).not.toContain('"partner"')
    expect(json).not.toContain('"teams"')
  })

  it('never carries a field that is not part of the snapshot (no secret, even if one is on the session)', () => {
    const s = { ...midSession(), secret: 'organizer-secret-xyz', code: 'live-code-abc' } as Session
    s.players = s.players.map((p, i) => (i === 0 ? ({ ...p, secret: 'player-secret' } as typeof p) : p))
    s.games = s.games.map((g, i) => (i === 0 ? ({ ...g, secret: 'game-secret' } as typeof g) : g))
    const json = JSON.stringify(buildSnapshot(s))
    expect(json).not.toContain('secret')
    expect(json).not.toContain('organizer-secret-xyz')
    expect(json).not.toContain('live-code-abc')
    for (const g of buildSnapshot(s).games) {
      for (const k of Object.keys(g)) expect(['id', 'court', 'teamA', 'teamB', 'status', 'scoreA', 'scoreB']).toContain(k)
    }
  })

  it('does not change the session', () => {
    const s = midSession()
    const before = JSON.stringify(s)
    buildSnapshot(s)
    expect(JSON.stringify(s)).toBe(before)
  })
})

// ---------- round trip ----------

describe('readSnapshot: round trip (T6.1)', () => {
  it('reads back what buildSnapshot wrote, through JSON', () => {
    const snap = buildSnapshot(midSession())
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
  })

  it('reads back an empty session (no title, no players, no games)', () => {
    const snap = buildSnapshot(createSession({ format: 'fair', courts: 1 }))
    expect(snap.title).toBe('')
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
  })

  it('reads back a singles session on 12 courts', () => {
    let s = createSession({ format: 'fair', courts: 12, play: 'singles', title: 'Singles night' })
    s = addPlayers(s, NAMES)
    s = fillCourts(s)
    const snap = buildSnapshot(s)
    expect(snap.games.length).toBeGreaterThan(0)
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
  })

  it('reads back every player status (waiting, playing, out, removed) and game status (playing, scored, skipped, cancelled)', () => {
    let s = midSession()
    const onCourt = s.games.filter((g) => g.status === 'playing')
    s = skipGame(s, onCourt[0].id)
    s = fillCourts(s)
    const playingGame = s.games.find((g) => g.status === 'playing')
    if (!playingGame) throw new Error('expected a game on court')
    s = removePlayer(s, playingGame.teamA[0])
    s = fillCourts(s)
    const snap = buildSnapshot(s)
    expect(new Set(snap.players.map((p) => p.status))).toEqual(new Set(['waiting', 'playing', 'out', 'removed']))
    expect(new Set(snap.games.map((g) => g.status))).toEqual(new Set(['playing', 'scored', 'skipped', 'cancelled']))
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap)
  })
})

// ---------- size cap ----------

describe('size cap: 64 KB of UTF-8 JSON (T6.1)', () => {
  it('a normal session fits', () => {
    expect(snapshotFits(buildSnapshot(midSession()))).toBe(true)
  })

  it('a session whose snapshot is over 64 KB does not fit, and readSnapshot rejects it', () => {
    const snap = buildSnapshot(hugeSession())
    expect(bytes(snap)).toBeGreaterThan(64 * 1024)
    expect(snapshotFits(snap)).toBe(false)
    expect(readSnapshot(JSON.parse(JSON.stringify(snap)))).toBeNull()
  })

  it('exactly 65,536 bytes fits and is read; 65,537 does not and is not', () => {
    const at = sizedTo(64 * 1024)
    expect(snapshotFits(at)).toBe(true)
    expect(readSnapshot(at)).not.toBeNull()
    const over = sizedTo(64 * 1024 + 1)
    expect(snapshotFits(over)).toBe(false)
    expect(readSnapshot(over)).toBeNull()
  })

  it('counts UTF-8 bytes, not characters (ñ is two bytes)', () => {
    const snap = valid()
    const base = bytes(snap)
    // 40,000 ñ: about 40 K characters (under the cap as a string length) but about 80 KB as UTF-8.
    snap.players[0] = { ...snap.players[0], name: 'ñ'.repeat(40_000) }
    expect(JSON.stringify(snap).length).toBeLessThan(64 * 1024)
    expect(bytes(snap)).toBeGreaterThan(64 * 1024)
    expect(base).toBeLessThan(64 * 1024)
    expect(snapshotFits(snap as unknown as LiveSnapshot)).toBe(false)
    expect(readSnapshot(snap)).toBeNull()
  })
})

// ---------- unknown version ----------

describe('readSnapshot: the format version (T6.1)', () => {
  it.each<[string, unknown]>([
    ['v: 2', 2],
    ['v: 0', 0],
    ['v: "1"', '1'],
    ['v: 1.5', 1.5],
    ['v: null', null],
  ])('rejects %s', (_label, v) => {
    expect(readSnapshot({ ...valid(), v })).toBeNull()
  })

  it('rejects a snapshot without v', () => {
    const snap = valid()
    delete snap.v
    expect(readSnapshot(snap)).toBeNull()
  })
})

// ---------- bad shapes ----------

describe('readSnapshot: not an object (T6.1)', () => {
  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a string', '{"v":1}'],
    ['a number', 1],
    ['a boolean', true],
    ['an array', [{ v: 1 }]],
  ])('rejects %s', (_label, value) => {
    expect(readSnapshot(value)).toBeNull()
  })
})

describe('readSnapshot: title, play, format and courts (T6.1)', () => {
  it.each<[string, (s: Loose) => void]>([
    ['a title that is not a string', (s) => (s.title = 42)],
    ['a missing title', (s) => delete s.title],
    ['a title over 60 characters', (s) => (s.title = 'x'.repeat(61))],
    ['an unknown play', (s) => (s.play = 'triples')],
    ['a missing play', (s) => delete s.play],
    ['an unknown format', (s) => (s.format = 'king-of-the-court')],
    ['a missing format', (s) => delete s.format],
    ['0 courts', (s) => (s.courts = 0)],
    ['13 courts', (s) => (s.courts = 13)],
    ['2.5 courts', (s) => (s.courts = 2.5)],
    ['courts as a string', (s) => (s.courts = '2')],
    ['missing courts', (s) => delete s.courts],
  ])('rejects %s', (_label, breakIt) => {
    const s = valid()
    breakIt(s)
    expect(readSnapshot(s)).toBeNull()
  })

  it('accepts a 60-character title and 1 or 12 courts', () => {
    expect(readSnapshot({ ...valid(), title: 'x'.repeat(60) })).not.toBeNull()
    const one = valid(addPlayers(createSession({ format: 'fair', courts: 1 }), NAMES))
    expect(readSnapshot(one)).not.toBeNull()
    const twelve = valid(addPlayers(createSession({ format: 'fair', courts: 12 }), NAMES))
    expect(readSnapshot(twelve)).not.toBeNull()
  })
})

describe('readSnapshot: players (T6.1)', () => {
  it.each<[string, (s: Loose) => void]>([
    ['players that are not a list', (s) => (s.players = {} as unknown as Loose['players'])],
    ['a player that is not an object', (s) => (s.players[0] = 'Ana' as unknown as Record<string, unknown>)],
    ['a player without an id', (s) => delete s.players[0].id],
    ['a player id that is not a string', (s) => (s.players[0].id = 7)],
    ['two players with the same id', (s) => (s.players[1].id = s.players[0].id)],
    ['a player name that is not a string', (s) => (s.players[0].name = 7)],
    ['a player without a name', (s) => delete s.players[0].name],
    ['an unknown player status', (s) => (s.players[0].status = 'asleep')],
    ['a missing player status', (s) => delete s.players[0].status],
  ])('rejects %s', (_label, breakIt) => {
    const s = valid()
    breakIt(s)
    expect(readSnapshot(s)).toBeNull()
  })

})

describe('readSnapshot: the line (T6.1)', () => {
  it.each<[string, (s: Loose) => void]>([
    ['a line that is not a list', (s) => (s.line = 'p1' as unknown as unknown[])],
    ['a line id that is not a player', (s) => s.line.push('nobody')],
    ['a line id that is not a string', (s) => s.line.push(5)],
    ['a player in the line twice', (s) => s.line.push(s.line[0])],
  ])('rejects %s', (_label, breakIt) => {
    const s = valid()
    expect(s.line.length).toBeGreaterThan(0)
    breakIt(s)
    expect(readSnapshot(s)).toBeNull()
  })
})

describe('readSnapshot: games (T6.1)', () => {
  /** The first scored game, so score cases have scores to break. */
  const scoredIndex = (s: Loose) => {
    const i = s.games.findIndex((g) => g.status === 'scored')
    expect(i).toBeGreaterThanOrEqual(0)
    return i
  }

  it.each<[string, (s: Loose) => void]>([
    ['games that are not a list', (s) => (s.games = null as unknown as Loose['games'])],
    ['a game that is not an object', (s) => (s.games[0] = 'g1' as unknown as Record<string, unknown>)],
    ['a game on court 0', (s) => (s.games[0].court = 0)],
    ['a game on a court past the session’s courts', (s) => (s.games[0].court = Number(s.courts) + 1)],
    ['a game court that is not an integer', (s) => (s.games[0].court = 1.5)],
    ['a game with an unknown player in team A', (s) => (s.games[0].teamA = ['nobody', ...(s.games[0].teamA as string[]).slice(1)])],
    ['a game with an unknown player in team B', (s) => (s.games[0].teamB = ['nobody', ...(s.games[0].teamB as string[]).slice(1)])],
    ['a game with an empty team A', (s) => (s.games[0].teamA = [])],
    ['a game with an empty team B', (s) => (s.games[0].teamB = [])],
    ['a team that is not a list', (s) => (s.games[0].teamA = 'p1')],
    ['an unknown game status', (s) => (s.games[0].status = 'paused')],
    ['a missing game status', (s) => delete s.games[0].status],
    ['a negative score', (s) => (s.games[scoredIndex(s)].scoreA = -1)],
    ['a score of 100', (s) => (s.games[scoredIndex(s)].scoreB = 100)],
    ['a score that is not an integer', (s) => (s.games[scoredIndex(s)].scoreA = 10.5)],
    ['a score as a string', (s) => (s.games[scoredIndex(s)].scoreB = '7')],
  ])('rejects %s', (_label, breakIt) => {
    const s = valid()
    breakIt(s)
    expect(readSnapshot(s)).toBeNull()
  })

  it('accepts scores 0 and 99, and games with no scores', () => {
    const s = valid()
    const i = scoredIndex(s)
    s.games[i].scoreA = 0
    s.games[i].scoreB = 99
    expect(readSnapshot(s)).not.toBeNull()
    const playing = s.games.find((g) => g.status === 'playing')
    expect(playing).toBeDefined()
    expect(playing).not.toHaveProperty('scoreA')
  })
})
