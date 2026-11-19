// The player view (TASKS.md T6.4), in Chromium against court-booking-system's local stack: the organizer goes live in
// one browser context and a phone in another follows the link. First live through the Realtime channel, then with
// the phone's WebSocket refused, so it falls back to reading the stack every 15 s.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'

const STUB_TURNSTILE = `window.turnstile = { render(el, o) { setTimeout(() => o.callback('local-token'), 0); return 'w' }, reset() {}, remove() {} };`
const PHONE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }

/** The organizer starts a stack of four on one court and goes live; returns the page and the players' link. */
async function organizerLive(browser: Browser): Promise<{ organizer: Page; link: string }> {
  const ctx = await browser.newContext()
  const organizer = await ctx.newPage()
  await organizer.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: STUB_TURNSTILE }),
  )
  await organizer.goto('/paddle-stack')
  await organizer.getByLabel('Players', { exact: true }).fill('Ana\nBen\nCy\nDee\nEli\nFay')
  await organizer.getByRole('button', { name: 'Start the stack' }).click()
  await organizer.getByRole('button', { name: 'Go live', exact: true }).click()
  await expect(organizer.getByLabel('Live status')).toHaveText('Live')
  const link = await organizer.getByLabel('Link for players', { exact: true }).inputValue()
  return { organizer, link: new URL(link).pathname }
}

/** Scores the game on Court 1, 11–4 for the first side. */
async function scoreCourtOne(organizer: Page) {
  const court = organizer.getByRole('region', { name: /^Court 1\b/ })
  await court.getByRole('button', { name: 'Enter score' }).click()
  const boxes = court.getByRole('textbox')
  await boxes.nth(0).fill('11')
  await boxes.nth(1).fill('4')
  await court.getByRole('button', { name: 'Save score' }).click()
}

test('a phone follows the organizer live, axe is clean, and the phone width holds', async ({ browser }) => {
  const { organizer, link } = await organizerLive(browser)
  const phoneCtx = await browser.newContext(PHONE)
  const phone = await phoneCtx.newPage()
  await phone.goto(link)

  await expect(phone.getByRole('region', { name: /^Court 1\b/ })).toBeVisible()
  await expect(phone.getByLabel('Live status')).toHaveText('Live')
  await expect(phone.getByText('No scores yet.')).toBeVisible()
  await expect(phone.getByRole('button', { name: 'Enter score' })).toHaveCount(0)

  await scoreCourtOne(organizer)
  // Through the channel: well inside one 15 s poll.
  await expect(phone.getByRole('table', { name: 'Standings' })).toBeVisible({ timeout: 8_000 })

  const axe = await new AxeBuilder({ page: phone }).analyze()
  expect(axe.violations).toEqual([])
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

  // End session: the phone shows the final standings.
  await organizer.getByRole('button', { name: 'End session' }).click()
  await organizer.getByRole('button', { name: 'Yes, end it' }).click()
  await expect(phone.getByRole('heading', { name: 'Final standings' })).toBeVisible({ timeout: 8_000 })
  await expect(phone.getByRole('region', { name: 'Up next' })).toHaveCount(0)
})

test('with the WebSocket refused, the phone falls back to polling and still sees the change', async ({ browser }) => {
  test.setTimeout(90_000)
  const { organizer, link } = await organizerLive(browser)
  const phoneCtx = await browser.newContext(PHONE)
  const phone = await phoneCtx.newPage()
  // Realtime can't connect: the channel errors or times out, and the view reads the stack every 15 s.
  await phone.routeWebSocket(/\/realtime\//, (ws) => ws.close())
  await phone.goto(link)

  await expect(phone.getByRole('region', { name: /^Court 1\b/ })).toBeVisible()
  await expect(phone.getByLabel('Live status')).toHaveText(/Reconnecting/, { timeout: 20_000 })

  await scoreCourtOne(organizer)
  // One poll (15 s) plus the organizer's 2 s publish gap.
  await expect(phone.getByRole('table', { name: 'Standings' })).toBeVisible({ timeout: 25_000 })
  await expect(phone.getByText(/Last updated \d{1,2}:\d{2}/)).toBeVisible()
})

test('an unknown code says the stack has ended, and axe is clean', async ({ page }) => {
  await page.goto('/paddle-stack/live/NoSuchCode_123')
  await expect(page.getByText('This stack has ended. Ask the organizer for a new link.')).toBeVisible()
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations).toEqual([])
})
