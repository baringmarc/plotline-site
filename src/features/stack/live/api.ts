/**
 * Live stacks' API (court-booking-system docs/PLATFORM.md §4 "Live stacks"): the `stack-live` function and the
 * RPCs, called with the publishable key only. A failure becomes a `LiveError` with a stable code; the words the
 * organizer sees come with the screens.
 */
import type { Json } from '../../../lib/database.types'
import { callFunction } from '../../../lib/functions'
import { supabase } from '../../../lib/supabase'
import { readSnapshot, type LiveSnapshot } from './snapshot'

export const LIVE_ERROR_CODES = [
  'invalid_input',
  'bot_check_failed',
  'busy',
  'unavailable',
  'server_error',
  'not_found',
  'forbidden',
  'ended',
  'stale_version',
  'too_fast',
  'too_large',
  'invalid_snapshot',
  'limit_reached',
  'unknown',
] as const

export type LiveErrorCode = (typeof LIVE_ERROR_CODES)[number]

export class LiveError extends Error {
  readonly code: LiveErrorCode
  constructor(code: LiveErrorCode) {
    super(code)
    this.name = 'LiveError'
    this.code = code
  }
}

const isLiveErrorCode = (v: unknown): v is LiveErrorCode => LIVE_ERROR_CODES.includes(v as LiveErrorCode)

/** A PostgREST error maps by its hint, a callFunction error by its message; anything else is `unknown`. */
function toLiveError(err: unknown): LiveError {
  const hint = typeof err === 'object' && err !== null && 'hint' in err ? err.hint : undefined
  const message = err instanceof Error ? err.message : undefined
  return new LiveError([hint, message].find(isLiveErrorCode) ?? 'unknown')
}

/** Runs one RPC; a rejected call or a PostgREST error becomes a LiveError. */
async function run(call: () => PromiseLike<{ data: Json; error: unknown }>): Promise<Json> {
  let reply: { data: Json; error: unknown }
  try {
    reply = await call()
  } catch (err) {
    throw toLiveError(err)
  }
  if (reply.error) throw toLiveError(reply.error)
  return reply.data
}

type JsonObject = Record<string, Json | undefined>
const isJsonObject = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------- going live (the organizer, no sign-in) ----------

export type GoLiveInput = { turnstileToken: string; courts: number; title: string }
export type LiveKey = { code: string; secret: string }

/** Creates a live stack through `stack-live`. Each call needs a fresh Turnstile token. */
export async function goLive(input: GoLiveInput): Promise<LiveKey> {
  try {
    const reply = await callFunction<{ ok: true; code: string; secret: string }>('stack-live', {
      turnstileToken: input.turnstileToken,
      courts: input.courts,
      title: input.title,
    })
    return { code: reply.code, secret: reply.secret }
  } catch (err) {
    throw toLiveError(err)
  }
}

// ---------- reading (anyone with the link) ----------

export type LiveVenue = { name: string; slug: string; logoPath: string | null }

export type LiveStackView = {
  title: string
  courts: number
  snapshot: LiveSnapshot | null
  version: number
  ended: boolean
  expiresAt: string
  venue: LiveVenue | null
}

function venueOf(v: Json | undefined): LiveVenue | null {
  if (v === null || v === undefined) return null
  if (!isJsonObject(v) || typeof v.name !== 'string' || typeof v.slug !== 'string') throw new LiveError('unknown')
  const logo = v.logo_path ?? null
  if (logo !== null && typeof logo !== 'string') throw new LiveError('unknown')
  return { name: v.name, slug: v.slug, logoPath: logo }
}

function viewOf(data: Json): LiveStackView {
  if (
    !isJsonObject(data) ||
    // An untitled stack reads back as `title: null` (checked on the local stack, 2026-11-19).
    (typeof data.title !== 'string' && data.title !== null) ||
    typeof data.courts !== 'number' ||
    typeof data.version !== 'number' ||
    typeof data.ended !== 'boolean' ||
    typeof data.expires_at !== 'string'
  ) {
    throw new LiveError('unknown')
  }
  const snapshot = data.snapshot === null ? null : readSnapshot(data.snapshot)
  if (data.snapshot !== null && snapshot === null) throw new LiveError('invalid_snapshot')
  return {
    title: data.title ?? '',
    courts: data.courts,
    snapshot,
    version: data.version,
    ended: data.ended,
    expiresAt: data.expires_at,
    venue: venueOf(data.venue),
  }
}

/** Reads a live stack by its code. Null for an unknown or expired code. */
export async function getLiveStack(code: string): Promise<LiveStackView | null> {
  let data: Json
  try {
    data = await run(() => supabase.rpc('get_live_stack', { p_code: code }))
  } catch (err) {
    if (err instanceof LiveError && err.code === 'not_found') return null
    throw err
  }
  return viewOf(data)
}

// ---------- following (anyone with the link: the public Realtime channel) ----------

export type ChannelStatus = 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'
export type LiveBroadcast = { version: number; snapshot: LiveSnapshot | null; ended: boolean }
export type LiveHandlers = { onSnapshot(msg: LiveBroadcast): void; onStatus(status: ChannelStatus): void }

const CHANNEL_STATUSES: readonly ChannelStatus[] = ['SUBSCRIBED', 'CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT']

/** A broadcast's payload as `{ version, snapshot, ended }` (its extra `id` dropped), or null when it isn't a valid one. */
function broadcastOf(payload: unknown): LiveBroadcast | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { version, snapshot: raw, ended } = payload as Record<string, unknown>
  if (typeof version !== 'number' || typeof ended !== 'boolean') return null
  const snapshot = raw === null || raw === undefined ? null : readSnapshot(raw)
  if (raw !== null && raw !== undefined && snapshot === null) return null
  return { version, snapshot, ended }
}

/**
 * Joins the public channel `live-stack:<code>` and hands each `snapshot` broadcast and channel status on.
 * The returned function leaves the channel; after it, nothing more is reported.
 */
export function subscribeLiveStack(code: string, handlers: LiveHandlers): () => void {
  let open = true
  const channel = supabase
    .channel(`live-stack:${code}`)
    .on('broadcast', { event: 'snapshot' }, (msg: { payload?: unknown }) => {
      if (!open) return
      const next = broadcastOf(msg.payload)
      if (next) handlers.onSnapshot(next)
    })
    .subscribe((status: string) => {
      if (open && CHANNEL_STATUSES.includes(status as ChannelStatus)) handlers.onStatus(status as ChannelStatus)
    })
  return () => {
    if (!open) return
    open = false
    void supabase.removeChannel(channel)
  }
}

// ---------- publishing (the organizer's device, with its secret) ----------

export type PublishInput = { code: string; secret: string; version: number; snapshot: LiveSnapshot; end?: boolean }
export type PublishReply = { version: number; expiresAt: string }

/** Stores a snapshot and broadcasts it. `version` must rise on every publish; `end` marks the stack ended. */
export async function publishLiveStack(input: PublishInput): Promise<PublishReply> {
  const data = await run(() =>
    supabase.rpc('publish_live_stack', {
      p_code: input.code,
      p_secret: input.secret,
      p_version: input.version,
      p_snapshot: input.snapshot,
      p_end: input.end ?? false,
    }),
  )
  if (!isJsonObject(data) || typeof data.version !== 'number' || typeof data.expires_at !== 'string') {
    throw new LiveError('unknown')
  }
  return { version: data.version, expiresAt: data.expires_at }
}
