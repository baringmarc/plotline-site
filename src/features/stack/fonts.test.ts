// T8.2 Paddle Stack typeface (TASKS.md T8.2). Picked (user, 2026-11-18): Bricolage Grotesque 700/800 for names,
// scores and headings; DM Sans stays for body text. Loaded only on `/paddle-stack`, with `font-display: swap`; the
// landing page's first load gets no new font requests; BRAND.md is unchanged (the rest of the site keeps Fraunces
// and DM Sans).
//
// Contract the tests rely on (the plan's names):
// - `src/features/stack/fonts.ts` exports `STACK_FONT_URL` (Google Fonts css2 stylesheet URL), `STACK_DISPLAY`
//   (the CSS font-family string for the display face, with fallbacks) and `loadStackFonts(): void` (adds the
//   stylesheet `<link>` to `document.head`; callable more than once without adding a second one);
// - `src/styles/global.css`: a `--stack-display` custom property scoped to `.paddle-stack`;
// - `index.html` doesn't reference the new face.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import html from '../../../index.html?raw'
import css from '../../styles/global.css?raw'

type FontsModule = typeof import('./fonts')

/** A fresh copy of the module each time, so no "already loaded" flag carries over between tests. */
async function freshFonts(): Promise<FontsModule> {
  vi.resetModules()
  return import('./fonts')
}

const FACE = 'Bricolage Grotesque'

function stackLinks(url: string) {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link')].filter((l) => l.getAttribute('href') === url)
}

function removeStackLinks() {
  document.head.querySelectorAll('link').forEach((l) => {
    if ((l.getAttribute('href') ?? '').includes('Bricolage')) l.remove()
  })
}

