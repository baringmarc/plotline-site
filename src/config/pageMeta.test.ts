import { describe, expect, it } from 'vitest'
import { paddleStackMeta } from './pageMeta'

// T8.8: the share text follows Milestone 8's start screen (singles, fixed pairs, six formats).
describe('paddleStackMeta description (T8.8)', () => {
  it('names singles or doubles, fixed pairs and the new formats', () => {
    const d = paddleStackMeta.description
    expect(d).toMatch(/singles or doubles/i)
    expect(d).toMatch(/fixed pairs/i)
    expect(d).toMatch(/six formats/i)
    expect(d).toContain('Americano')
    expect(d).toContain('Mexicano')
  })

  it('drops the Milestone 5 format list', () => {
    expect(paddleStackMeta.description).not.toMatch(/Winners stay split up/)
  })

  it('stays short enough for a search snippet', () => {
    expect(paddleStackMeta.description.length).toBeLessThanOrEqual(175)
  })
})
