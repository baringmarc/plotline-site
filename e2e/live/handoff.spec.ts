// T6.3 hand-off from a venue, in Chromium against court-booking-system's local stack. An admin makes the stack with
// `create_venue_live_stack` (signed in with the publishable key, as the venue's /admin/open-play does), and the page
// opens `/paddle-stack?live=<code>#key=<secret>`. Needs a local admin and an open-play session (LIVE_HANDOFF_EMAIL,
// LIVE_HANDOFF_PASSWORD, LIVE_HANDOFF_SESSION_ID); their fixture is made in court-booking-system's e2e helpers and
// never committed here. No service-role key is used.
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import type { Database } from '../../src/lib/database.types.ts'

const STUB_TURNSTILE = `window.turnstile = { render(el, o) { setTimeout(() => o.callback('local-token'), 0); return 'w' }, reset() {}, remove() {} };`
const STACK_API = 'http://127.0.0.1:54321'
const STORAGE_KEY = 'plotline.paddle-stack.live'

// The phone width the T6.3 criteria check (360 px).
test.use({ viewport: { width: 360, height: 740 } })

test.beforeEach(async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: STUB_TURNSTILE }),
  )
})

test('a venue hand-off opens a live venue session and takes the secret out of the address bar', async ({ page }) => {
  const publishableKey = process.env.LIVE_SUPABASE_PUBLISHABLE_KEY
  const email = process.env.LIVE_HANDOFF_EMAIL
  const password = process.env.LIVE_HANDOFF_PASSWORD
  const sessionId = process.env.LIVE_HANDOFF_SESSION_ID
  if (!publishableKey || !email || !password || !sessionId) {
    throw new Error('Set LIVE_SUPABASE_PUBLISHABLE_KEY, LIVE_HANDOFF_EMAIL, LIVE_HANDOFF_PASSWORD and LIVE_HANDOFF_SESSION_ID.')
  }

  // The admin's side: what /admin/open-play does when it runs the session as a stack.
  const admin = createClient<Database>(STACK_API, publishableKey, { auth: { persistSession: false } })
  const signIn = await admin.auth.signInWithPassword({ email, password })
  expect(signIn.error).toBeNull()
  const made = await admin.rpc('create_venue_live_stack', { p_open_play_session_id: sessionId })
  expect(made.error).toBeNull()
  const { code, secret } = made.data as { code: string; secret: string }

  await page.goto(`/paddle-stack?live=${code}#key=${secret}`)

  // The venue's name shows, the board is live, and the address bar no longer carries the code or the secret.
  await expect(page.getByText(/^Open play at /)).toBeVisible()
  await expect(page.getByLabel('Live status')).toHaveText('Live')
  await expect(page).toHaveURL(/\/paddle-stack$/)
  expect(page.url()).not.toContain(secret)
  expect(page.url()).not.toContain('live=')

  // The key is stored on this device, with the venue; the stack has the board published.
  const stored = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ code, secret })
  const read = await admin.rpc('get_live_stack', { p_code: code })
  expect(read.data).toMatchObject({ ended: false, venue: expect.any(Object) })
  expect(read.data).toMatchObject({ version: expect.any(Number) })
  expect((read.data as { version: number }).version).toBeGreaterThanOrEqual(1)

  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
