/**
 * The share card preview (T8.7): pick story or post, a built-in background or your own photo (with a darkness
 * slider), see the card, then share it as a file or download it. Everything is drawn on this device.
 * The player card can be arranged in the preview (T8.7b): pick it, drag it, size it, remove parts, pick a look and
 * the panel's opacity; the layout is saved on this device per size. The logo and the link inside it stay (T8.7c).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { paddleStack } from '../../../config/paddleStack'
import { shareOrDownload } from '../shareImage'
import type { Session } from '../types'
import { BACKGROUNDS, DEFAULT_DARKNESS, loadPhoto, releasePhoto, type CardBackground } from './backgrounds'
import { isInAppBrowser } from './inApp'
import { CARD_SIZES, groupCardData, playerCardData, type CardSize } from './cardData'
import { drawGroupCard, drawPlayerCard } from './drawCard'
import {
  CARD_ITEMS,
  CARD_LOOKS,
  CARD_PARTS,
  MAX_SCALE,
  MIN_SCALE,
  clearCardLayout,
  defaultLayout,
  itemRects,
  loadCardLayout,
  moveItem,
  removePart,
  resizeItem,
  restorePart,
  saveCardLayout,
  setLook,
  setOpacity,
  type CardItemId,
  type CardLayout,
  type CardPartId,
} from './layout'

const { share } = paddleStack
const L = share.layout
const PHOTO = 'photo'
/** ms to wait after a change before redrawing. */
const REDRAW_DELAY = 120
/** Card pixels an arrow key moves the picked item (four times that with Shift). */
const KEY_STEP = 10
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** What a card is drawn from. */
interface Choices {
  session: Session
  playerId?: string
  size: CardSize
  choice: string
  photo: CanvasImageSource | null
  darkness: number
  /** The player card's layout (the group card has none). */
  layout?: CardLayout
}

const sameChoices = (a: Choices, b: Choices) =>
  a.session === b.session &&
  a.playerId === b.playerId &&
  a.size === b.size &&
  a.choice === b.choice &&
  a.photo === b.photo &&
  a.darkness === b.darkness &&
  a.layout === b.layout

