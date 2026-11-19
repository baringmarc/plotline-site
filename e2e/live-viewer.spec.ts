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
  })
}
