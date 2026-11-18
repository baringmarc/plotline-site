/**
 * The share card preview (T8.7): pick story or post, a built-in background or your own photo (with a darkness
 * slider), see the card, then share it as a file or download it. Everything is drawn on this device.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { paddleStack } from '../../../config/paddleStack'
import { shareOrDownload } from '../shareImage'
import type { Session } from '../types'
import { BACKGROUNDS, DEFAULT_DARKNESS, loadPhoto, releasePhoto, type CardBackground } from './backgrounds'
import { isInAppBrowser } from './inApp'
import { groupCardData, playerCardData, type CardSize } from './cardData'
import { drawGroupCard, drawPlayerCard } from './drawCard'

const { share } = paddleStack
const PHOTO = 'photo'
/** ms to wait after a change before redrawing. */
const REDRAW_DELAY = 120

/** What a card is drawn from. */
interface Choices {
  session: Session
  playerId?: string
  size: CardSize
  choice: string
  photo: CanvasImageSource | null
  darkness: number
}

const sameChoices = (a: Choices, b: Choices) =>
  a.session === b.session && a.playerId === b.playerId && a.size === b.size && a.choice === b.choice && a.photo === b.photo && a.darkness === b.darkness

/** Draws the player's card (with `playerId`) or the group card, dated now. */
function drawFor({ session, playerId, size, choice, photo, darkness }: Choices): Promise<Blob> {
  const background: CardBackground = choice === PHOTO && photo ? { kind: 'photo', image: photo } : { kind: 'builtin', id: choice }
  const date = new Date()
  if (playerId) {
    const data = playerCardData(session, playerId, { date })
    if (!data) return Promise.reject(new Error('No such player'))
    return drawPlayerCard(data, { size, background, darkness })
  }
  return drawGroupCard(groupCardData(session, { date, size }), { size, background, darkness })
}

export function ShareCardDialog({ session, playerId, onClose }: { session: Session; playerId?: string; onClose: () => void }) {
  const titleId = useId()
  const [size, setSize] = useState<CardSize>('story')
  const [choice, setChoice] = useState<string>(BACKGROUNDS[0].id)
  const [photo, setPhoto] = useState<CanvasImageSource | null>(null)
  const [darkness, setDarkness] = useState(DEFAULT_DARKNESS)
  // The preview's PNG and the choices it was drawn with.
  const [drawn, setDrawn] = useState<{ blob: Blob; key: Choices } | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Read once: whether this is an in-app browser, and whether it's a touch screen.
  const [inApp] = useState(() => typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent ?? ''))
  const [touch] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
  const player = playerId ? session.players.find((p) => p.id === playerId) : undefined
  const choices: Choices = { session, playerId, size, choice, photo, darkness }

  // Redraw the preview whenever the card, size, background or darkness changes; a stale draw is dropped.
  useEffect(() => {
    let live = true
    const key: Choices = { session, playerId, size, choice, photo, darkness }
    // A short wait first: dragging the slider then draws once, not once per step (a PNG this size takes a moment).
    const timer = setTimeout(() => {
      drawFor(key).then(
        (blob) => {
          if (!live) return
          setDrawn({ blob, key })
          setFailed(false)
        },
        () => {
          if (!live) return
          setDrawn(null)
          setFailed(true)
        },
      )
    }, REDRAW_DELAY)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [session, playerId, size, choice, photo, darkness])

  const blob = drawn?.blob ?? null

  // Free the decoded photo when another one replaces it or the dialog closes.
  useEffect(() => () => {
    if (photo) releasePhoto(photo)
  }, [photo])

  // One object URL per drawn card, revoked when it's replaced or the dialog closes.
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  // Focus moves into the dialog and returns to the button that opened it; Escape closes; Tab stays inside.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const image = await loadPhoto(file)
      setPhoto(image)
      setChoice(PHOTO)
    } catch {
      setFailed(true)
    }
  }

  const onShare = async () => {
    if (!drawn) return
    setFailed(false)
    setBusy(true)
    try {
      // The preview's PNG when it matches what's picked (the usual case, so the share sheet opens at once); otherwise draw it now.
      const card = sameChoices(drawn.key, choices) ? drawn.blob : await drawFor(choices)
      await shareOrDownload(card, player ? share.playerFileName(player.name) : share.groupFileName)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack-card-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="stack-card-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{share.dialogTitle}</h2>
        <div className={`stack-card-preview ${size}`}>
          {url ? <img src={url} alt={share.previewAlt} /> : <p className="hint">{failed ? null : share.drawing}</p>}
        </div>
        {!inApp && touch && url && <p className="hint stack-card-hint">{share.holdHint}</p>}

        <div className="stack-card-options">
          <div role="radiogroup" aria-label={share.sizeLabel} className="stack-card-choices">
            <span className="stack-card-label" aria-hidden="true">
              {share.sizeLabel}
            </span>
            {(['story', 'post'] as CardSize[]).map((s) => (
              <label key={s} className="stack-chip-radio">
                <input type="radio" name={`${titleId}-size`} checked={size === s} onChange={() => setSize(s)} />
                {share.sizes[s]}
              </label>
            ))}
          </div>

          <div role="radiogroup" aria-label={share.backgroundLabel} className="stack-card-choices">
            <span className="stack-card-label" aria-hidden="true">
              {share.backgroundLabel}
            </span>
            {BACKGROUNDS.map((b) => (
              <label key={b.id} className="stack-chip-radio">
                <input type="radio" name={`${titleId}-bg`} checked={choice === b.id} onChange={() => setChoice(b.id)} />
                {b.label}
              </label>
            ))}
            {photo && (
              <label className="stack-chip-radio">
                <input type="radio" name={`${titleId}-bg`} checked={choice === PHOTO} onChange={() => setChoice(PHOTO)} />
                {share.photoChoice}
              </label>
            )}
          </div>

          <div className="stack-card-photo">
            <label>
              {share.photoLabel}
              <input type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </label>
            <p className="hint">{share.photoNote}</p>
          </div>

          {choice === PHOTO && photo && (
            <label className="stack-card-darkness">
              {share.darknessLabel}
              <input type="range" min={0} max={100} step={5} value={darkness} onChange={(e) => setDarkness(Number(e.target.value))} />
            </label>
          )}
        </div>

        {failed && (
          <p className="err" role="alert">
            {share.failed}
          </p>
        )}

        {inApp && <p className="stack-card-inapp">{share.inAppNote}</p>}

        <div className="stack-card-actions">
          <button type="button" className="btn main" disabled={!blob || busy} onClick={() => void onShare()}>
            {share.shareButton}
          </button>
          <button ref={closeRef} type="button" className="btn ghost" onClick={onClose}>
            {share.close}
          </button>
        </div>
      </div>
    </div>
  )
}
