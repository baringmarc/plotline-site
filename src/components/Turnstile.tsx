import { useEffect, useRef } from 'react'
import { loadTurnstile, type TurnstileApi } from '../lib/turnstile'

type Props = {
  siteKey: string
  /** The token when the check passes, and '' when it expires or fails. */
  onToken: (token: string) => void
  /** Change it to get a fresh token: each token works once, so the form bumps it after a failed send. */
  resetSignal: number
  /** Cloudflare's script couldn't load (offline, blocked by an ad blocker), so there is no check to complete. */
  onLoadError: () => void
}

/** Cloudflare's human check, following the page's light or dark theme and the form's width. */
export function Turnstile({ siteKey, onToken, resetSignal, onLoadError }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null)
  // The latest callback, so the widget isn't rebuilt when the form re-renders.
  const tokenRef = useRef(onToken)
  const loadErrorRef = useRef(onLoadError)
  useEffect(() => {
    tokenRef.current = onToken
    loadErrorRef.current = onLoadError
  })

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !box.current) return
        const id = api.render(box.current, {
          sitekey: siteKey,
          theme: 'auto',
          size: 'flexible',
          callback: (token) => tokenRef.current(token),
          'expired-callback': () => tokenRef.current(''),
          'error-callback': () => tokenRef.current(''),
        })
        widget.current = { api, id }
      })
      .catch(() => {
        if (cancelled) return
        tokenRef.current('')
        loadErrorRef.current()
      })
    return () => {
      cancelled = true
      if (widget.current) widget.current.api.remove(widget.current.id)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetSignal === 0 || !widget.current) return
    widget.current.api.reset(widget.current.id)
    tokenRef.current('')
  }, [resetSignal])

  return <div ref={box} className="turnstile" />
}
