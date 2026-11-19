/**
 * "Share my card" on the player view (T6.5): the player picks their name, then the T8.7 player card is made on
 * their phone from the live board's session. Enabled once a game is scored, like "Share standings".
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { paddleStack } from '../../../config/paddleStack'
import { standings } from '../engine'
import { ShareCardDialog } from '../shareCards/ShareCardDialog'
import type { Session } from '../types'

const copy = paddleStack.viewer.myCard

export function ShareMyCard({ session }: { session: Session }) {
  const selectId = useId()
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState('')
  const [card, setCard] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // The picker is gone by the time the dialog opens, so focus comes back to "Share my card" once it closes.
  const refocus = useRef(false)
  const close = useCallback(() => {
    refocus.current = true
    setCard(null)
  }, [])
  useEffect(() => {
    if (card !== null || !refocus.current) return
    refocus.current = false
    buttonRef.current?.focus()
  }, [card])

  const scored = session.games.some((g) => g.status === 'scored')
  // Players in the standings (removed players aren't), by name, so a player finds themselves quickly.
  const players = standings(session)
    .map((r) => ({ id: r.playerId, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  const valid = players.some((p) => p.id === picked)

  const make = () => {
    if (!valid) return
    setCard(picked)
    setPicking(false)
  }

  return (
    <div className="stack-share stack-my-card">
      {!picking ? (
        <div>
          <button ref={buttonRef} type="button" className="btn main" disabled={!scored} onClick={() => setPicking(true)}>
            {copy.button}
          </button>
        </div>
      ) : (
        <div className="stack-my-card-pick">
          <label htmlFor={selectId}>{copy.pickLabel}</label>
          <select id={selectId} value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">{copy.pickPrompt}</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="stack-my-card-actions">
            <button type="button" className="btn main" disabled={!valid} onClick={make}>
              {copy.make}
            </button>
            <button type="button" className="btn ghost" onClick={() => setPicking(false)}>
              {copy.cancel}
            </button>
          </div>
        </div>
      )}
      {card !== null && <ShareCardDialog session={session} playerId={card} onClose={close} />}
    </div>
  )
}