/** Draws the player's card (with `playerId`) or the group card, dated now. */
function drawFor({ session, playerId, size, choice, photo, darkness, layout }: Choices): Promise<Blob> {
  const background: CardBackground = choice === PHOTO && photo ? { kind: 'photo', image: photo } : { kind: 'builtin', id: choice }
  const date = new Date()
  if (playerId) {
    const data = playerCardData(session, playerId, { date })
    if (!data) return Promise.reject(new Error('No such player'))
    return drawPlayerCard(data, { size, background, darkness, layout: layout ?? defaultLayout(size) })
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
  // The player card's layout for the picked size, and the item picked in the preview.
  const [layout, setLayout] = useState<CardLayout>(() => loadCardLayout('story'))
  const [picked, setPicked] = useState<CardItemId | null>(null)
  const drag = useRef<{ id: CardItemId; pointerId: number; x: number; y: number; from: CardLayout; k: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Read once: whether this is an in-app browser, and whether it's a touch screen.
  const [inApp] = useState(() => typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent ?? ''))
  const [touch] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
  const player = playerId ? session.players.find((p) => p.id === playerId) : undefined
  const arranging = Boolean(player)
  const cardLayout = arranging ? layout : undefined
  const choices: Choices = { session, playerId, size, choice, photo, darkness, layout: cardLayout }
  const hasTitle = session.title.trim() !== ''
  const rects: Partial<ReturnType<typeof itemRects>> = arranging ? itemRects(layout, size, { hasTitle }) : {}
  const sel = picked && rects[picked] ? picked : null

  // Redraw the preview whenever the card, size, background, darkness or layout changes; a stale draw is dropped.
  useEffect(() => {
    let live = true
    const key: Choices = { session, playerId, size, choice, photo, darkness, layout: cardLayout }
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
  }, [session, playerId, size, choice, photo, darkness, cardLayout])

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

  /** A layout change: shown at once and saved for this size (if storage fails it still works for the visit). */
  const commit = (next: CardLayout) => {
    setLayout(next)
    saveCardLayout(size, next)
  }

  const pickSize = (s: CardSize) => {
    setSize(s)
    setLayout(loadCardLayout(s))
    setPicked(null)
  }

  const resetLayout = () => {
    clearCardLayout(size)
    setLayout(defaultLayout(size))
    setPicked(null)
  }

  // Dragging an item (mouse, pen or finger): the move is measured from where the drag started, in card pixels.
  const onPointerDown = (id: CardItemId, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    setPicked(id)
    const box = overlayRef.current?.getBoundingClientRect()
    const k = box && box.width > 0 ? CARD_SIZES[size].width / box.width : 1
    drag.current = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, from: layout, k }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const dragTo = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return null
    const dx = (e.clientX - d.x) * d.k
    const dy = (e.clientY - d.y) * d.k
    return dx === 0 && dy === 0 ? null : moveItem(d.from, size, d.id, dx, dy)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const next = dragTo(e)
    if (next) setLayout(next)
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const next = dragTo(e)
    if (next) commit(next)
    drag.current = null
  }
  const onPointerCancel = () => {
    if (drag.current) commit(layout)
    drag.current = null
  }

  const onItemKey = (id: CardItemId, e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const dir = ARROWS[e.key]
    if (!dir) return
    e.preventDefault()
    const step = KEY_STEP * (e.shiftKey ? 4 : 1)
    setPicked(id)
    commit(moveItem(layout, size, id, dir[0] * step, dir[1] * step))
  }

  const pct = (n: number, of: number) => `${(n / of) * 100}%`
  const { width: CW, height: CH } = CARD_SIZES[size]
  // A session without a title has no title line to remove or bring back.
  const parts = CARD_PARTS.filter((p) => p !== 'title' || hasTitle)
  const removedParts = parts.filter((p) => layout.removedParts.includes(p))
  const partsLeft = parts.filter((p) => !layout.removedParts.includes(p))

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
          {url ? (
            <div className="stack-card-frame">
              <img src={url} alt={share.previewAlt} />
              {arranging && (
                <div ref={overlayRef} className="stack-card-overlay">
                  {CARD_ITEMS.map((id) => {
                    const r = rects[id]
                    if (!r) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        className="stack-card-item"
                        aria-label={L.select(L.items[id])}
                        aria-pressed={sel === id}
                        style={{ left: pct(r.x, CW), top: pct(r.y, CH), width: pct(r.w, CW), height: pct(r.h, CH) }}
                        onClick={() => setPicked(id)}
                        onPointerDown={(e) => onPointerDown(id, e)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                        onKeyDown={(e) => onItemKey(id, e)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="hint">{failed ? null : share.drawing}</p>
          )}
        </div>
        {!inApp && touch && url && <p className="hint stack-card-hint">{share.holdHint}</p>}

        <div className="stack-card-options">
          {arranging && (
            <div className="stack-card-arrange">
              <p className="hint">{L.hint}</p>
              {sel && (
                <label className="stack-card-range">
                  {L.itemSize}
                  <input
                    type="range"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step={0.05}
                    value={layout.items[sel].scale}
                    onChange={(e) => commit(resizeItem(layout, size, sel, Number(e.target.value)))}
                  />
                </label>
              )}
              {sel === 'player' && partsLeft.length > 0 && (
                <div className="stack-card-choices">
                  {partsLeft.map((p: CardPartId) => (
                    <button key={p} type="button" className="stack-chip-btn" aria-label={L.remove(L.parts[p])} onClick={() => commit(removePart(layout, p))}>
                      {L.parts[p]} <span aria-hidden="true">✕</span>
                    </button>
                  ))}
                </div>
              )}
              {removedParts.length > 0 && (
                <div role="group" aria-label={L.removedLabel} className="stack-card-choices">
                  <span className="stack-card-label" aria-hidden="true">
                    {L.removedLabel}
                  </span>
                  {removedParts.map((p) => (
                    <button key={p} type="button" className="stack-chip-btn" aria-label={L.restore(L.parts[p])} onClick={() => commit(restorePart(layout, p, size))}>
                      <span aria-hidden="true">+</span> {L.parts[p]}
                    </button>
                  ))}
                </div>
              )}
              <div role="radiogroup" aria-label={L.lookLabel} className="stack-card-choices">
                <span className="stack-card-label" aria-hidden="true">
                  {L.lookLabel}
                </span>
                {CARD_LOOKS.map((look) => (
                  <label key={look} className="stack-chip-radio">
                    <input type="radio" name={`${titleId}-look`} checked={layout.look === look} onChange={() => commit(setLook(layout, look, size))} />
                    {L.looks[look]}
                  </label>
                ))}
              </div>
              <label className="stack-card-range">
                {L.opacity}
                <input type="range" min={0} max={100} step={5} value={layout.opacity} onChange={(e) => commit(setOpacity(layout, Number(e.target.value)))} />
              </label>
              <div>
                <button type="button" className="btn ghost" onClick={resetLayout}>
                  {L.reset}
                </button>
              </div>
            </div>
          )}

          <div role="radiogroup" aria-label={share.sizeLabel} className="stack-card-choices">
            <span className="stack-card-label" aria-hidden="true">
              {share.sizeLabel}
            </span>
            {(['story', 'post'] as CardSize[]).map((s) => (
              <label key={s} className="stack-chip-radio">
                <input type="radio" name={`${titleId}-size`} checked={size === s} onChange={() => pickSize(s)} />
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
