import { describe, expect, it } from 'vitest'
import { paddleStackMeta } from './pageMeta'

// T8.8: the share text follows Milestone 8's start screen (singles, six formats). T8.9: pairs can be locked instead
// of a Teams mode, so the text says pairs can be locked rather than naming "fixed pairs".
describe('paddleStackMeta description (T8.8, T8.9)', () => {
  it('names singles or doubles, locked pairs and the new formats', () => {
    const d = paddleStackMeta.description
    expect(d).toMatch(/singles or doubles/i)
    expect(d).toMatch(/\block(ed|s|ing)?\b/i)
    expect(d).toMatch(/pairs?/i)
    expect(d).toMatch(/six formats/i)
    expect(d).toContain('Americano')
    expect(d).toContain('Mexicano')
  })

  it('names no Teams mode (T8.9): no "fixed pairs", no "open queue"', () => {
    expect(paddleStackMeta.description).not.toMatch(/fixed pairs/i)
    expect(paddleStackMeta.description).not.toMatch(/open queue/i)
  })

  it('drops the Milestone 5 format list', () => {
    expect(paddleStackMeta.description).not.toMatch(/Winners stay split up/)
  })

  it('stays short enough for a search snippet', () => {
    expect(paddleStackMeta.description.length).toBeLessThanOrEqual(175)
  })
})
