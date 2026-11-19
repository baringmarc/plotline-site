/**
 * The page's live controller (T6.2): goes live with a Turnstile token, keeps the key and the publisher, and
 * forgets them on Start over. The key loads from this device on mount; nothing is published until the next change.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '../types'
import { goLive as goLiveApi, LiveError, type LiveErrorCode } from './api'
import { clearLiveKey, loadLiveKey, saveLiveKey, type LiveKey } from './liveKey'
import { createLivePublisher, type LivePublisher, type LiveStatus } from './publisher'

export interface LiveController {
  key: LiveKey | null
  status: LiveStatus | null
  /** Why going live failed, as a stable code; null once it works (or nothing failed). */
  error: LiveErrorCode | null
  goLive(turnstileToken: string, session: Session): Promise<void>
  submit(session: Session): void
  end(session: Session): void
  /** Start over: stops publishing and forgets the key on this device. */
  forget(): void
}

export function useLiveStack(): LiveController {
  const [key, setKey] = useState<LiveKey | null>(() => loadLiveKey())
  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [error, setError] = useState<LiveErrorCode | null>(null)
  const keyRef = useRef(key)
  const publisher = useRef<LivePublisher | null>(null)

  // Leaving the page stops publishing; the stack itself stays live until its time runs out.
  useEffect(() => () => publisher.current?.stop(), [])

  const remember = useCallback((next: LiveKey | null) => {
    keyRef.current = next
    setKey(next)
  }, [])

  const start = useCallback(
    (next: LiveKey): LivePublisher => {
      publisher.current?.stop()
      const created = createLivePublisher({
        key: next,
        onStatus: setStatus,
        onVersion: (version) => {
          const updated = { ...next, version }
          saveLiveKey(updated)
          remember(updated)
        },
      })
      publisher.current = created
      return created
    },
    [remember],
  )

  const goLive = useCallback(
    async (turnstileToken: string, session: Session) => {
      setError(null)
      try {
        const made = await goLiveApi({ turnstileToken, courts: session.courts, title: session.title })
        const next: LiveKey = { code: made.code, secret: made.secret, version: 0 }
        saveLiveKey(next)
        remember(next)
        setStatus(null)
        start(next).submit(session)
      } catch (err) {
        setError(err instanceof LiveError ? err.code : 'unknown')
      }
    },
    [remember, start],
  )

  const submit = useCallback(
    (session: Session) => {
      const current = keyRef.current
      if (!current) return
      ;(publisher.current ?? start(current)).submit(session)
    },
    [start],
  )

  const end = useCallback(
    (session: Session) => {
      const current = keyRef.current
      if (!current) return
      ;(publisher.current ?? start(current)).end(session)
    },
    [start],
  )

  const forget = useCallback(() => {
    publisher.current?.stop()
    publisher.current = null
    clearLiveKey()
    remember(null)
    setStatus(null)
    setError(null)
  }, [remember])

  return { key, status, error, goLive, submit, end, forget }
}
