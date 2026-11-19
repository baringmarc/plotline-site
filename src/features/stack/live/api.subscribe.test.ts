// T6.4 Player view: the viewer's channel (TASKS.md T6.4; court-booking-system docs/PLATFORM.md §4 "Live stacks",
// "Realtime": a publish broadcasts `{ version, snapshot, ended }` with event `snapshot` on the public channel
// `live-stack:<code>`; viewers use `supabase.channel('live-stack:' + code)` and `.on('broadcast', { event: 'snapshot' }, …)`;
// the payload arrives with an extra `id`, which clients ignore).
// Plan name: `subscribeLiveStack(code, { onSnapshot, onStatus }): () => void` in src/features/stack/live/api.ts.
// The snapshot is checked with readSnapshot like a read: a broadcast that isn't a valid one is dropped.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayers, createSession, fillCourts } from '../engine'
import { subscribeLiveStack } from './api'
import { buildSnapshot } from './snapshot'

type BroadcastHandler = (msg: { type: 'broadcast'; event: string; payload: unknown }) => void
type StatusHandler = (status: string, err?: Error) => void

/** A stand-in for a supabase-js RealtimeChannel: records `on` and `subscribe`. */
function fakeChannel() {
  const ch = {
    ons: [] as { type: string; filter: unknown; cb: BroadcastHandler }[],
    statusCb: null as StatusHandler | null,
    on: vi.fn((type: string, filter: unknown, cb: BroadcastHandler) => {
      ch.ons.push({ type, filter, cb })
      return ch
    }),
    subscribe: vi.fn((cb?: StatusHandler) => {
      ch.statusCb = cb ?? null
      return ch
    }),
    unsubscribe: vi.fn(async () => 'ok'),
    /** Delivers a broadcast the way supabase-js does. */
    broadcast(payload: unknown, event = 'snapshot') {
      for (const o of ch.ons) {
        if (o.type === 'broadcast' && (o.filter as { event?: string }).event === event) o.cb({ type: 'broadcast', event, payload })
      }
    },
    status(s: string) {
      ch.statusCb?.(s)
    },
  }
  return ch
}

let channel = fakeChannel()
const channelFn = vi.fn()
const removeChannel = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: (...a: unknown[]) => channelFn(...a),
    removeChannel: (...a: unknown[]) => removeChannel(...a),
    rpc: vi.fn(),
  },
}))

function snapshot() {
  const s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, title: 'Tuesday' }), ['Ana', 'Ben', 'Cy', 'Dee', 'Eli']))
  return buildSnapshot(s)
}

function setup(code = 'AbC_123-x') {
  const onSnapshot = vi.fn()
  const onStatus = vi.fn()
  const leave = subscribeLiveStack(code, { onSnapshot, onStatus })
  return { onSnapshot, onStatus, leave }
}

beforeEach(() => {
  channel = fakeChannel()
  channelFn.mockReset()
  channelFn.mockImplementation(() => channel)
  removeChannel.mockReset()
  removeChannel.mockResolvedValue('ok')
})

describe('subscribeLiveStack (T6.4)', () => {
  it('joins the public channel live-stack:<code>', () => {
    setup('AbC_123-x')
    expect(channelFn).toHaveBeenCalledTimes(1)
    expect(channelFn.mock.calls[0][0]).toBe('live-stack:AbC_123-x')
    // A public channel: no `private: true` in the options, if any are given.
    const opts = channelFn.mock.calls[0][1] as { config?: { private?: boolean } } | undefined
    expect(opts?.config?.private ?? false).toBe(false)
  })

  it('listens for the broadcast event "snapshot" and subscribes', () => {
    setup()
    expect(channel.ons.some((o) => o.type === 'broadcast' && (o.filter as { event?: string }).event === 'snapshot')).toBe(true)
    expect(channel.subscribe).toHaveBeenCalledTimes(1)
  })

  it('hands a broadcast to onSnapshot as { version, snapshot, ended }, dropping the extra id', () => {
    const { onSnapshot } = setup()
    const snap = snapshot()
    channel.broadcast({ version: 3, snapshot: JSON.parse(JSON.stringify(snap)), ended: false, id: 'msg-uuid-1' })
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    expect(onSnapshot).toHaveBeenCalledWith({ version: 3, snapshot: snap, ended: false })
  })

  it('passes ended: true through (the final board)', () => {
    const { onSnapshot } = setup()
    const snap = snapshot()
    channel.broadcast({ version: 9, snapshot: JSON.parse(JSON.stringify(snap)), ended: true, id: 'x' })
    expect(onSnapshot).toHaveBeenCalledWith({ version: 9, snapshot: snap, ended: true })
  })

  it('drops a broadcast whose snapshot is not a valid one (unknown v, bad shape)', () => {
    const { onSnapshot } = setup()
    channel.broadcast({ version: 4, snapshot: { v: 2 }, ended: false, id: 'x' })
    channel.broadcast({ version: 5, snapshot: { ...JSON.parse(JSON.stringify(snapshot())), players: 'nope' }, ended: false, id: 'y' })
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('drops a broadcast without a numeric version or a boolean ended', () => {
    const { onSnapshot } = setup()
    const snap = JSON.parse(JSON.stringify(snapshot()))
    channel.broadcast({ version: '6', snapshot: snap, ended: false })
    channel.broadcast({ snapshot: snap, ended: false })
    channel.broadcast({ version: 7, snapshot: snap, ended: 'no' })
    channel.broadcast(null)
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('ignores other broadcast events on the channel', () => {
    const { onSnapshot } = setup()
    channel.broadcast({ version: 3, snapshot: JSON.parse(JSON.stringify(snapshot())), ended: false }, 'something-else')
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it.each(['SUBSCRIBED', 'CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'] as const)('reports the channel status %s to onStatus', (s) => {
    const { onStatus } = setup()
    channel.status(s)
    expect(onStatus).toHaveBeenCalledWith(s)
  })

  it('the returned function leaves the channel', () => {
    const { leave } = setup()
    expect(typeof leave).toBe('function')
    leave()
    const removed = removeChannel.mock.calls.some((c) => c[0] === channel)
    expect(removed || channel.unsubscribe.mock.calls.length > 0).toBe(true)
  })

  it('after leaving, a late broadcast or status reaches nobody', () => {
    const { leave, onSnapshot, onStatus } = setup()
    leave()
    onStatus.mockClear()
    channel.broadcast({ version: 3, snapshot: JSON.parse(JSON.stringify(snapshot())), ended: false })
    channel.status('CHANNEL_ERROR')
    expect(onSnapshot).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()
  })
})
