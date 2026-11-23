// T8.5 start screen copy and layout (TASKS.md T8.5). Plan names in src/config/paddleStack.ts (re-exported by site.ts):
// - `formats[]`: six `{ id; label; hint; badge; details; column: 'left' | 'right' }` (`description` renamed to
//   `hint`). Acceptance (user, 2026-11-18, second by-eye look): order fair, americano, winners-split (column 'left'),
//   then mexicano, winners-losers, skill-groups (column 'right'); all left entries before all right ones. Acceptance (user, 2026-11-18, from the by-eye
//   check): Round Robin and Americano are one card, "Americano (Round Robin)"; `round-robin` is not in `formats`
//   (the engine still accepts it, so a saved Round Robin session loads);
// - `start.formatLabel`, `start.playersLabel`, `start.levelFor(name)`, `start.noLevel`,
//   `start.levels: { value: Level; label }[]` (1–3), `start.pairsHint`;
// - T8.9 (Teams removed): `start.teamsLabel`, `start.teams`, `start.pairLabel`, `start.needEven` are gone;
//   `start.pairWith(name)`, `start.pairPlaceholder`, `start.unlock`, `start.needAllPairs` are new, `start.pairsHint`
//   is reworded (no pairing by list order); `board.pairWith(name)`, `board.pairPlaceholder`, `board.unlock`,
//   `board.addPairLabel`, `board.addPairFirst`, `board.addPairSecond`, `board.addPairSubmit` are new;
// - `guide.sections` and `faq` describe all six formats and the options (levels, locked pairs), and no longer
//   present Round Robin as a separate format or name a Teams mode (Open queue / Fixed pairs).
// CSS (global.css): `.stack-start` is width 100% (no 640px cap, no 120px cap on its select); `.stack-formats` is the
// format grid: one column by default, two from a `min-width` breakpoint of at most 820px; it holds two
// `.stack-formats-col` columns, each a grid or flex column.
import { describe, expect, it } from 'vitest'
import css from '../styles/global.css?raw'
import { LEVELS } from '../features/stack/engine'
import { paddleStack } from './site'

const { formats, start, board, guide, faq } = paddleStack
const nonEmpty = (s: unknown) => typeof s === 'string' && s.trim().length > 0

describe('paddleStack.formats (T8.5: six format cards)', () => {
  it('has the six formats in order: left column then right column (user, 2026-11-18, second by-eye look)', () => {
    expect(formats.map((f) => f.id)).toEqual(['fair', 'americano', 'winners-split', 'mexicano', 'winners-losers', 'skill-groups'])
  })

  it('each format names its column: Fair rotation, Americano, Winners stay left; Mexicano, Winners vs Losers, Skill groups right', () => {
    const col = Object.fromEntries(formats.map((f) => [f.id, (f as { column?: unknown }).column]))
    expect(col).toEqual({
      fair: 'left',
      americano: 'left',
      'winners-split': 'left',
      mexicano: 'right',
      'winners-losers': 'right',
      'skill-groups': 'right',
    })
  })

  it('all left-column formats come before all right-column ones', () => {
    const cols = formats.map((f) => (f as { column?: unknown }).column)
    const firstRight = cols.indexOf('right')
    const lastLeft = cols.lastIndexOf('left')
    expect(firstRight, 'a right column exists').toBeGreaterThan(-1)
    expect(lastLeft, 'a left column exists').toBeGreaterThan(-1)
    expect(lastLeft).toBeLessThan(firstRight)
  })

  it('Round Robin is merged into Americano: the americano card is "Americano (Round Robin)" and round-robin is gone', () => {
    expect(formats.find((f) => f.id === 'americano')?.label).toBe('Americano (Round Robin)')
    expect(formats.map((f) => f.id as string)).not.toContain('round-robin')
    expect(formats.filter((f) => /round[\s-]?robin/i.test(f.label))).toHaveLength(1)
  })

  it('every format card has a label, a one-line hint, a badge and a longer explanation', () => {
    for (const f of formats) {
      expect(nonEmpty(f.label), `${f.id} label`).toBe(true)
      expect(nonEmpty(f.hint), `${f.id} hint`).toBe(true)
      expect(nonEmpty(f.badge), `${f.id} badge`).toBe(true)
      expect(nonEmpty(f.details), `${f.id} details`).toBe(true)
      expect(f.hint, `${f.id} hint is one line`).not.toMatch(/\n/)
      expect(f.hint.length, `${f.id} hint is short`).toBeLessThanOrEqual(100)
      expect(f.badge.length, `${f.id} badge is a short tag`).toBeLessThanOrEqual(20)
      expect(f.details.length, `${f.id} details is longer than its hint`).toBeGreaterThan(f.hint.length)
    }
  })

  it('`description` is renamed to `hint`', () => {
    for (const f of formats) expect(f, f.id).not.toHaveProperty('description')
  })

  it('labels are unique and none is a prefix of another (radios are found by label)', () => {
    const labels = formats.map((f) => f.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const a of labels) for (const b of labels) if (a !== b) expect(b.startsWith(a), `${b} starts with ${a}`).toBe(false)
  })
})

