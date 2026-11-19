// T6.1 Live layer: the API (TASKS.md T6.1; court-booking-system docs/PLATFORM.md §4 "Live stacks").
// Names from the approved plan: `goLive({ turnstileToken, courts, title })` -> `{ code, secret }` through
// `callFunction('stack-live', body)`; `getLiveStack(code)` -> `LiveStackView | null` through
// `supabase.rpc('get_live_stack', { p_code })`; `publishLiveStack({ code, secret, version, snapshot, end? })` ->
// `{ version, expiresAt }` through `supabase.rpc('publish_live_stack', { p_code, p_secret, p_version, p_snapshot, p_end })`;
// `LiveError` (has `code: LiveErrorCode`). A PostgREST error maps by its `hint`, a callFunction error by its message,
// anything else to 'unknown'.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts, recordScore } from '../engine'
import { buildSnapshot } from './snapshot'
import { LiveError, getLiveStack, goLive, publishLiveStack, type LiveErrorCode } from './api'

const callFunction = vi.fn()
const rpc = vi.fn()

vi.mock('../../../lib/functions', () => ({ callFunction: (...a: unknown[]) => callFunction(...a) }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

/** What supabase-js gives back for an RPC that raised: a PostgREST error with a `hint`. */
const pgError = (hint: string) => ({
  data: null,
  error: { message: `raised ${hint || 'something'}`, code: 'P0001', hint, details: '' },
})

function snapshot() {
  let s = createSession({ format: 'fair', courts: 2, title: 'Tuesday Open Play' })
  s = addPlayers(s, ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida'])
  s = fillCourts(s)
  s = recordScore(s, s.games[0].id, 11, 4)
  return buildSnapshot(fillCourts(s))
}

/** Awaits a call expected to fail and returns what it threw. */
async function caught(p: Promise<unknown>): Promise<unknown> {
  try {
    await p
  } catch (e) {
    return e
  }
  throw new Error('expected the call to throw')
}

async function expectLiveError(p: Promise<unknown>, code: LiveErrorCode) {
  const e = await caught(p)
  expect(e).toBeInstanceOf(LiveError)
  expect(e).toBeInstanceOf(Error)
  expect((e as LiveError).code).toBe(code)
}

beforeEach(() => {
  callFunction.mockReset()
  rpc.mockReset()
})

// ---------- goLive ----------

describe('goLive (T6.1)', () => {
  it('calls stack-live with turnstileToken, courts and title and returns the code and secret', async () => {
    callFunction.mockResolvedValue({ ok: true, code: 'abc123_URLsafe', secret: 's3cret-value' })
    const result = await goLive({ turnstileToken: 'tok-1', courts: 3, title: 'Tuesday Open Play' })
    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(callFunction).toHaveBeenCalledWith('stack-live', { turnstileToken: 'tok-1', courts: 3, title: 'Tuesday Open Play' })
    expect(result).toEqual({ code: 'abc123_URLsafe', secret: 's3cret-value' })
  })

  it('does not call the database directly', async () => {
    callFunction.mockResolvedValue({ ok: true, code: 'c', secret: 's' })
    await goLive({ turnstileToken: 'tok', courts: 1, title: '' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each<LiveErrorCode>(['invalid_input', 'bot_check_failed', 'busy', 'unavailable', 'server_error'])(
    'maps the stack-live error %s to a LiveError with that code',
    async (code) => {
      callFunction.mockRejectedValue(new Error(code))
      await expectLiveError(goLive({ turnstileToken: 'tok', courts: 2, title: 'x' }), code)
    },
  )

  it('maps a message it does not know (e.g. the network message) to unknown', async () => {
    callFunction.mockRejectedValue(new Error('Network problem. Please check your connection and try again.'))
    await expectLiveError(goLive({ turnstileToken: 'tok', courts: 2, title: '' }), 'unknown')
  })

  it('maps a thrown non-Error value to unknown', async () => {
    callFunction.mockRejectedValue('busy')
    await expectLiveError(goLive({ turnstileToken: 'tok', courts: 2, title: '' }), 'unknown')
  })
})

// ---------- getLiveStack ----------

describe('getLiveStack (T6.1)', () => {
  it('calls get_live_stack with p_code', async () => {
    rpc.mockResolvedValue({ data: { title: '', courts: 1, snapshot: null, version: 0, ended: false, expires_at: '2026-11-20T08:00:00+00:00', venue: null }, error: null })
    await getLiveStack('code-1')
    expect(rpc).toHaveBeenCalledWith('get_live_stack', { p_code: 'code-1' })
  })

  it('returns null for hint not_found (unknown or expired code)', async () => {
    rpc.mockResolvedValue(pgError('not_found'))
    await expect(getLiveStack('gone')).resolves.toBeNull()
  })

  it('maps a venue stack with a snapshot to the view', async () => {
    const snap = snapshot()
    rpc.mockResolvedValue({
      data: {
        title: 'Tuesday Open Play',
        courts: 2,
        snapshot: JSON.parse(JSON.stringify(snap)),
        version: 7,
        ended: false,
        expires_at: '2026-11-20T08:00:00+00:00',
        venue: { name: 'Acme Courts', slug: 'acme-courts', logo_path: 'v1/logo.png' },
      },
      error: null,
    })
    await expect(getLiveStack('code-1')).resolves.toEqual({
      title: 'Tuesday Open Play',
      courts: 2,
      snapshot: snap,
      version: 7,
      ended: false,
      expiresAt: '2026-11-20T08:00:00+00:00',
      venue: { name: 'Acme Courts', slug: 'acme-courts', logoPath: 'v1/logo.png' },
    })
  })

  it('maps a plotline.fit stack before its first publish: snapshot null, venue null', async () => {
    rpc.mockResolvedValue({
      data: { title: '', courts: 4, snapshot: null, version: 0, ended: false, expires_at: '2026-11-20T00:30:00+00:00', venue: null },
      error: null,
    })
    await expect(getLiveStack('code-2')).resolves.toEqual({
      title: '',
      courts: 4,
      snapshot: null,
      version: 0,
      ended: false,
      expiresAt: '2026-11-20T00:30:00+00:00',
      venue: null,
    })
  })

  it('keeps a venue with no logo as logoPath null, and an ended stack as ended', async () => {
    rpc.mockResolvedValue({
      data: {
        title: 'Final',
        courts: 1,
        snapshot: null,
        version: 3,
        ended: true,
        expires_at: '2026-11-21T15:59:00+00:00',
        venue: { name: 'Acme Courts', slug: 'acme-courts', logo_path: null },
      },
      error: null,
    })
    const view = await getLiveStack('code-3')
    expect(view?.ended).toBe(true)
    expect(view?.venue).toEqual({ name: 'Acme Courts', slug: 'acme-courts', logoPath: null })
  })

  it('throws invalid_snapshot when the stored snapshot fails the reader', async () => {
    rpc.mockResolvedValue({
      data: { title: '', courts: 2, snapshot: { v: 2 }, version: 1, ended: false, expires_at: '2026-11-20T08:00:00+00:00', venue: null },
      error: null,
    })
    await expectLiveError(getLiveStack('code-4'), 'invalid_snapshot')
  })

  it('throws invalid_snapshot for a v: 1 snapshot with a bad shape', async () => {
    const bad = { ...JSON.parse(JSON.stringify(snapshot())), courts: 0 }
    rpc.mockResolvedValue({
      data: { title: '', courts: 2, snapshot: bad, version: 1, ended: false, expires_at: '2026-11-20T08:00:00+00:00', venue: null },
      error: null,
    })
    await expectLiveError(getLiveStack('code-5'), 'invalid_snapshot')
  })

  it('maps any other PostgREST error to unknown instead of returning null', async () => {
    rpc.mockResolvedValue(pgError(''))
    await expectLiveError(getLiveStack('code-6'), 'unknown')
  })
})

// ---------- publishLiveStack ----------

describe('publishLiveStack (T6.1)', () => {
  it('calls publish_live_stack with p_code, p_secret, p_version, p_snapshot and p_end, and returns version and expiresAt', async () => {
    const snap = snapshot()
    rpc.mockResolvedValue({ data: { version: 5, expires_at: '2026-11-20T09:15:00+00:00' }, error: null })
    const result = await publishLiveStack({ code: 'code-1', secret: 'sec-1', version: 5, snapshot: snap, end: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('publish_live_stack', {
      p_code: 'code-1',
      p_secret: 'sec-1',
      p_version: 5,
      p_snapshot: snap,
      p_end: true,
    })
    expect(result).toEqual({ version: 5, expiresAt: '2026-11-20T09:15:00+00:00' })
  })

  it('does not end the stack when end is left out', async () => {
    rpc.mockResolvedValue({ data: { version: 2, expires_at: '2026-11-20T09:15:00+00:00' }, error: null })
    await publishLiveStack({ code: 'code-1', secret: 'sec-1', version: 2, snapshot: snapshot() })
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>]
    expect(name).toBe('publish_live_stack')
    expect(args).toMatchObject({ p_code: 'code-1', p_secret: 'sec-1', p_version: 2 })
    expect(args.p_end ?? false).toBe(false)
  })

  it.each<LiveErrorCode>(['not_found', 'forbidden', 'ended', 'stale_version', 'too_fast', 'too_large', 'invalid_snapshot', 'limit_reached'])(
    'maps hint %s to a LiveError with that code',
    async (hint) => {
      rpc.mockResolvedValue(pgError(hint))
      await expectLiveError(publishLiveStack({ code: 'c', secret: 's', version: 2, snapshot: snapshot() }), hint)
    },
  )

  it('maps a hint it does not know to unknown', async () => {
    rpc.mockResolvedValue(pgError('something_new'))
    await expectLiveError(publishLiveStack({ code: 'c', secret: 's', version: 2, snapshot: snapshot() }), 'unknown')
  })

  it('maps a rejected call (no PostgREST error) to unknown', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'))
    await expectLiveError(publishLiveStack({ code: 'c', secret: 's', version: 2, snapshot: snapshot() }), 'unknown')
  })
})
