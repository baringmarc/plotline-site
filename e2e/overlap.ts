// Finds overlapping cards on a page. Pure, so Vitest can check it.

export type Box = { x: number; y: number; width: number; height: number; label?: string }

/** The length two spans [a, a + al) and [b, b + bl) share (0 when apart or touching). */
function shared(a: number, al: number, b: number, bl: number): number {
  return Math.min(a + al, b + bl) - Math.max(a, b)
}

/**
 * Every pair of boxes that overlap by more than `tolerance` px on both axes. Touching edges and zero-size
 * boxes don't count; a box fully inside another does.
 */
export function findOverlaps(boxes: Box[], tolerance = 1): Array<[Box, Box]> {
  const sized = boxes.filter((b) => b.width > 0 && b.height > 0)
  const pairs: Array<[Box, Box]> = []
  for (let i = 0; i < sized.length; i++) {
    for (let j = i + 1; j < sized.length; j++) {
      const a = sized[i]
      const b = sized[j]
      if (shared(a.x, a.width, b.x, b.width) > tolerance && shared(a.y, a.height, b.y, b.height) > tolerance) {
        pairs.push([a, b])
      }
    }
  }
  return pairs
}