describe('paddleStack.start (T8.5: players, levels; T8.9: pair locks)', () => {
  it('keeps the existing keys', () => {
    for (const k of ['titleLabel', 'playLabel', 'courtsLabel', 'namesLabel', 'namesHint', 'needFour', 'needTwo', 'submit'] as const) {
      expect(nonEmpty(start[k]), k).toBe(true)
    }
    expect(start.plays.map((p) => p.id)).toEqual(['singles', 'doubles'])
  })

  it('has the labels and messages', () => {
    for (const k of ['formatLabel', 'playersLabel', 'noLevel', 'pairsHint', 'pairPlaceholder', 'unlock', 'needAllPairs'] as const) {
      expect(nonEmpty(start[k]), k).toBe(true)
    }
  })

  it('the Teams copy is gone (T8.9): no teamsLabel, teams, pairLabel or needEven', () => {
    for (const k of ['teamsLabel', 'teams', 'pairLabel', 'needEven']) expect(start, k).not.toHaveProperty(k)
  })

  it('pairsHint no longer says names pair up in list order (T8.9)', () => {
    expect(start.pairsHint).not.toMatch(/1 with 2|order you list|list order/i)
    expect(start.pairsHint).toMatch(/lock|pair/i)
  })

  it('pairWith names the player; the unlock label, the placeholder and the Round Robin message are distinct', () => {
    expect(start.pairWith('Andrew')).toContain('Andrew')
    expect(start.pairWith('Andrew')).not.toBe(start.pairWith('Maria'))
    expect(start.pairWith('Andrew')).not.toBe(start.levelFor('Andrew'))
    expect(start.pairPlaceholder).not.toBe(start.noLevel)
    expect(start.needAllPairs).not.toBe(start.needFour)
  })

  it('levels are 1–3 (the engine’s LEVELS), each with a label', () => {
    expect(start.levels.map((l) => l.value)).toEqual([...LEVELS])
    for (const l of start.levels) expect(nonEmpty(l.label), String(l.value)).toBe(true)
    expect(new Set(start.levels.map((l) => l.label)).size).toBe(3)
    expect(start.levels.map((l) => l.label)).not.toContain(start.noLevel)
  })

  it('levelFor names the player', () => {
    expect(start.levelFor('Andrew')).toContain('Andrew')
    expect(start.levelFor('Andrew')).not.toBe(start.levelFor('Maria'))
  })
})

describe('paddleStack.board (T8.9: pair locks and Add a pair)', () => {
  it('has the pair lock labels and the Add a pair form copy', () => {
    for (const k of ['pairPlaceholder', 'unlock', 'addPairLabel', 'addPairFirst', 'addPairSecond', 'addPairSubmit'] as const) {
      expect(nonEmpty(board[k]), k).toBe(true)
    }
  })

  it('pairWith names the player; the two Add a pair boxes have different labels (found by label)', () => {
    expect(board.pairWith('Ana')).toContain('Ana')
    expect(board.pairWith('Ana')).not.toBe(board.pairWith('Ben'))
    expect(board.addPairFirst).not.toBe(board.addPairSecond)
    expect(board.addPairLabel).not.toBe(board.addLabel)
    for (const k of ['timeOut', 'remove', 'backInLine'] as const) expect(board.unlock, k).not.toBe(board[k])
  })
})

