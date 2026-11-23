// T6.4 Player view: the snapshot back into a session (TASKS.md T6.4; SPEC "Snapshot": "Standings aren't stored: the
// player view works them out from `players` and `games` with the engine's `standings()`").
// Plan name: `sessionFromSnapshot(snapshot: LiveSnapshot): Session` in src/features/stack/live/snapshot.ts.
import { describe, expect, it } from 'vitest'
import { addPlayers, createSession, fillCourts, recordScore, removePlayer, skipGame, standings, timeOut } from '../engine'
import type { Session } from '../types'
import { buildSnapshot, sessionFromSnapshot } from './snapshot'

const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jo', 'Kit', 'Lu']

/** Mid-play: two courts, scored and skipped games, someone on a break, someone removed, a line waiting. */
function midSession(): Session {
  let s = createSession({ format: 'fair', courts: 2, title: 'Tuesday Open Play' })
  s = addPlayers(s, NAMES)
  s = fillCourts(s)
  s = recordScore(s, s.games[0].id, 11, 7)
  s = skipGame(s, s.games[1].id)
  s = fillCourts(s)
  s = recordScore(s, s.games[2].id, 4, 11)
  s = fillCourts(s)
  const waiting = s.players.filter((p) => p.status === 'waiting')
  if (waiting.length < 2) throw new Error('expected two waiting players')
  s = timeOut(s, waiting[0].id)
  return removePlayer(s, waiting[1].id)
}

function singlesSession(): Session {
  let s = createSession({ format: 'fair', courts: 1, play: 'singles', names: ['Ana', 'Ben', 'Cy'] })
  s = fillCourts(s)
  s = recordScore(s, s.games[0].id, 11, 9)
  return fillCourts(s)
}

describe('sessionFromSnapshot (T6.4)', () => {
  it('gives back a session whose snapshot is the same snapshot (doubles, mid-play)', () => {
    const snap = buildSnapshot(midSession())
    expect(buildSnapshot(sessionFromSnapshot(snap))).toEqual(snap)
  })

  it('gives back a session whose snapshot is the same snapshot (singles)', () => {
    const snap = buildSnapshot(singlesSession())
    expect(buildSnapshot(sessionFromSnapshot(snap))).toEqual(snap)
  })

  it('keeps title, play, format, courts, the line and every game with its scores', () => {
    const s = midSession()
    const out = sessionFromSnapshot(buildSnapshot(s))
    expect(out.title).toBe('Tuesday Open Play')
    expect(out.play).toBe('doubles')
    expect(out.format).toBe('fair')
    expect(out.courts).toBe(2)
    expect(out.line).toEqual(s.line)
    expect(out.games).toEqual(s.games)
    expect(out.players.map(({ id, name, status }) => ({ id, name, status }))).toEqual(
      s.players.map(({ id, name, status }) => ({ id, name, status })),
    )
  })

  it('gives the same standings as the organizer’s session (places, wins, losses, points; removed left out)', () => {
    const s = midSession()
    const rows = standings(sessionFromSnapshot(buildSnapshot(s)))
    expect(rows).toEqual(standings(s))
    expect(rows.some((r) => r.wins > 0)).toBe(true)
    const removed = s.players.find((p) => p.status === 'removed')!
    expect(rows.map((r) => r.playerId)).not.toContain(removed.id)
  })

  it('a snapshot with no games yet gives standings with everyone at zero', () => {
    const s = addPlayers(createSession({ format: 'fair', courts: 1 }), ['Ana', 'Ben', 'Cy', 'Dee'])
    const rows = standings(sessionFromSnapshot(buildSnapshot(s)))
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.wins === 0 && r.losses === 0 && r.games === 0)).toBe(true)
  })

  it('players carry no level or partner (the snapshot has none)', () => {
    const out = sessionFromSnapshot(buildSnapshot(midSession()))
    for (const p of out.players) {
      expect(p.level).toBeUndefined()
      expect(p.partner).toBeUndefined()
    }
  })

  it('the session it gives back has no teams field (T8.9: the Teams option is gone)', () => {
    const out = sessionFromSnapshot(buildSnapshot(midSession()))
    expect(out).not.toHaveProperty('teams')
    expect(Object.keys(out).sort()).toEqual(['courts', 'format', 'games', 'line', 'play', 'players', 'title'])
  })

  it('does not share arrays with the snapshot, so changing one leaves the other alone', () => {
    const snap = buildSnapshot(midSession())
    const before = JSON.parse(JSON.stringify(snap))
    const out = sessionFromSnapshot(snap)
    out.players.pop()
    out.line.pop()
    out.games.pop()
    out.games[0].teamA.pop()
    expect(snap).toEqual(before)
  })
})
