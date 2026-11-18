// T8.5 start screen helpers (TASKS.md T8.5; SPEC §4 "Combinations"). Plan names, in ./startOptions.ts:
// - `formatsFor(play: Play, teams: Teams): Format[]`: the formats offered for that combination, in
//   `paddleStack.formats` order (user, 2026-11-18, second by-eye look: fair, americano, winners-split, mexicano,
//   winners-losers, skill-groups). SPEC §4: fixed pairs aren't offered in singles (any format); Winners stay & split
//   isn't offered in singles; Americano and Mexicano aren't offered with fixed pairs; Skill groups and Winners vs
//   Losers work in singles, open doubles and fixed pairs. Acceptance (user, 2026-11-18, from the by-eye check): Round
//   Robin is merged into "Americano (Round Robin)" on the start screen, so `round-robin` is never offered, though the
//   engine still accepts it (saved Round Robin sessions load and run).
// - `pairUp(names: string[]): { pairs: [string, string][]; leftover: string | null }`: pairs names in list order
//   (1 with 2, 3 with 4); an odd last name is `leftover`.
import { describe, expect, it } from 'vitest'
import { paddleStack } from '../../config/site'
import { StackError, createSession } from './engine'
import { formatsFor, pairUp } from './startOptions'
import type { Format, Play, Teams } from './types'

const ALL: Format[] = ['fair', 'americano', 'winners-split', 'mexicano', 'winners-losers', 'skill-groups']
const COMBOS: [Play, Teams][] = [
  ['singles', 'open'],
  ['singles', 'fixed'],
  ['doubles', 'open'],
  ['doubles', 'fixed'],
]
const configOrder = () => paddleStack.formats.map((f) => f.id as Format)

/** Whether the engine accepts the combination (createSession refuses others with `bad-combo`). */
function engineAccepts(format: Format, play: Play, teams: Teams): boolean {
  try {
    if (teams === 'fixed') createSession({ format, play, teams, courts: 1, pairs: [['A', 'B'], ['C', 'D']] })
    else createSession({ format, play, teams, courts: 1, names: ['A', 'B', 'C', 'D'] })
    return true
  } catch (e) {
    if (e instanceof StackError && e.code === 'bad-combo') return false
    throw e
  }
}

describe('formatsFor (SPEC §4 "Combinations")', () => {
  it('open doubles offers all six formats, in paddleStack.formats order', () => {
    expect(formatsFor('doubles', 'open')).toEqual(ALL)
    expect(formatsFor('doubles', 'open')).toEqual(configOrder())
  })

  it('singles (open queue) hides Winners stay & split only', () => {
    expect(formatsFor('singles', 'open')).toEqual(['fair', 'americano', 'mexicano', 'winners-losers', 'skill-groups'])
  })

  it('fixed pairs (doubles) hides Americano and Mexicano', () => {
    expect(formatsFor('doubles', 'fixed')).toEqual(['fair', 'winners-split', 'winners-losers', 'skill-groups'])
  })

  it('singles with fixed pairs offers nothing (fixed pairs are doubles only)', () => {
    expect(formatsFor('singles', 'fixed')).toEqual([])
  })

  it('never offers round-robin (merged into Americano on the start screen), though the engine still accepts it', () => {
    for (const [play, teams] of COMBOS) expect(formatsFor(play, teams), `${play} / ${teams}`).not.toContain('round-robin')
    expect(engineAccepts('round-robin', 'doubles', 'open')).toBe(true)
    expect(engineAccepts('round-robin', 'singles', 'open')).toBe(true)
    expect(engineAccepts('round-robin', 'doubles', 'fixed')).toBe(true)
  })

  it('agrees with the engine for every combination: offered formats start, hidden ones are refused', () => {
    for (const play of ['singles', 'doubles'] as Play[]) {
      for (const teams of ['open', 'fixed'] as Teams[]) {
        const offered = formatsFor(play, teams)
        for (const f of ALL) expect(offered.includes(f), `${f} / ${play} / ${teams}`).toBe(engineAccepts(f, play, teams))
      }
    }
  })

  it('keeps paddleStack.formats order in every combination', () => {
    const order = configOrder()
    for (const play of ['singles', 'doubles'] as Play[]) {
      for (const teams of ['open', 'fixed'] as Teams[]) {
        const offered = formatsFor(play, teams)
        expect(offered).toEqual(order.filter((f) => offered.includes(f)))
      }
    }
  })
})

describe('pairUp (fixed pairs: names paired in list order)', () => {
  it('pairs 1 with 2 and 3 with 4, nothing left over', () => {
    expect(pairUp(['Andrew', 'Maria', 'Juan', 'Jose'])).toEqual({
      pairs: [
        ['Andrew', 'Maria'],
        ['Juan', 'Jose'],
      ],
      leftover: null,
    })
  })

  it('an odd last name is the leftover', () => {
    expect(pairUp(['Andrew', 'Maria', 'Juan', 'Jose', 'Ana'])).toEqual({
      pairs: [
        ['Andrew', 'Maria'],
        ['Juan', 'Jose'],
      ],
      leftover: 'Ana',
    })
  })

  it('one name: no pairs, that name left over', () => {
    expect(pairUp(['Andrew'])).toEqual({ pairs: [], leftover: 'Andrew' })
  })

  it('no names: no pairs and no leftover', () => {
    expect(pairUp([])).toEqual({ pairs: [], leftover: null })
  })

  it('does not change the list it was given', () => {
    const names = ['A', 'B', 'C']
    pairUp(names)
    expect(names).toEqual(['A', 'B', 'C'])
  })
})