describe('guide and FAQ cover the new formats and options (T8.5)', () => {
  const guideText = guide.sections.map((s) => `${s.title} ${s.body}`).join(' ')
  const allText = `${guideText} ${faq.items.map((i) => `${i.q} ${i.a}`).join(' ')}`

  it('the guide names every one of the six formats', () => {
    for (const f of formats) expect(guideText, f.id).toContain(f.label)
  })

  it('the guide and FAQ no longer present Round Robin as a separate format (only inside "Americano (Round Robin)")', () => {
    const merged = formats.find((f) => f.id === 'americano')!.label
    const rest = allText.split(merged).join(' ')
    expect(rest).not.toMatch(/round[\s-]?robin/i)
  })

  it('the guide or FAQ explains skill levels and locking pairs (T8.9)', () => {
    expect(allText).toMatch(/\blevels?\b/i)
    expect(allText).toMatch(/\block(ed|s|ing)?\b/i)
  })

  it('the "Singles, doubles…" guide section says pairs can be locked, and names no Teams mode (T8.9)', () => {
    const section = guide.sections.find((s) => /singles,?\s+doubles/i.test(s.title))
    expect(section, 'a guide section on singles and doubles').toBeDefined()
    expect(section!.body).toMatch(/\block(ed|s|ing)?\b/i)
    expect(section!.body).not.toMatch(/open queue/i)
    expect(section!.body).not.toMatch(/names pair up in the order/i)
  })

  it('no guide text, FAQ answer or format copy names a Teams mode: no "Open queue", no "fixed pairs" (T8.9)', () => {
    const copy = [
      ...guide.sections.map((s) => s.body),
      ...faq.items.map((i) => i.a),
      ...formats.map((f) => `${f.hint} ${f.details}`),
    ].join(' ')
    expect(copy).not.toMatch(/open queue/i)
    expect(copy).not.toMatch(/fixed pairs/i)
  })

  it('the format details say where pairs can be locked: Winners stay (a locked pair), not Americano or Mexicano (T8.9)', () => {
    for (const id of ['winners-split', 'americano', 'mexicano'] as const) {
      expect(formats.find((f) => f.id === id)!.details, id).toMatch(/\block(ed|s|ing)?\b/i)
    }
  })

  it('the FAQ still has 3 or 4 items', () => {
    expect(faq.items.length).toBeGreaterThanOrEqual(3)
    expect(faq.items.length).toBeLessThanOrEqual(4)
  })
})

/** The declarations of every top-level rule whose selector list is exactly `selector`. */
function rules(source: string, selector: string): string[] {
  const out: string[] = []
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`, 'g')
  for (const m of source.matchAll(re)) out.push(m[2])
  return out
}

/** The bodies of `@media (min-width: Npx)` blocks, with N. */
function minWidthBlocks(source: string): { px: number; body: string }[] {
  const out: { px: number; body: string }[] = []
  const re = /@media[^{]*\(\s*min-width:\s*(\d+)px\s*\)[^{]*\{/g
  for (const m of source.matchAll(re)) {
    let depth = 1
    let i = m.index! + m[0].length
    const startAt = i
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    out.push({ px: Number(m[1]), body: source.slice(startAt, i - 1) })
  }
  return out
}

describe('start card layout CSS (T8.5)', () => {
  it('.stack-start is full width, with no 640px cap', () => {
    const decls = rules(css, '.stack-start').join(';')
    expect(decls).toMatch(/(^|[;\s{])width:\s*100%/)
    expect(decls).not.toMatch(/max-width:\s*640px/)
    expect(css).not.toMatch(/\.stack-start[^{]*\{[^}]*max-width:\s*640px/)
  })

  it('the start card’s select is no longer capped at 120px', () => {
    expect(css).not.toMatch(/\.stack-start\s+select\s*\{[^}]*max-width:\s*120px/)
  })

  it('.stack-formats is a one-column grid by default', () => {
    const decls = rules(css, '.stack-formats').join(';')
    expect(decls).toMatch(/display:\s*grid/)
    const cols = decls.match(/grid-template-columns:\s*([^;]+)/)
    if (cols) expect(cols[1].trim()).toMatch(/^(1fr|minmax\([^)]*\)|100%|auto|none)$/)
  })

  it('.stack-formats has two columns from a min-width breakpoint of at most 820px', () => {
    const twoCol = minWidthBlocks(css).filter(({ body }) =>
      rules(body, '.stack-formats').some((d) => /grid-template-columns:\s*(repeat\(\s*2\s*,|1fr\s+1fr\b|minmax\([^)]*\)\s+minmax\()/.test(d)),
    )
    expect(twoCol.length, 'a @media (min-width) rule giving .stack-formats two columns').toBeGreaterThan(0)
    expect(Math.min(...twoCol.map((b) => b.px))).toBeLessThanOrEqual(820)
    // Phones (360 and 390) stay one column.
    expect(Math.min(...twoCol.map((b) => b.px))).toBeGreaterThan(390)
  })

  it('.stack-formats-col is a grid or flex column (user, 2026-11-18, second by-eye look)', () => {
    const decls = rules(css, '.stack-formats-col').join(';')
    expect(decls, 'a .stack-formats-col rule').not.toBe('')
    const grid = /display:\s*grid/.test(decls)
    const flexCol = /display:\s*flex/.test(decls) && /flex-direction:\s*column/.test(decls)
    expect(grid || flexCol, `.stack-formats-col is a grid or a flex column: ${decls}`).toBe(true)
  })
})
