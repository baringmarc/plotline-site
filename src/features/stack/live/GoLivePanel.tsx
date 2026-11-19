/**
 * "Go live" on the board (T6.2): asks for a fresh human check, then shows the players' link and QR with the
 * status line. Copy comes from `paddleStack.live`.
 */
import QrCreator from 'qr-creator'
import { useEffect, useRef, useState } from 'react'
import { Turnstile } from '../../../components/Turnstile'
import { paddleStack } from '../../../config/site'
import { turnstileSiteKey } from '../../../lib/turnstile'
import type { Session } from '../types'
import type { LiveController } from './useLiveStack'

const { live: copy } = paddleStack

export function GoLivePanel({ session, live }: { session: Session; live: LiveController }) {
  if (!live.key) return <StartLive session={session} live={live} />
  // A stack that stopped for a reason other than ending can't be updated any more: Go live again starts a new one.
  const dead = live.status?.state === 'stopped' && live.status.reason !== 'ended'
  return (
    <>
      <LiveShare code={live.key.code} status={live.status} />
      {dead && <StartLive session={session} live={live} />}
    </>
  )
}

function StartLive({ session, live }: { session: Session; live: LiveController }) {
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const errorText = live.error ? (copy.errors[live.error as keyof typeof copy.errors] ?? copy.errors.unknown) : null

  return (
    <section className="stack-live" aria-label={copy.goLive}>
      <p className="hint">{copy.goLiveIntro}</p>
      {!checking && (
        <button
          type="button"
          className="btn dark"
          disabled={sending}
          onClick={() => {
            setCheckFailed(false)
            setChecking(true)
          }}
        >
          {copy.goLive}
        </button>
      )}
      {sending && <p className="hint" role="status">{copy.sending}</p>}
      {checking && (
        <>
          <p className="hint">{copy.checking}</p>
          <Turnstile
            siteKey={turnstileSiteKey}
            resetSignal={0}
            onToken={(token) => {
              setChecking(false)
              if (!token) {
                setCheckFailed(true)
                return
              }
              // One go-live at a time: the button is off until the stack exists or the attempt has failed.
              setSending(true)
              void live.goLive(token, session).finally(() => setSending(false))
            }}
            onLoadError={() => {
              setChecking(false)
              setCheckFailed(true)
            }}
          />
        </>
      )}
      {checkFailed && <p className="hint" role="alert">{copy.checkFailed}</p>}
      {errorText && <p className="hint" role="alert">{errorText}</p>}
    </section>
  )
}

function LiveShare({ code, status }: { code: string; status: LiveController['status'] }) {
  const link = `${window.location.origin}/paddle-stack/live/${code}`
  const canvas = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied('yes')
    } catch {
      // No clipboard here (plain http, an old browser): the link field can still be selected by hand.
      setCopied('no')
    }
  }

  useEffect(() => {
    if (canvas.current) QrCreator.render({ text: link, size: 180, ecLevel: 'M', fill: '#000', background: '#fff' }, canvas.current)
  }, [link])

  const reason = status?.state === 'stopped' ? (copy.stopped as Partial<Record<string, string>>)[status.reason] : undefined
  const label = status?.state === 'live' ? copy.status.live : status?.state === 'reconnecting' ? copy.status.reconnecting : status?.state === 'stopped' ? copy.status.stopped : null

  return (
    <section className="stack-live">
      <label className="stack-live-link">
        <span>{copy.linkLabel}</span>
        <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <canvas ref={canvas} className="stack-live-qr" width={180} height={180} aria-label={copy.qrLabel} />
      <button type="button" className="chipbtn" onClick={() => void copyLink()}>
        {copy.copyLink}
      </button>
      {copied && <p className="hint" role="status">{copied === 'yes' ? copy.copied : copy.copyFailed}</p>}
      {label && (
        <div className="stack-status" role="status" aria-label={copy.status.label}>
          <p>{label}</p>
          {reason && <p className="hint">{reason}</p>}
        </div>
      )}
    </section>
  )
}
