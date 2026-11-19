/**
 * The player view's state (T6.4; court-booking-system docs/PLATFORM.md §4 "Live stacks", "Viewer fallback"): reads
 * the stack once, follows its channel, and while the channel is down (CLOSED, CHANNEL_ERROR, TIMED_OUT) reads it
 * every 15 s until it reconnects. A snapshot whose version isn't above the one shown is ignored.
 */
import {
  getLiveStack,
  subscribeLiveStack,
  type ChannelStatus,
  type LiveBroadcast,
  type LiveHandlers,
  type LiveStackView,
} from './api'

export const POLL_MS = 15_000

export type ViewerState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'ready'; view: LiveStackView; mode: 'live' | 'polling'; updatedAt: Date }

export interface LiveViewerOptions {
  code: string
  onState(state: ViewerState): void
  read?: (code: string) => Promise<LiveStackView | null>
  subscribe?: (code: string, handlers: LiveHandlers) => () => void
  pollMs?: number
}

export function createLiveViewer({
  code,
  onState,
  read = getLiveStack,
  subscribe = subscribeLiveStack,
  pollMs = POLL_MS,
}: LiveViewerOptions): { stop(): void } {
  let stopped = false
  let view: LiveStackView | null = null
  let updatedAt = new Date()
  let down = false
  let gone = false
  let timer: ReturnType<typeof setInterval> | null = null

  const emit = (state: ViewerState) => {
    if (!stopped) onState(state)
  }
  const show = () => {
    if (view && !gone) emit({ kind: 'ready', view, mode: down ? 'polling' : 'live', updatedAt })
  }
  const stopPolling = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  /** Takes in a newer view; an older or equal version is ignored. */
  const take = (next: LiveStackView) => {
    if (view && next.version <= view.version) return
    view = next
    updatedAt = new Date()
    // An ended stack can't change any more, so polling stops for good.
    if (view.ended) stopPolling()
    show()
  }

  /** A read after the first: a newer board, or the stack gone. A failed read keeps what is shown. */
  const reread = () => {
    read(code).then(
      (next) => {
        if (stopped || gone) return
        if (next === null) {
          gone = true
          stopPolling()
          emit({ kind: 'not_found' })
        } else take(next)
      },
      () => {},
    )
  }

  const onSnapshot = (msg: LiveBroadcast) => {
    if (stopped || gone || !view) return
    take({ ...view, version: msg.version, snapshot: msg.snapshot, ended: msg.ended })
  }

  const onStatus = (status: ChannelStatus) => {
    if (stopped || gone) return
    if (status === 'SUBSCRIBED') {
      const wasDown = down
      down = false
      stopPolling()
      show()
      // Broadcasts sent while the channel was down are lost; one read catches up.
      if (wasDown && view) reread()
      return
    }
    down = true
    if (timer === null && !view?.ended) timer = setInterval(reread, pollMs)
    show()
  }

  emit({ kind: 'loading' })
  const leave = subscribe(code, { onSnapshot, onStatus })
  read(code).then(
    (first) => {
      if (stopped || gone) return
      if (first === null) {
        gone = true
        stopPolling()
        emit({ kind: 'not_found' })
        return
      }
      if (!view || first.version > view.version) {
        view = first
        updatedAt = new Date()
      }
      if (view.ended) stopPolling()
      show()
    },
    () => {
      if (!view) emit({ kind: 'error' })
    },
  )

  return {
    stop() {
      if (stopped) return
      stopped = true
      stopPolling()
      leave()
    },
  }
}
