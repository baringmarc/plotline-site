// T8.6 TV info (TASKS.md T8.6, "Picked (user, 2026-11-18)": A Court bands, each court's last result and win streaks;
// SPEC §6 2026-11-18 T8.6 row):
// - a side's streak counts back through the scored games any of its players played, and holds only while every one
//   of them was this exact side and won; skipped and cancelled games don't count; shown from 2;
// - the last result is the latest scored game on that court, winner's score first;
// - a colour per court: six tones, cycled (court 7 → tone 1).
//
// Names the tests rely on (the plan's): `src/features/stack/tvInfo.ts` exports
// `teamStreak(session, team): number`, `lastResult(session, court): { high, low } | null`, `courtTone(court): number`.
import { describe, expect, it } from 'vitest'
import { courtTone, lastResult, teamStreak } from './tvInfo'
import type { Game, GameStatus, Player, Session, Team } from './types'

// ---------- helpers ----------

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function player(id: string): Player {
  return { id, name: id.toUpperCase(), status: 'waiting' }
}

let n = 0
function game(court: number, teamA: Team, teamB: Team, status: GameStatus, scoreA?: number, scoreB?: number): Game {
  n += 1
  const g: Game = { id: `g${n}`, court, teamA, teamB, status }
  if (status === 'scored') {
    g.scoreA = scoreA
    g.scoreB = scoreB
  }
  return g
}
const won = (court: number, winners: Team, losers: Team, high = 11, low = 7) => game(court, winners, losers, 'scored', high, low)
const lostAsA = (court: number, losers: Team, winners: Team, low = 7, high = 11) => game(court, losers, winners, 'scored', low, high)

function session(games: Game[], opts: Partial<Session> = {}): Session {
  return {
    title: '',
    play: 'doubles',
    format: 'fair',
    courts: 3,
    players: IDS.map(player),
    line: [],
    games,
    ...opts,
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}

// ---------- teamStreak ----------

describe('teamStreak (T8.6: wins in a row as this exact side)', () => {
  it('is 0 for a side with no games', () => {
    expect(teamStreak(session([]), ['a', 'b'])).toBe(0)
  })

  it('is 1 after one win', () => {
    expect(teamStreak(session([won(1, ['a', 'b'], ['c', 'd'])]), ['a', 'b'])).toBe(1)
  })

  it('counts consecutive wins as the same side, past other courts’ games', () => {
    const s = session([
      won(1, ['a', 'b'], ['c', 'd']),
      won(2, ['e', 'f'], ['g', 'h']),
      won(1, ['a', 'b'], ['e', 'f']),
      won(2, ['c', 'd'], ['g', 'h']),
      won(1, ['a', 'b'], ['g', 'h']),
    ])
    expect(teamStreak(s, ['a', 'b'])).toBe(3)
  })

  it('a win as team B counts the same as a win as team A (the higher score wins)', () => {
    const s = session([lostAsA(1, ['c', 'd'], ['a', 'b']), won(1, ['a', 'b'], ['e', 'f'])])
    expect(teamStreak(s, ['a', 'b'])).toBe(2)
    expect(teamStreak(s, ['c', 'd'])).toBe(0)
  })

  it('is 0 once the side loses its latest game, whatever it won before', () => {
    const s = session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['a', 'b'], ['e', 'f']), lostAsA(1, ['a', 'b'], ['g', 'h'])])
    expect(teamStreak(s, ['a', 'b'])).toBe(0)
    expect(teamStreak(s, ['g', 'h'])).toBe(1)
  })

  it('stops counting back at a game where one of its players won with another partner', () => {
    const s = session([
      won(1, ['a', 'b'], ['c', 'd']),
      won(1, ['a', 'b'], ['e', 'f']),
      won(2, ['a', 'g'], ['c', 'h']), // a won, but not as a & b
      won(1, ['a', 'b'], ['e', 'f']),
    ])
    expect(teamStreak(s, ['a', 'b'])).toBe(1)
    // and the other side's streak is its own: a & g won once.
    expect(teamStreak(s, ['a', 'g'])).toBe(0) // a's latest scored game was with b
  })

  it('a game the partner played without the other player also breaks it', () => {
    const s = session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['a', 'b'], ['e', 'f']), lostAsA(2, ['b', 'h'], ['c', 'd'])])
    expect(teamStreak(s, ['a', 'b'])).toBe(0)
  })

  it('skipped and cancelled games do not count and do not break a streak', () => {
    const s = session([
      won(1, ['a', 'b'], ['c', 'd']),
      game(1, ['a', 'b'], ['e', 'f'], 'skipped'),
      game(2, ['a', 'g'], ['c', 'h'], 'cancelled'),
      won(1, ['a', 'b'], ['e', 'f']),
      game(1, ['a', 'c'], ['b', 'd'], 'skipped'),
    ])
    expect(teamStreak(s, ['a', 'b'])).toBe(2)
  })

  it('the game the side is playing now does not break the streak', () => {
    const s = session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['a', 'b'], ['e', 'f']), game(1, ['a', 'b'], ['g', 'h'], 'playing')])
    expect(teamStreak(s, ['a', 'b'])).toBe(2)
  })

  it('the side is the same players in either order', () => {
    const s = session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['b', 'a'], ['e', 'f'])])
    expect(teamStreak(s, ['a', 'b'])).toBe(2)
    expect(teamStreak(s, ['b', 'a'])).toBe(2)
  })

  it('in doubles, one player alone is not the side that won', () => {
    const s = session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['a', 'b'], ['e', 'f'])])
    expect(teamStreak(s, ['a'])).toBe(0)
  })

  it('singles: a player’s wins in a row', () => {
    const s = session(
      [won(1, ['a'], ['b']), lostAsA(2, ['c'], ['d']), won(1, ['a'], ['c'], 11, 3), game(1, ['a'], ['b'], 'playing')],
      { play: 'singles' },
    )
    expect(teamStreak(s, ['a'])).toBe(2)
    expect(teamStreak(s, ['d'])).toBe(1)
    expect(teamStreak(s, ['c'])).toBe(0)
  })

  it('does not change the session', () => {
    const s = deepFreeze(session([won(1, ['a', 'b'], ['c', 'd']), won(1, ['a', 'b'], ['e', 'f'])]))
    expect(() => teamStreak(s, ['a', 'b'])).not.toThrow()
    expect(teamStreak(s, ['a', 'b'])).toBe(2)
  })
})

