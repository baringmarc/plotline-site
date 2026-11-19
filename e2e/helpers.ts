// Shared checks for the device-matrix specs (TASKS.md, Milestone 8 "Device matrix").
// The callbacks passed to page.evaluate run in the browser, so this file needs the DOM types (tsconfig.node has none).
/// <reference lib="dom" />
import { expect, type Page, type TestInfo } from '@playwright/test'
import { findOverlaps, type Box } from './overlap.ts'
import type { Theme } from './matrix.ts'

/** Hosts the page may really reach: the preview server and Google Fonts (so screenshots show the real type). */
function allowed(url: URL): boolean {
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  )
}

/**
 * Answers every other request with an empty 200, so no test touches production (the build uses `.env.production`).
 * Supabase REST reads get `[]`, so live lists show their empty state. WebSockets off the allowed hosts are mocked and
 * never connect (since T6.9 the organizer's page joins its stack's Realtime channel whenever a live key is saved).
 */
export async function stubNetwork(page: Page): Promise<void> {
  await page.routeWebSocket((url) => !allowed(url), () => {})
  await page.route(
    (url) => !allowed(url),
    (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/rest/v1/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return route.fulfill({ status: 200, body: '' })
    },
  )
}

/** Collects console errors and uncaught page errors from now on; call the returned function to read them. */
export function watchConsole(page: Page): () => string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return () => [...errors]
}

/** The site follows `prefers-color-scheme`; there is no theme switch. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
}

const consoles = new WeakMap<Page, () => string[]>()

/** `watchConsole`, remembered per page so `checkPage` can read it. */
export function watch(page: Page): () => string[] {
  const read = watchConsole(page)
  consoles.set(page, read)
  return read
}

export type CheckOptions = {
  /** The screenshot's file name, without `.png`. */
  name: string
  /** CSS selector for the page's cards; no two visible ones may overlap. */
  cards: string
  /** Console errors to check; defaults to the page's `watch()` collector, if any. */
  errors?: () => string[]
}

/** No sideways scroll, no overlapping cards, no console errors; saves a full-page screenshot under `test-results/`. */
export async function checkPage(page: Page, testInfo: TestInfo, options: CheckOptions): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `sideways scroll on ${options.name}`).toBeLessThanOrEqual(clientWidth)

  const boxes: Box[] = await page.locator(options.cards).evaluateAll((els) =>
    els
      .filter((el) => {
        const style = getComputedStyle(el)
        return style.visibility !== 'hidden' && style.display !== 'none'
      })
      .map((el, i) => {
        const r = el.getBoundingClientRect()
        const label = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim().replace(/\s+/g, '.')}#${i}`
        return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height, label }
      }),
  )
  const overlaps = findOverlaps(boxes).map(([a, b]) => `${a.label} × ${b.label}`)
  expect(overlaps, `overlapping cards on ${options.name}`).toEqual([])

  const errors = (options.errors ?? consoles.get(page))?.() ?? []
  expect(errors, `console errors on ${options.name}`).toEqual([])

  // From the top, so the sticky nav and fixed layers (the TV board) sit where a visitor first sees them.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath(`${options.name}.png`), fullPage: true })
}
