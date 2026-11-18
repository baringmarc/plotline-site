// T8.4 Round Robin schedule (TASKS.md T8.4; SPEC §4 "Round Robin": every pairing of two sides in circle-method
// order — the sides in the order they joined, with an empty slot when the count is odd, the first fixed and the rest
// rotating one place each round, so each round meets every side once; the empty slot's pairings are left out).
//
// Name the tests rely on (the plan's): `src/features/stack/schedule.ts` exports
// `roundRobinOrder<T>(sides: T[]): [T, T][]`.
//
// What is pinned: rounds come one after another (n/2 pairings a round for an even count, (n-1)/2 for an odd one),
// each round meets every side at most once, every pairing appears exactly once, the first side is fixed, round 1 is
// the circle method's first round (side i against side N-1-i), and the rounds follow the circle method's one-place
// rotation (either direction). Not pinned: the order of the two sides within a pairing, or of pairings within a round.
import { describe, expect, it } from 'vitest'
import { roundRobinOrder } from './schedule'

const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`)
const roundKey = (pairs: [string, string][]) => pairs.map(([a, b]) => pairKey(a, b)).sort().join(' ')

/** The circle method as SPEC describes it, rotating the rest one place each round, in one direction. */
function circleRounds(sides: string[], direction: 1 | -1): [string, string][][] {
  const slots: (string | null)[] = [...sides]
  if (slots.length % 2 === 1) slots.push(null)
  const n = slots.length
  const rounds: [string, string][][] = []
  let arr = slots
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== null && b !== null) round.push([a, b])
    }
    rounds.push(round)
    const rest = arr.slice(1)
    const rotated = direction === 1 ? [rest[rest.length - 1], ...rest.slice(0, -1)] : [...rest.slice(1), rest[0]]
    arr = [arr[0], ...rotated]
  }
  return rounds
}

/** Splits the schedule into its rounds. */
function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

/** Pairings a round: n/2 for an even count, (n-1)/2 for an odd one (the empty slot's pairing is left out). */
const perRound = (n: number) => Math.floor(n / 2)
const roundsCount = (n: number) => (n % 2 === 0 ? n - 1 : n)

describe('roundRobinOrder: small counts', () => {
  it('no sides and one side give no pairings', () => {
    expect(roundRobinOrder([])).toEqual([])
    expect(roundRobinOrder(['A'])).toEqual([])
  })

  it('two sides give exactly one pairing', () => {
    const order = roundRobinOrder(['A', 'B'])
    expect(order).toHaveLength(1)
    expect(pairKey(...order[0])).toBe('A-B')
  })

  it('three sides (odd: an empty slot) give three rounds of one pairing each, every pairing once', () => {
    const order = roundRobinOrder(['A', 'B', 'C'])
    expect(order.map(([a, b]) => pairKey(a, b)).sort()).toEqual(['A-B', 'A-C', 'B-C'])
  })

  it('four sides: round 1 is 1 against 4 and 2 against 3 (the circle method), and the first side plays every round', () => {
    const order = roundRobinOrder(['A', 'B', 'C', 'D'])
    expect(order).toHaveLength(6)
    const rounds = chunk(order, 2)
    expect(roundKey(rounds[0])).toBe('A-D B-C')
    for (const round of rounds) expect(round.some(([a, b]) => a === 'A' || b === 'A')).toBe(true)
  })
})

describe('roundRobinOrder: circle-method order for 2 to 18 sides', () => {
  for (let n = 2; n <= 18; n++) {
    it(`${n} sides: every pairing exactly once, in rounds that meet each side at most once`, () => {
      const sides = letters(n)
      const order = roundRobinOrder(sides)
      expect(order).toHaveLength((n * (n - 1)) / 2)
      const keys = order.map(([a, b]) => {
        expect(a).not.toBe(b)
        expect(sides).toContain(a)
        expect(sides).toContain(b)
        return pairKey(a, b)
      })
      expect(new Set(keys).size).toBe(keys.length)

      const size = perRound(n)
      const rounds = chunk(order, size)
      expect(rounds).toHaveLength(roundsCount(n))
      for (const round of rounds) {
        const inRound = round.flat()
        expect(new Set(inRound).size, `a round meets each side at most once (${roundKey(round)})`).toBe(inRound.length)
      }
      if (n % 2 === 0) {
        // The first side is fixed: with no empty slot it plays in every round.
        for (const round of rounds) expect(round.flat()).toContain('A')
      }
    })

    it(`${n} sides: the rounds follow the circle method (first fixed, the rest rotating one place)`, () => {
      const sides = letters(n)
      const rounds = chunk(roundRobinOrder(sides), perRound(n)).map(roundKey)
      const clockwise = circleRounds(sides, 1).map(roundKey)
      const anticlockwise = circleRounds(sides, -1).map(roundKey)
      expect([clockwise, anticlockwise]).toContainEqual(rounds)
    })
  }
})

describe('roundRobinOrder: generic and pure', () => {
  it('returns the very same side objects it was given', () => {
    const sides = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }]
    const order = roundRobinOrder(sides)
    for (const [a, b] of order) {
      expect(sides).toContain(a)
      expect(sides).toContain(b)
    }
  })

  it('works on sides that are arrays (fixed pairs)', () => {
    const sides = [['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6']]
    const order = roundRobinOrder(sides)
    expect(order).toHaveLength(3)
    for (const [a, b] of order) expect(a).not.toBe(b)
  })

  it('never mutates its input', () => {
    const sides = Object.freeze(['A', 'B', 'C', 'D', 'E']) as unknown as string[]
    expect(() => roundRobinOrder(sides)).not.toThrow()
    expect(sides).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('gives the same order every time for the same sides', () => {
    expect(roundRobinOrder(letters(9))).toEqual(roundRobinOrder(letters(9)))
  })
})
