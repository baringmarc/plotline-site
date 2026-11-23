// T8.5 start screen helpers (TASKS.md T8.5; SPEC §4 "Combinations"), brought to T8.9 (Teams removed; SPEC §4 "Pair
// locks": "The start screen locks pairs among the name chips: the players join in list order and each pair then
// stands at its further-back partner's spot (`startSession`); a Round Robin with some but not all players paired
// doesn't start (`needs-pair`), and locks are ignored where they aren't offered"). Plan names, in ./startOptions.ts:
// - `formatsFor(play: Play): Format[]`: the formats offered for that play, in `paddleStack.formats` order (user,
//   2026-11-18, second by-eye look: fair, americano, winners-split, mexicano, winners-losers, skill-groups). SPEC §4:
//   Winners stay & split isn't offered in singles. Acceptance (user, 2026-11-18, from the by-eye check): Round Robin
//   is merged into "Americano (Round Robin)" on the start screen, so `round-robin` is never offered, though the engine
//   still accepts it (saved Round Robin sessions load and run);
// - `startSession({ title, play, format, courts, players: NewPlayer[], pairs: [string, string][] }): Session`: pairs
//   by name, matched ignoring case; throws `StackError` `needs-pair` for a Round Robin with some but not all paired.
//   It doesn't fill courts (StackPage does). `pairUp` is gone.
import { describe, expect, it } from 'vitest'
import { paddleStack } from '../../config/site'
import { StackError, createSession, locksOffered } from './engine'
import * as startOptions from './startOptions'
import { formatsFor, startSession } from './startOptions'
import type { Format, Play, Session } from './types'

const ALL: Format[] = ['fair', 'americano', 'winners-split', 'mexicano', 'winners-losers', 'skill-groups']
const PLAYS: Play[] = ['singles', 'doubles']
const configOrder = () => paddleStack.formats.map((f) => f.id as Format)

/** Whether the engine accepts the format for that play (createSession refuses others with `bad-combo`). */
function engineAccepts(format: Format, play: Play): boolean {
  try {
    createSession({ format, play, courts: 1, names: ['A', 'B', 'C', 'D'] })
    return true
  } catch (e) {
    if (e instanceof StackError && e.code === 'bad-combo') return false
    throw e
  }
}

describe('formatsFor (SPEC §4 "Combinations"; one argument since T8.9)', () => {
  it('doubles offers all six formats, in paddleStack.formats order', () => {
    expect(formatsFor('doubles')).toEqual(ALL)
    expect(formatsFor('doubles')).toEqual(configOrder())
  })

  it('singles hides Winners stay & split only', () => {
    expect(formatsFor('singles')).toEqual(['fair', 'americano', 'mexicano', 'winners-losers', 'skill-groups'])
  })

  it('takes the play alone: there is no Teams choice any more', () => {
    expect(formatsFor.length).toBe(1)
  })

  it('never offers round-robin (merged into Americano on the start screen), though the engine still accepts it', () => {
    for (const play of PLAYS) expect(formatsFor(play), play).not.toContain('round-robin')
    expect(engineAccepts('round-robin', 'doubles')).toBe(true)
    expect(engineAccepts('round-robin', 'singles')).toBe(true)
    expect(createSession({ format: 'round-robin', courts: 1, pairs: [['A', 'B'], ['C', 'D']] }).format).toBe('round-robin')
  })

  it('agrees with the engine for every play: offered formats start, hidden ones are refused', () => {
    for (const play of PLAYS) {
      const offered = formatsFor(play)
      for (const f of ALL) expect(offered.includes(f), `${f} / ${play}`).toBe(engineAccepts(f, play))
    }
  })

  it('keeps paddleStack.formats order for every play', () => {
    const order = configOrder()
    for (const play of PLAYS) {
      const offered = formatsFor(play)
      expect(offered).toEqual(order.filter((f) => offered.includes(f)))
    }
  })

  it('pairUp is gone (names are no longer paired by order)', () => {
    expect('pairUp' in startOptions).toBe(false)
  })
})

describe('locksOffered matches what the engine accepts on the start screen (T8.9)', () => {
  it('every offered format takes locked pairs exactly where locksOffered says so', () => {
    for (const play of PLAYS) {
      for (const format of formatsFor(play)) {
        let accepts = true
        try {
          createSession({ format, play, courts: 1, pairs: [['A', 'B'], ['C', 'D']] })
        } catch (e) {
          if (!(e instanceof StackError) || e.code !== 'bad-combo') throw e
          accepts = false
        }
        expect(accepts, `${format} / ${play}`).toBe(locksOffered(play, format))
      }
    }
  })

  it('on the start screen, locks are offered in doubles for Fair rotation, Winners stay, Winners vs Losers and Skill groups', () => {
    expect(formatsFor('doubles').filter((f) => locksOffered('doubles', f))).toEqual(['fair', 'winners-split', 'winners-losers', 'skill-groups'])
    expect(formatsFor('singles').filter((f) => locksOffered('singles', f))).toEqual([])
  })
})

// ---------- startSession ----------

