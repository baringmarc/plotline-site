// T6.2 review fix (mine): a publish that is still on its way when the publisher stops (Start over, leaving the page)
// must not report back: no version written to storage, no status after the stop.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts } from '../engine'
import type { Session } from '../types'
import { publishLiveStack } from './api'
import { createLivePublisher, type LiveStatus } from './publisher'

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, publishLiveStack: vi.fn(), getLiveStack: vi.fn() }
})

const KEY = { code: 'CODE123', secret: 'SECRET456', version: 0 }

function session(): Session {
  return fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, title: 'One' }), ['Ana', 'Ben', 'Cy', 'Dee']))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(publishLiveStack).mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createLivePublisher: stop while a publish is in flight (T6.2 review)', () => {
  it('a reply that arrives after stop() writes no version and reports no status', async () => {
    let finish: (v: { version: number; expiresAt: string }) => void = () => {}
    vi.mocked(publishLiveStack).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const onStatus = vi.fn<(s: LiveStatus) => void>()
    const onVersion = vi.fn<(v: number) => void>()
    const publisher = createLivePublisher({ key: KEY, onStatus, onVersion })

    publisher.submit(session())
    await vi.advanceTimersByTimeAsync(0)
    publisher.stop()
    finish({ version: 1, expiresAt: '2026-11-20T10:00:00Z' })
    await vi.advanceTimersByTimeAsync(0)

    expect(onVersion).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()
  })

  it('a refused publish that arrives after stop() reports no status', async () => {
    const { LiveError } = await vi.importActual<typeof import('./api')>('./api')
    let fail: (e: unknown) => void = () => {}
    vi.mocked(publishLiveStack).mockReturnValueOnce(new Promise((_, reject) => (fail = reject)))
    const onStatus = vi.fn<(s: LiveStatus) => void>()
    const publisher = createLivePublisher({ key: KEY, onStatus, onVersion: vi.fn() })

    publisher.submit(session())
    await vi.advanceTimersByTimeAsync(0)
    publisher.stop()
    fail(new LiveError('forbidden'))
    await vi.advanceTimersByTimeAsync(0)

    expect(onStatus).not.toHaveBeenCalled()
  })
})
