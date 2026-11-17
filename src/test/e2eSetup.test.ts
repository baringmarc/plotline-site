// @vitest-environment node
/// <reference types="node" />
// T8.1 Browser tests on every device: the pure parts of the Playwright setup (the device matrix and the
// card-overlap check), the Playwright config built from the matrix, and the wiring that keeps `e2e/` out of
// `npm run test` and `npm run verify` (TASKS.md Milestone 8, "Device matrix").
import { existsSync, globSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { engines, themes, tvViewport, viewports } from '../../e2e/matrix.ts'
import { findOverlaps, type Box } from '../../e2e/overlap.ts'

const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const box = (label: string, x: number, y: number, width: number, height: number): Box => ({ label, x, y, width, height })
const labels = (pairs: Array<[Box, Box]>) => pairs.map(([a, b]) => [a.label, b.label])

describe('findOverlaps (no overlap between a page\'s cards)', () => {
  it('returns nothing for no boxes or one box', () => {
    expect(findOverlaps([])).toEqual([])
    expect(findOverlaps([box('a', 0, 0, 100, 100)])).toEqual([])
  })

  it('returns nothing for cards side by side with a gap', () => {
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 120, 0, 100, 100), box('c', 0, 120, 100, 100)])).toEqual([])
  })

  it('does not count cards whose edges only touch (horizontally or vertically)', () => {
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 100, 0, 100, 100)])).toEqual([])
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 0, 100, 100, 100)])).toEqual([])
  })

  it('does not count an overlap of exactly the tolerance (1 px by default)', () => {
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 99, 99, 100, 100)])).toEqual([])
  })

  it('counts an overlap of more than the tolerance on both axes', () => {
    const a = box('a', 0, 0, 100, 100)
    const b = box('b', 98, 98, 100, 100)
    const pairs = findOverlaps([a, b])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual([a, b])
  })

  it('does not count boxes that overlap on one axis only (a stacked column of cards)', () => {
    // Same x range, y ranges apart: one column of cards on a phone.
    expect(findOverlaps([box('a', 0, 0, 360, 200), box('b', 0, 216, 360, 200)])).toEqual([])
    // Overlap of 50 px on x, but only 0.5 px on y.
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 50, 99.5, 100, 100)])).toEqual([])
  })

  it('counts a card fully inside another', () => {
    expect(labels(findOverlaps([box('outer', 0, 0, 400, 400), box('inner', 50, 50, 100, 100)]))).toEqual([
      ['outer', 'inner'],
    ])
  })

  it('does not count zero-size boxes, even inside another card', () => {
    expect(findOverlaps([box('outer', 0, 0, 400, 400), box('dot', 50, 50, 0, 0)])).toEqual([])
    expect(findOverlaps([box('outer', 0, 0, 400, 400), box('line', 50, 50, 200, 0)])).toEqual([])
    expect(findOverlaps([box('outer', 0, 0, 400, 400), box('rule', 50, 50, 0, 200)])).toEqual([])
  })

  it('honours a custom tolerance', () => {
    const boxes = [box('a', 0, 0, 100, 100), box('b', 99, 99, 100, 100)]
    expect(labels(findOverlaps(boxes, 0))).toEqual([['a', 'b']])
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 90, 90, 100, 100)], 10)).toEqual([])
    expect(findOverlaps([box('a', 0, 0, 100, 100), box('b', 89, 89, 100, 100)], 10)).toHaveLength(1)
  })

  it('reports each overlapping pair once, in input order, keeping the labels', () => {
    const boxes = [
      box('a', 0, 0, 100, 100),
      box('b', 50, 50, 100, 100), // overlaps a and c
      box('c', 120, 120, 100, 100),
      box('d', 500, 500, 50, 50), // alone
    ]
    expect(labels(findOverlaps(boxes))).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
  })

  it('works with fractional layout values (sub-pixel boxes from getBoundingClientRect)', () => {
    expect(findOverlaps([box('a', 0.25, 0, 100.5, 40.75), box('b', 100.75, 0, 100, 40)])).toEqual([])
    expect(findOverlaps([box('a', 0, 0, 100.5, 100.5), box('b', 98.4, 98.4, 10, 10)])).toHaveLength(1)
  })
})

describe('the device matrix (e2e/matrix.ts)', () => {
  it('has the three engines: Chromium, WebKit and Firefox', () => {
    expect([...engines]).toEqual(['chromium', 'webkit', 'firefox'])
  })

  it('has the six viewports at the sizes in TASKS.md', () => {
    expect(viewports).toEqual({
      phone: { width: 390, height: 844 },
      android: { width: 360, height: 740 },
      'ipad-portrait': { width: 820, height: 1180 },
      'ipad-landscape': { width: 1180, height: 820 },
      laptop: { width: 1366, height: 768 },
      pc: { width: 1920, height: 1080 },
    })
  })

  it('covers both themes', () => {
    expect([...themes]).toEqual(['light', 'dark'])
  })

  it('runs the TV board on the PC viewport, 1920×1080', () => {
    expect(tvViewport).toBe('pc')
    expect(viewports[tvViewport]).toEqual({ width: 1920, height: 1080 })
  })
})

