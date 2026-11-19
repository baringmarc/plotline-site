/**
 * Publishes the organizer's board to its live stack (court-booking-system docs/PLATFORM.md §4 "Live stacks"):
 * at most one snapshot every 2 s, with the latest board, and the server's answers handled as the contract says.
 * Stops for good on the reasons that end publishing (ended, forbidden, not_found, limit_reached, too_large,
 * invalid_snapshot); a network failure shows Reconnecting and retries every 5 s.
 */
import type { Session } from '../types'
import { getLiveStack, LiveError, publishLiveStack, type LiveErrorCode } from './api'
import type { LiveKey } from './liveKey'
import { buildSnapshot, snapshotFits } from './snapshot'

export const MIN_PUBLISH_GAP_MS = 2000
export const RETRY_AFTER_NETWORK_MS = 5000

export type LiveStatus = { state: 'live' } | { state: 'reconnecting' } | { state: 'stopped'; reason: LiveErrorCode }

export interface LivePublisher {
  /** A change on the board. Changes inside the gap collapse into one publish of the latest. */
  submit(session: Session): void
  /** The final board: published with `end: true`, then publishing stops. */
  end(session: Session): void
  /** Stops without publishing anything more. */
  stop(): void
}

type Options = {
  key: LiveKey
  onStatus: (status: LiveStatus) => void
  /** The version the server last confirmed, so the next publish continues from it. */
  onVersion: (version: number) => void
}

/** Answers that end publishing for good. */
const STOP_REASONS: readonly LiveErrorCode[] = ['ended', 'forbidden', 'not_found', 'limit_reached', 'too_large', 'invalid_snapshot']

type Item = { session: Session; end: boolean }

export function createLivePublisher({ key, onStatus, onVersion }: Options): LivePublisher {
  let version = key.version
  let pending: Item | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let stopped = false
  let lastPublishAt: number | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  /** Waits for the gap since the last publish (or `delay`), then sends whatever is pending. */
  const schedule = (delay?: number) => {
    if (stopped || timer !== null || inFlight || pending === null) return
    const wait = delay ?? (lastPublishAt === null ? 0 : Math.max(0, lastPublishAt + MIN_PUBLISH_GAP_MS - Date.now()))
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, wait)
  }

  const finish = (reason: LiveErrorCode) => {
    stopped = true
    pending = null
    clearTimer()
    onStatus({ state: 'stopped', reason })
  }

  /** The server's version is the one to continue from: re-read it (stale_version). */
  const resync = async () => {
    try {
      const view = await getLiveStack(key.code)
      if (stopped) return
      if (view === null) {
        finish('not_found')
        return
      }
      version = view.version
      lastPublishAt = Date.now()
      schedule()
    } catch {
      if (stopped) return
      onStatus({ state: 'reconnecting' })
      schedule(RETRY_AFTER_NETWORK_MS)
    }
  }

  async function flush(): Promise<void> {
    if (stopped || inFlight || pending === null) return
    const item = pending
    pending = null
    const snapshot = buildSnapshot(item.session)
    if (!snapshotFits(snapshot)) {
      finish('too_large')
      return
    }
    inFlight = true
    try {
      const reply = await publishLiveStack({
        code: key.code,
        secret: key.secret,
        version: version + 1,
        snapshot,
        end: item.end,
      })
      inFlight = false
      // Stopped while the reply was on its way (Start over, leaving the page): the stack is no longer ours to update.
      if (stopped) return
      version = reply.version
      onVersion(version)
      lastPublishAt = Date.now()
      if (item.end) {
        finish('ended')
        return
      }
      onStatus({ state: 'live' })
      schedule()
    } catch (err) {
      inFlight = false
      if (stopped) return
      const code: LiveErrorCode = err instanceof LiveError ? err.code : 'unknown'
      if (code === 'too_fast') {
        // Too soon after the last publish: keep the latest board and retry after the gap, same version.
        pending = pending ?? item
        lastPublishAt = Date.now()
        schedule()
      } else if (code === 'stale_version') {
        pending = pending ?? item
        await resync()
      } else if (STOP_REASONS.includes(code)) {
        finish(code)
      } else {
        // Network trouble (or a call that failed for another reason): keep the board, show Reconnecting, retry.
        pending = pending ?? item
        onStatus({ state: 'reconnecting' })
        schedule(RETRY_AFTER_NETWORK_MS)
      }
    }
  }

  return {
    submit(session) {
      // Nothing more after a queued end: the final board is the last one.
      if (stopped || pending?.end) return
      pending = { session, end: false }
      schedule()
    },
    end(session) {
      if (stopped) return
      pending = { session, end: true }
      schedule()
    },
    stop() {
      stopped = true
      pending = null
      clearTimer()
    },
  }
}