// ---------- lastResult ----------

describe('lastResult (T8.6: each court’s last result, winner’s score first)', () => {
  it('is null on a court with no games', () => {
    expect(lastResult(session([won(2, ['a', 'b'], ['c', 'd'])]), 1)).toBeNull()
  })

  it('is null when the court’s games were only playing, skipped or cancelled', () => {
    const s = session([
      game(1, ['a', 'b'], ['c', 'd'], 'skipped'),
      game(1, ['a', 'b'], ['c', 'd'], 'cancelled'),
      game(1, ['a', 'b'], ['c', 'd'], 'playing'),
    ])
    expect(lastResult(s, 1)).toBeNull()
  })

  it('gives the winner’s score first when team A won', () => {
    expect(lastResult(session([won(1, ['a', 'b'], ['c', 'd'], 11, 9)]), 1)).toEqual({ high: 11, low: 9 })
  })

  it('gives the winner’s score first when team B won', () => {
    expect(lastResult(session([lostAsA(1, ['a', 'b'], ['c', 'd'], 4, 11)]), 1)).toEqual({ high: 11, low: 4 })
  })

  it('a 0 score shows as 0', () => {
    expect(lastResult(session([lostAsA(1, ['a', 'b'], ['c', 'd'], 0, 11)]), 1)).toEqual({ high: 11, low: 0 })
  })

  it('is the latest scored game on that court, not another court’s', () => {
    const s = session([
      won(1, ['a', 'b'], ['c', 'd'], 11, 2),
      won(1, ['a', 'b'], ['e', 'f'], 11, 8),
      won(2, ['g', 'h'], ['c', 'd'], 15, 13),
    ])
    expect(lastResult(s, 1)).toEqual({ high: 11, low: 8 })
    expect(lastResult(s, 2)).toEqual({ high: 15, low: 13 })
    expect(lastResult(s, 3)).toBeNull()
  })

  it('a later skipped, cancelled or playing game does not hide the last scored one', () => {
    const s = session([
      won(1, ['a', 'b'], ['c', 'd'], 11, 6),
      game(1, ['e', 'f'], ['g', 'h'], 'skipped'),
      game(1, ['a', 'b'], ['g', 'h'], 'cancelled'),
      game(1, ['c', 'd'], ['e', 'f'], 'playing'),
    ])
    expect(lastResult(s, 1)).toEqual({ high: 11, low: 6 })
  })
})

// ---------- courtTone ----------

describe('courtTone (T8.6: a colour per court, six tones, cycled)', () => {
  it('courts 1–6 get tones 1–6', () => {
    expect([1, 2, 3, 4, 5, 6].map(courtTone)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('court 7 starts again at tone 1, up to the 12-court maximum', () => {
    expect([7, 8, 9, 10, 11, 12].map(courtTone)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('always a whole number from 1 to 6', () => {
    for (let c = 1; c <= 12; c++) {
      const t = courtTone(c)
      expect(Number.isInteger(t), `court ${c}`).toBe(true)
      expect(t).toBeGreaterThanOrEqual(1)
      expect(t).toBeLessThanOrEqual(6)
    }
  })
})
