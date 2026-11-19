// `/paddle-stack/live/<code>` in every device-matrix project, both themes (TASKS.md T6.4): a venue's stack mid-play
// and its final standings. The build points at production, so `get_live_stack` is answered here with a stack made
// by the engine, and the Realtime WebSocket is held open without answering (the page stays on its first read).
import { expect, test, type Page } from '@playwright/test'
import { addPlayers, createSession, fillCourts, recordScore, timeOut } from '../src/features/stack/engine.ts'
import { buildSnapshot } from '../src/features/stack/live/snapshot.ts'
import { checkPage, setTheme, stubNetwork, watch } from './helpers.ts'
import { themes } from './matrix.ts'

const NAMES = ['Ana', 'Ben', 'Carla', 'Dante', 'Ella', 'Felix', 'Gia', 'Hugo', 'Ines', 'Jun', 'Kiko', 'Lea']
const cards = '.stack-viewer-venue, .stack-courts > *, .stack-line, .stack-out, .stack-standings, .stack-ended, aside.stack-venue'

function stack(ended: boolean) {
  let s = createSession({ format: 'fair', courts: 2, title: 'Sunday Open Play (ALL LEVELS)' })
  s = fillCourts(addPlayers(s, NAMES))
  s = fillCourts(recordScore(s, s.games[0].id, 11, 7))
  s = fillCourts(recordScore(s, s.games[2].id, 11, 9))
  s = timeOut(s, s.line[s.line.length - 1])
  return {
    title: s.title,
    courts: s.courts,
    snapshot: buildSnapshot(s),
    version: 7,
    ended,
    expires_at: '2026-11-20T12:00:00+00:00',
    venue: { name: 'Claudex Courts', slug: 'claudex-courts', logo_path: null },
  }
}

async function open(page: Page, theme: (typeof themes)[number], ended: boolean) {
  watch(page)
  await stubNetwork(page)
  await page.route(
    (url) => url.pathname.endsWith('/rest/v1/rpc/get_live_stack'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stack(ended)) }),
  )
  await page.routeWebSocket(/\/realtime\//, () => {})
  await setTheme(page, theme)
  await page.goto('/paddle-stack/live/MatrixCode_1')
}

for (const theme of themes) {
  test.describe(`live stack player view, ${theme}`, () => {
    test('mid-play', async ({ page }, testInfo) => {
      await open(page, theme, false)
      await expect(page.getByRole('region', { name: /^Court 2\b/ })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Book a court' })).toHaveAttribute('href', 'https://claudex-courts.plotline.fit/book')
      await expect(page.getByRole('table', { name: 'Standings' })).toBeVisible()
      await checkPage(page, testInfo, { name: `live-viewer-${theme}`, cards })
    })

    test('ended', async ({ page }, testInfo) => {
      await open(page, theme, true)
      await expect(page.getByRole('heading', { name: 'Final standings' })).toBeVisible()
      await checkPage(page, testInfo, { name: `live-viewer-ended-${theme}`, cards })
    })

    // T6.5: a player picks their name and their card is made on the phone, with nothing sent anywhere.
    test('share my card', async ({ page }, testInfo) => {
      await open(page, theme, false)
      // The page's own typeface (added on mount) finishes loading first; the card must fetch nothing more.
      await expect(page.locator('link[href*="Bricolage"]')).toHaveCount(1)
      await page.evaluate(async () => {
        const link = document.querySelector<HTMLLinkElement>('link[href*="Bricolage"]')!
        if (!link.sheet) await new Promise((done) => link.addEventListener('load', done, { once: true }))
        await Promise.all(['700 16px "Bricolage Grotesque"', '800 16px "Bricolage Grotesque"'].map((f) => document.fonts.load(f)))
        await document.fonts.ready
      })
      const requests: string[] = []
      // The viewer's own reads (a poll, Realtime) aren't the card's; anything else is.
      page.on('request', (r) => {
        const url = r.url()
        if (url.startsWith('blob:') || url.startsWith('data:') || /get_live_stack|\/realtime\//.test(url)) return
        requests.push(`${r.method()} ${url}`)
      })
      await page.getByRole('button', { name: 'Share my card' }).click()
      await checkPage(page, testInfo, { name: `live-viewer-pick-${theme}`, cards })
      await page.getByRole('combobox', { name: 'Your name' }).selectOption({ label: 'Carla' })
      await page.getByRole('button', { name: 'Make my card' }).click()
      const dialog = page.getByRole('dialog', { name: 'Share a card' })
      await expect(dialog).toBeVisible()
      const img = dialog.getByRole('img', { name: 'Preview of the card' })
      await expect(img).toHaveAttribute('src', /^blob:/, { timeout: 20_000 })
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true)
      expect(requests).toEqual([])
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
      await expect(page.getByRole('button', { name: 'Share my card' })).toBeVisible()
    })
  })
}
