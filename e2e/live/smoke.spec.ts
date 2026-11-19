// Live stacks against court-booking-system's local stack (TASKS.md T6.1): go live, publish, read back.
// The organizer's side is driven the way plotline-site's API drives it: the `stack-live` function, then the
// RPCs with the publishable key. Start the stack first (`npx supabase start` in court-booking-system).
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import type { Database } from '../../src/lib/database.types.ts'
import { addPlayers, createSession, fillCourts } from '../../src/features/stack/engine.ts'
import { buildSnapshot, readSnapshot } from '../../src/features/stack/live/snapshot.ts'

const url = process.env.LIVE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const publishableKey = process.env.LIVE_SUPABASE_PUBLISHABLE_KEY
if (!publishableKey) throw new Error('Set LIVE_SUPABASE_PUBLISHABLE_KEY to the local stack key (`npx supabase status`).')

const supabase = createClient<Database>(url, publishableKey, { auth: { persistSession: false } })

// Publishes are at least 1 s apart on the server; the smoke waits a little longer than that.
const WAIT_BETWEEN_PUBLISHES_MS = 1100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('go live, publish, read back', async () => {
  const live = await supabase.functions.invoke<{ ok: boolean; code: string; secret: string }>('stack-live', {
    body: { turnstileToken: 'local-smoke', courts: 2, title: 'Smoke' },
  })
  expect(live.error).toBeNull()
  const { code, secret } = live.data!
  expect(code).toMatch(/^[A-Za-z0-9_-]+$/)

  const session = fillCourts(
    addPlayers(createSession({ format: 'fair', courts: 2, title: 'Smoke' }), ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay']),
  )
  const snapshot = buildSnapshot(session)

  const first = await supabase.rpc('publish_live_stack', {
    p_code: code,
    p_secret: secret,
    p_version: 1,
    p_snapshot: snapshot,
  })
  expect(first.error).toBeNull()
  expect(first.data).toMatchObject({ version: 1 })

  const read = await supabase.rpc('get_live_stack', { p_code: code })
  expect(read.error).toBeNull()
  expect(read.data).toMatchObject({ version: 1, ended: false, title: 'Smoke', courts: 2 })
  expect(readSnapshot((read.data as { snapshot: unknown }).snapshot)).toEqual(snapshot)

  // Too soon after the last publish: the server answers `too_fast`.
  const tooFast = await supabase.rpc('publish_live_stack', { p_code: code, p_secret: secret, p_version: 2, p_snapshot: snapshot })
  expect(tooFast.error?.hint).toBe('too_fast')

  await sleep(WAIT_BETWEEN_PUBLISHES_MS)
  const second = await supabase.rpc('publish_live_stack', { p_code: code, p_secret: secret, p_version: 2, p_snapshot: snapshot })
  expect(second.error).toBeNull()

  // The same version again is stale.
  await sleep(WAIT_BETWEEN_PUBLISHES_MS)
  const stale = await supabase.rpc('publish_live_stack', { p_code: code, p_secret: secret, p_version: 2, p_snapshot: snapshot })
  expect(stale.error?.hint).toBe('stale_version')

  await sleep(WAIT_BETWEEN_PUBLISHES_MS)
  const ended = await supabase.rpc('publish_live_stack', {
    p_code: code,
    p_secret: secret,
    p_version: 3,
    p_snapshot: snapshot,
    p_end: true,
  })
  expect(ended.error).toBeNull()
  const readEnded = await supabase.rpc('get_live_stack', { p_code: code })
  expect(readEnded.data).toMatchObject({ version: 3, ended: true })
})
