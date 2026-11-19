// The organizer's Go live on the board (TASKS.md T6.2), in Chromium against court-booking-system's local stack.
// Cloudflare's script is replaced by a stub that passes at once (the local stack skips the check), so the run
// needs no internet. Reads the stack back through its RPC to prove it was published.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const STUB_TURNSTILE = `window.turnstile = { render(el, o) { setTimeout(() => o.callback('local-token'), 0); return 'w' }, reset() {}, remove() {} };`
const STACK_API = 'http://127.0.0.1:54321'

// The phone width the T6.2 criteria check (360 px).
test.use({ viewport: { width: 360, height: 740 } })

test.beforeEach(async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: STUB_TURNSTILE }),
  )
})

test('go live on the board: the link is published, axe is clean, and the phone width holds', async ({ page, request }) => {
  await page.goto('/paddle-stack')
  await page.getByLabel('Players', { exact: true }).fill('Ana\nBen\nCy\nDee')
  await page.getByRole('button', { name: 'Start the stack' }).click()

  await page.getByRole('button', { name: 'Go live', exact: true }).click()
  const link = page.getByLabel('Link for players', { exact: true })
  await expect(link).toHaveValue(/\/paddle-stack\/live\/[A-Za-z0-9_-]+$/)
  await expect(page.getByLabel('Live status')).toHaveText('Live')

  // The stack exists on the local stack, with the board published.
  const code = (await link.inputValue()).split('/').pop()!
  const read = await request.post(`${STACK_API}/rest/v1/rpc/get_live_stack`, {
    headers: { apikey: process.env.LIVE_SUPABASE_PUBLISHABLE_KEY ?? '', 'content-type': 'application/json' },
    data: { p_code: code },
  })
  expect(read.ok()).toBe(true)
  const stack = await read.json()
  expect(stack).toMatchObject({ version: 1, ended: false, snapshot: { v: 1, courts: 2 } })

  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations).toEqual([])

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
