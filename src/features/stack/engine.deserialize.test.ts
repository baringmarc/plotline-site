import { describe, expect, it } from 'vitest'
import { createSession, deserialize, fillCourts, recordScore, serialize, StackError } from './engine'
import type { Format } from './types'

/** A saved session with one scored game, ready to be broken one field at a time. */
function saved() {
  let s = fillCourts(createSession({ format: 'fair', courts: 2, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }))
  s = recordScore(s, s.games[0].id, 11, 7)
  return JSON.parse(serialize(s)) as { version: number; session: ReturnType<typeof createSession> }
}

const broken = (edit: (d: ReturnType<typeof saved>) => void) => {
  const d = saved()
  edit(d)
  return deserialize(JSON.stringify(d))
}

describe('deserialize refuses sessions the engine could never make', () => {
  it('accepts the untouched save', () => {
    expect(broken(() => {})).not.toBeNull()
  })

  it.each([
    ['a scored game without scores', (d: ReturnType<typeof saved>) => delete d.session.games[0].scoreA],
    ['a scored game with a tie', (d: ReturnType<typeof saved>) => (d.session.games[0].scoreB = 11)],
    ['a score above 99', (d: ReturnType<typeof saved>) => (d.session.games[0].scoreA = 100)],
    ['a fractional score', (d: ReturnType<typeof saved>) => (d.session.games[0].scoreA = 10.5)],
    ['scores on a game still playing', (d: ReturnType<typeof saved>) => (d.session.games[1].scoreA = 3)],
    ['a court outside 1..courts', (d: ReturnType<typeof saved>) => (d.session.games[1].court = 3)],
    ['a team id that is not a player', (d: ReturnType<typeof saved>) => (d.session.games[1].teamA[0] = 'p99')],
    ['the same player twice in one game', (d: ReturnType<typeof saved>) => (d.session.games[1].teamB[0] = d.session.games[1].teamA[0])],
    ['duplicate player ids', (d: ReturnType<typeof saved>) => (d.session.players[1].id = d.session.players[0].id)],
    ['duplicate game ids', (d: ReturnType<typeof saved>) => (d.session.games[1].id = d.session.games[0].id)],
    ['a player twice in the line', (d: ReturnType<typeof saved>) => d.session.line.push(d.session.line[0])],
  ])('refuses %s', (_label, edit) => {
    expect(broken(edit)).toBeNull()
  })
})

describe('createSession format check', () => {
  it('refuses an unknown format with code bad-format', () => {
    try {
      createSession({ format: 'ladder' as Format, courts: 2, names: [] })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(StackError)
      expect((e as StackError).code).toBe('bad-format')
    }
  })
})