describe('playwright.config.ts', () => {
  it('has one project per engine × viewport, named <engine>-<viewport>, 18 in all', async () => {
    const { default: config } = await import('../../playwright.config.ts')
    const names = (config.projects ?? []).map((p) => p.name)
    const expected = engines.flatMap((e) => Object.keys(viewports).map((v) => `${e}-${v}`))
    expect(expected).toHaveLength(18)
    expect([...names].sort()).toEqual([...expected].sort())
  })

  it('gives each project its matrix viewport and its engine', async () => {
    const { default: config } = await import('../../playwright.config.ts')
    for (const project of config.projects ?? []) {
      const [engine, ...rest] = (project.name ?? '').split('-')
      const viewport = rest.join('-') as keyof typeof viewports
      expect(project.use?.viewport, project.name).toEqual(viewports[viewport])
      // Playwright picks the engine from browserName, or from a device descriptor's defaultBrowserType.
      const use = (project.use ?? {}) as { browserName?: string; defaultBrowserType?: string }
      expect(use.browserName ?? use.defaultBrowserType, project.name).toBe(engine)
    }
  })

  it('runs e2e/**/*.spec.ts against vite preview on port 4173 and writes to test-results/', async () => {
    const { default: config } = await import('../../playwright.config.ts')
    expect(String(config.testDir).replace(/^\.\//, '').replace(/\/$/, '')).toMatch(/(^|\/)e2e$/)
    expect(config.testMatch).toBe('**/*.spec.ts')
    expect(String(config.outputDir).replace(/^\.\//, '').replace(/\/$/, '')).toMatch(/(^|\/)test-results$/)
    expect(config.use?.baseURL).toBe('http://localhost:4173')
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer
    expect(server?.command).toMatch(/build/)
    expect(server?.command).toMatch(/vite preview/)
    expect(server?.command).toMatch(/--port 4173/)
    expect(server?.command).toMatch(/--strictPort/)
  })
})

describe('the e2e specs exist (first specs: landing and Paddle Stack)', () => {
  it('has e2e/landing.spec.ts covering / in both themes through checkPage', () => {
    expect(existsSync(resolve(root, 'e2e/landing.spec.ts'))).toBe(true)
    const spec = read('e2e/landing.spec.ts')
    expect(spec).toMatch(/checkPage/)
    expect(spec).toMatch(/stubNetwork/)
    expect(spec).toMatch(/themes|setTheme/)
  })

  it('has e2e/paddle-stack.spec.ts covering the start screen, a started board, TV mode and the ?tv=1 window', () => {
    expect(existsSync(resolve(root, 'e2e/paddle-stack.spec.ts'))).toBe(true)
    const spec = read('e2e/paddle-stack.spec.ts')
    expect(spec).toMatch(/\/paddle-stack/)
    expect(spec).toMatch(/checkPage/)
    expect(spec).toMatch(/stubNetwork/)
    expect(spec).toMatch(/tv=1/)
    expect(spec).toMatch(/tvViewport|-pc\b/)
  })

  it('has e2e/helpers.ts exporting stubNetwork, watchConsole, setTheme and checkPage', () => {
    const helpers = read('e2e/helpers.ts')
    for (const name of ['stubNetwork', 'watchConsole', 'setTheme', 'checkPage']) {
      expect(helpers, name).toMatch(new RegExp(`export (async )?function ${name}\\b|export const ${name}\\b`))
    }
    expect(helpers).toMatch(/findOverlaps/)
    expect(helpers).toMatch(/scrollWidth/)
    expect(helpers).toMatch(/outputPath/)
  })
})

describe('npm run test does not run e2e/', () => {
  it("vitest.config.ts's test.include matches no file under e2e/", async () => {
    const { default: config } = await import('../../vitest.config.ts')
    const include = (config.test?.include ?? []) as string[]
    expect(include.length).toBeGreaterThan(0)
    const exclude = (p: string) => p.includes('node_modules') || p.startsWith('dist')
    const picked = include.flatMap((pattern) => globSync(pattern, { cwd: root, exclude }))
    // Sanity: the include still finds the app's own tests (this file among them).
    expect(picked).toContain('src/test/e2eSetup.test.ts')
    expect(picked.filter((p) => p.replace(/\\/g, '/').startsWith('e2e/'))).toEqual([])
  })

  it('no include pattern reaches e2e/ (not rooted at e2e and not a repo-wide **)', async () => {
    const { default: config } = await import('../../vitest.config.ts')
    const include = (config.test?.include ?? []) as string[]
    for (const pattern of include) {
      expect(pattern, pattern).not.toMatch(/^(\.\/)?e2e\//)
      expect(pattern, pattern).not.toMatch(/^(\.\/)?\*\*\//)
      expect(pattern, pattern).not.toMatch(/\.spec\./)
    }
  })

  it('package.json has test:e2e = playwright test, kept out of verify and test', () => {
    const { scripts } = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(scripts['test:e2e']).toBe('playwright test')
    expect(scripts.verify).not.toMatch(/e2e|playwright/)
    expect(scripts.test).not.toMatch(/e2e|playwright/)
  })

  it('git ignores test-results/, where the screenshots land', () => {
    const ignored = read('.gitignore')
      .split('\n')
      .map((l) => l.trim())
    expect(ignored.some((l) => /^\/?test-results\/?$/.test(l))).toBe(true)
  })
})
