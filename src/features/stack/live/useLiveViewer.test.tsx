// T6.4 Player view: the hook (TASKS.md T6.4). Plan name: `useLiveViewer(code): ViewerState` in
// src/features/stack/live/useLiveViewer.ts, a React wrapper around createLiveViewer (src/features/stack/live/viewer.ts)
// with its defaults (getLiveStack, subscribeLiveStack). The API is mocked; the viewer is the real one.
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts } from '../engine'
import type { LiveStackView } from './api'
import { buildSnapshot, type LiveSnapshot } from './snapshot'
import { useLiveViewer } from './useLiveViewer'

const getLiveStack = vi.fn()
const subscribeLiveStack = vi.fn()

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    subscribeLiveStack: (...a: unknown[]) => subscribeLiveStack(...a),
    publishLiveStack: vi.fn(),
    goLive: vi.fn(),
  }
})

type Handlers = {
  onSnapshot(msg: { version: number; snapshot: LiveSnapshot | null; ended: boolean }): void
  onStatus(status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'): void
}

const snap = (title = 'Tuesday') =>
  buildSnapshot(fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, title }), ['Ana', 'Ben', 'Cy', 'Dee'])))

const view = (version: number, over: Partial<LiveStackView> = {}): LiveStackView => ({
  title: 'Tuesday',
  courts: 1,
  snapshot: snap(),
  version,
  ended: false,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  venue: null,
  ...over,
})

let handlers: Handlers[] = []
const leaves: ReturnType<typeof vi.fn>[] = []

beforeEach(() => {
  handlers = []
  leaves.length = 0
  getLiveStack.mockReset()
  subscribeLiveStack.mockReset()
  subscribeLiveStack.mockImplementation((_code: string, h: Handlers) => {
    handlers.push(h)
    const leave = vi.fn()
    leaves.push(leave)
    return leave
  })
})

describe('useLiveViewer (T6.4)', () => {
  it('is loading first, then ready with the stack', async () => {
    getLiveStack.mockResolvedValue(view(2))
    const { result, unmount } = renderHook(() => useLiveViewer('CODE1'))
    expect(result.current).toEqual({ kind: 'loading' })
    await waitFor(() => expect(result.current.kind).toBe('ready'))
    expect(getLiveStack).toHaveBeenCalledWith('CODE1')
    expect(subscribeLiveStack.mock.calls[0][0]).toBe('CODE1')
    unmount()
  })

  it('is not_found for an unknown or expired code', async () => {
    getLiveStack.mockResolvedValue(null)
    const { result, unmount } = renderHook(() => useLiveViewer('GONE'))
    await waitFor(() => expect(result.current).toEqual({ kind: 'not_found' }))
    unmount()
  })

  it('follows a broadcast', async () => {
    getLiveStack.mockResolvedValue(view(2))
    const { result, unmount } = renderHook(() => useLiveViewer('CODE1'))
    await waitFor(() => expect(result.current.kind).toBe('ready'))
    act(() => {
      handlers[0].onStatus('SUBSCRIBED')
      handlers[0].onSnapshot({ version: 3, snapshot: snap('Round two'), ended: false })
    })
    await waitFor(() => {
      const s = result.current
      expect(s.kind === 'ready' && s.view.version).toBe(3)
    })
    const s = result.current
    if (s.kind !== 'ready') throw new Error('expected ready')
    expect(s.view.snapshot?.title).toBe('Round two')
    expect(s.mode).toBe('live')
    unmount()
  })

  it('leaves the channel on unmount', async () => {
    getLiveStack.mockResolvedValue(view(2))
    const { result, unmount } = renderHook(() => useLiveViewer('CODE1'))
    await waitFor(() => expect(result.current.kind).toBe('ready'))
    unmount()
    expect(leaves.length).toBeGreaterThanOrEqual(1)
    for (const leave of leaves) expect(leave).toHaveBeenCalled()
  })

  it('a new code leaves the old channel and reads the new stack', async () => {
    getLiveStack.mockImplementation(async (code: string) => (code === 'A' ? view(1, { title: 'A' }) : view(1, { title: 'B' })))
    const { result, rerender, unmount } = renderHook(({ code }) => useLiveViewer(code), { initialProps: { code: 'A' } })
    await waitFor(() => expect(result.current.kind === 'ready' && result.current.view.title).toBe('A'))
    const firstLeave = leaves[leaves.length - 1]
    rerender({ code: 'B' })
    await waitFor(() => expect(result.current.kind === 'ready' && result.current.view.title).toBe('B'))
    expect(firstLeave).toHaveBeenCalled()
    expect(getLiveStack).toHaveBeenCalledWith('B')
    expect(subscribeLiveStack.mock.calls.some((c) => c[0] === 'B')).toBe(true)
    unmount()
  })
})