const name = (s: Session, pid: string) => s.players.find((p) => p.id === pid)!.name
const lineNames = (s: Session) => s.line.map((x) => name(s, x))
const byName = (s: Session, n: string) => s.players.find((p) => p.name === n)!
const partnerOf = (s: Session, n: string) => {
  const q = byName(s, n).partner
  return q === undefined ? undefined : name(s, q)
}
const FIVE = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli']

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

describe('startSession (SPEC §4 "Pair locks": the start screen)', () => {
  it('builds the session from the start screen: title, play, format, courts, players in list order, no games, no teams', () => {
    const s = startSession({ title: '  Friday  ', play: 'doubles', format: 'skill-groups', courts: 2, players: FIVE, pairs: [] })
    expect(s.title).toBe('Friday')
    expect(s.play).toBe('doubles')
    expect(s.format).toBe('skill-groups')
    expect(s.courts).toBe(2)
    expect(s.players.map((p) => p.name)).toEqual(FIVE)
    expect(lineNames(s)).toEqual(FIVE)
    expect(s.games).toEqual([])
    expect(s).not.toHaveProperty('teams')
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
  })

  it('players join in list order, then each pair stands at its further-back partner’s spot', () => {
    const s = startSession({ title: '', play: 'doubles', format: 'fair', courts: 1, players: FIVE, pairs: [['Ana', 'Dee']] })
    expect(s.players.map((p) => p.name)).toEqual(FIVE)
    expect(lineNames(s)).toEqual(['Ben', 'Cy', 'Ana', 'Dee', 'Eli'])
    expect(partnerOf(s, 'Ana')).toBe('Dee')
    expect(partnerOf(s, 'Dee')).toBe('Ana')
    expect(byName(s, 'Ben').partner).toBeUndefined()
  })

  it('pairs are matched by name ignoring case, given in either order; the names keep the list’s spelling', () => {
    const s = startSession({ title: '', play: 'doubles', format: 'fair', courts: 1, players: FIVE, pairs: [['dee', 'ANA']] })
    expect(lineNames(s)).toEqual(['Ben', 'Cy', 'Ana', 'Dee', 'Eli'])
    expect(partnerOf(s, 'Ana')).toBe('Dee')
    expect(s.players.map((p) => p.name)).toEqual(FIVE)
  })

  it('two pairs, and levels from the list kept on the partners', () => {
    const s = startSession({
      title: '',
      play: 'doubles',
      format: 'winners-split',
      courts: 1,
      players: [{ name: 'Ana', level: 3 }, 'Ben', 'Cy', { name: 'Dee', level: 1 }, 'Eli', 'Fay'],
      pairs: [
        ['Ana', 'Eli'],
        ['Ben', 'Cy'],
      ],
    })
    expect(lineNames(s)).toEqual(['Ben', 'Cy', 'Dee', 'Ana', 'Eli', 'Fay'])
    expect(partnerOf(s, 'Eli')).toBe('Ana')
    expect(partnerOf(s, 'Cy')).toBe('Ben')
    expect(byName(s, 'Ana').level).toBe(3)
    expect(byName(s, 'Dee').level).toBe(1)
    expect(byName(s, 'Fay').partner).toBeUndefined()
  })

  it.each<[Play, Format]>([
    ['singles', 'fair'],
    ['singles', 'skill-groups'],
    ['doubles', 'americano'],
    ['doubles', 'mexicano'],
  ])('locks are ignored where they aren’t offered (%s %s): no partners, the list order kept', (play, format) => {
    const s = startSession({ title: '', play, format, courts: 1, players: FIVE, pairs: [['Ana', 'Dee']] })
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
    expect(lineNames(s)).toEqual(FIVE)
    expect(s.format).toBe(format)
    expect(s.play).toBe(play)
  })

  it('a Round Robin with every player paired starts with all pairs locked', () => {
    const s = startSession({
      title: '',
      play: 'doubles',
      format: 'round-robin',
      courts: 1,
      players: ['Ana', 'Ben', 'Cy', 'Dee'],
      pairs: [
        ['Ana', 'Cy'],
        ['Ben', 'Dee'],
      ],
    })
    expect(s.players.every((p) => p.partner !== undefined)).toBe(true)
    expect(s.players.map((p) => p.name), 'the players join in list order').toEqual(['Ana', 'Ben', 'Cy', 'Dee'])
    expect(partnerOf(s, 'Ana')).toBe('Cy')
    expect(partnerOf(s, 'Dee')).toBe('Ben')
    expect(lineNames(s)).toEqual(['Ana', 'Cy', 'Ben', 'Dee'])
  })

  it('a Round Robin with no pairs starts with no locks', () => {
    const s = startSession({ title: '', play: 'doubles', format: 'round-robin', courts: 1, players: FIVE, pairs: [] })
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
    expect(lineNames(s)).toEqual(FIVE)
  })

  it('a Round Robin with some but not all players paired doesn’t start: needs-pair', () => {
    expectCode(
      () => startSession({ title: '', play: 'doubles', format: 'round-robin', courts: 1, players: FIVE, pairs: [['Ana', 'Ben']] }),
      'needs-pair',
    )
    expectCode(
      () =>
        startSession({
          title: '',
          play: 'doubles',
          format: 'round-robin',
          courts: 1,
          players: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'],
          pairs: [
            ['Ana', 'Ben'],
            ['Cy', 'Dee'],
          ],
        }),
      'needs-pair',
    )
  })
})
