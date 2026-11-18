/**
 * Round Robin schedule (SPEC §4 "Round Robin"): every pairing of the sides in circle-method order. The sides
 * keep their order, with an empty slot added when the count is odd; the first stays fixed and the rest rotate
 * one place each round, so each round meets every side once. Pairings with the empty slot are left out.
 */
export function roundRobinOrder<T>(sides: readonly T[]): [T, T][] {
  const slots: (T | null)[] = sides.length % 2 === 0 ? [...sides] : [...sides, null]
  const n = slots.length
  if (n < 2) return []
  const [fixed, ...rest] = slots
  const m = rest.length
  const out: [T, T][] = []
  for (let r = 0; r < n - 1; r++) {
    const round = [fixed, ...rest.map((_, k) => rest[(k - r + m) % m])]
    for (let i = 0; i < n / 2; i++) {
      const a = round[i]
      const b = round[n - 1 - i]
      if (a !== null && b !== null) out.push([a, b])
    }
  }
  return out
}