beforeEach(removeStackLinks)
afterEach(() => {
  removeStackLinks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('STACK_FONT_URL (user, 2026-11-18: Bricolage Grotesque 700/800)', () => {
  it('is a Google Fonts css2 stylesheet URL', async () => {
    const { STACK_FONT_URL } = await freshFonts()
    const url = new URL(STACK_FONT_URL)
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('fonts.googleapis.com')
    expect(url.pathname).toBe('/css2')
  })

  it('asks for Bricolage Grotesque at weights 700 and 800', async () => {
    const { STACK_FONT_URL } = await freshFonts()
    const families = new URL(STACK_FONT_URL).searchParams.getAll('family')
    const bricolage = families.find((f) => f.startsWith(`${FACE}:`) || f === FACE)
    expect(bricolage, `family param in ${STACK_FONT_URL}`).toBeDefined()
    // css2 axis syntax: "Bricolage Grotesque:wght@700;800" (other axes like opsz may come first).
    const [, axes = ''] = bricolage!.split(':')
    const [names, tuples = ''] = axes.split('@')
    expect(names.split(',')).toContain('wght')
    const wghtIndex = names.split(',').indexOf('wght')
    const weights = tuples.split(';').map((t) => t.split(',')[wghtIndex])
    expect(weights).toContain('700')
    expect(weights).toContain('800')
  })

  it('uses font-display: swap', async () => {
    const { STACK_FONT_URL } = await freshFonts()
    expect(new URL(STACK_FONT_URL).searchParams.get('display')).toBe('swap')
  })

  it("doesn't load Fraunces or DM Sans again (index.html already does)", async () => {
    const { STACK_FONT_URL } = await freshFonts()
    const families = new URL(STACK_FONT_URL).searchParams.getAll('family')
    expect(families.some((f) => f.startsWith('Fraunces'))).toBe(false)
    expect(families.some((f) => f.startsWith('DM Sans'))).toBe(false)
  })
})

describe('STACK_DISPLAY', () => {
  it("starts with 'Bricolage Grotesque' and ends with the generic sans-serif fallback", async () => {
    const { STACK_DISPLAY } = await freshFonts()
    const families = STACK_DISPLAY.split(',').map((f) => f.trim())
    expect(families[0].replace(/^['"]|['"]$/g, '')).toBe(FACE)
    // A family name with a space must be quoted to be valid in a canvas `font` string.
    expect(families[0]).toMatch(/^(['"])Bricolage Grotesque\1$/)
    expect(families.length).toBeGreaterThanOrEqual(2)
    expect(families[families.length - 1]).toBe('sans-serif')
  })

  it('is not Fraunces (the site-wide serif stays for the rest of the site)', async () => {
    const { STACK_DISPLAY } = await freshFonts()
    expect(STACK_DISPLAY).not.toMatch(/Fraunces/)
  })
})

describe('loadStackFonts', () => {
  it('adds the stylesheet link to document.head', async () => {
    const { STACK_FONT_URL, loadStackFonts } = await freshFonts()
    expect(stackLinks(STACK_FONT_URL)).toHaveLength(0)
    loadStackFonts()
    const links = stackLinks(STACK_FONT_URL)
    expect(links).toHaveLength(1)
    expect(links[0].rel).toBe('stylesheet')
    expect(links[0].parentElement).toBe(document.head)
  })

  it('can be called more than once and still adds only one link', async () => {
    const { STACK_FONT_URL, loadStackFonts } = await freshFonts()
    loadStackFonts()
    loadStackFonts()
    loadStackFonts()
    expect(stackLinks(STACK_FONT_URL)).toHaveLength(1)
  })

  it('leaves the other links in the head alone', async () => {
    const { loadStackFonts } = await freshFonts()
    const other = document.createElement('link')
    other.rel = 'stylesheet'
    other.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&display=swap'
    document.head.appendChild(other)
    try {
      loadStackFonts()
      expect(other.isConnected).toBe(true)
      expect(other.getAttribute('href')).toContain('DM+Sans')
    } finally {
      other.remove()
    }
  })

  it('makes no fetch or XHR of its own (the browser loads the stylesheet from the link)', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
    vi.stubGlobal('fetch', fetchSpy)
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const { loadStackFonts } = await freshFonts()
    loadStackFonts()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpen).not.toHaveBeenCalled()
  })

  it('does nothing at import time: no link until it is called', async () => {
    const { STACK_FONT_URL } = await freshFonts()
    expect(stackLinks(STACK_FONT_URL)).toHaveLength(0)
  })
})

describe("the landing page's first load has no new font requests", () => {
  it("index.html doesn't reference Bricolage Grotesque", () => {
    expect(html).not.toMatch(/Bricolage/i)
  })

  it("global.css doesn't import a font stylesheet or declare an @font-face", () => {
    expect(css).not.toMatch(/@import[^;]*fonts\.googleapis/i)
    expect(css).not.toMatch(/@import[^;]*Bricolage/i)
    expect(css).not.toMatch(/@font-face/i)
  })

  it('no file outside features/stack imports the stack fonts module or names the face', () => {
    const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/features/stack/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    })
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).not.toMatch(/stack\/fonts['"]/)
      expect(source, file).not.toMatch(/Bricolage/)
    }
  })
})

describe('global.css: --stack-display scoped to .paddle-stack', () => {
  /** Every top-level `selector { body }` rule, with media queries opened up. */
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }))

  it('declares --stack-display on a .paddle-stack rule, naming Bricolage Grotesque first', async () => {
    const declaring = rules.filter((r) => /--stack-display\s*:/.test(r.body))
    expect(declaring.length, 'rules declaring --stack-display').toBeGreaterThanOrEqual(1)
    for (const r of declaring) {
      expect(r.selector, 'selector declaring --stack-display').toMatch(/\.paddle-stack\b/)
      const value = r.body.match(/--stack-display\s*:\s*([^;]+)/)![1].trim()
      expect(value).toMatch(/^(['"])Bricolage Grotesque\1\s*,/)
      expect(value).toMatch(/sans-serif\s*$/)
    }
  })

  it('matches STACK_DISPLAY, so the page and the share image draw the same face', async () => {
    const { STACK_DISPLAY } = await freshFonts()
    const r = rules.find((x) => /--stack-display\s*:/.test(x.body))
    expect(r).toBeDefined()
    const norm = (s: string) => s.replace(/"/g, "'").replace(/\s*,\s*/g, ', ').trim()
    const value = r!.body.match(/--stack-display\s*:\s*([^;]+)/)![1]
    expect(norm(value)).toBe(norm(STACK_DISPLAY))
  })

  it('is not set site-wide (:root, html, body)', () => {
    for (const r of rules) {
      if (!/--stack-display\s*:/.test(r.body)) continue
      expect(r.selector).not.toMatch(/(^|[\s,]):root\b|(^|[\s,])html\b|(^|[\s,])body\b/)
    }
  })

  it('is used by Paddle Stack rules (headings, names or scores)', () => {
    const using = rules.filter((r) => /var\(\s*--stack-display\b/.test(r.body))
    expect(using.length, 'rules using var(--stack-display)').toBeGreaterThanOrEqual(1)
    for (const r of using) expect(r.selector, 'selector using var(--stack-display)').toMatch(/paddle-stack|stack-/)
  })
})
