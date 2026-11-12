import { useEffect } from 'react'
import { paddleStack } from '../../config/paddleStack'
import type { Session } from './types'

const { tv } = paddleStack

/** The big-screen view for a TV or tablet facing the courts: no controls but Exit (or Escape). */
export function TvBoard({ session, nowOn, onExit }: { session: Session; nowOn: number | null; onExit: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onExit])

  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? ''
  const playing = session.games.filter((g) => g.status === 'playing')
  const next = session.line.slice(0, 4)

  return (
    <div className="stack-tv">
      {nowOn !== null && (
        <p className="stack-tv-banner" key={`${nowOn}-${session.games.length}`}>
          {tv.nowOn} {nowOn}
        </p>
      )}
      <div className="stack-tv-courts">
        {Array.from({ length: session.courts }, (_, i) => i + 1).map((n) => {
          const game = playing.find((g) => g.court === n)
          return (
            <section key={n} className={game ? 'stack-tv-court' : 'stack-tv-court empty'} aria-label={`${tv.court} ${n}`}>
              <h2>
                {tv.court} {n}
              </h2>
              {game ? (
                <p className="stack-tv-teams">
                  <span>
                    {nameOf(game.teamA[0])} & {nameOf(game.teamA[1])}
                  </span>
                  <small>{tv.vs}</small>
                  <span>
                    {nameOf(game.teamB[0])} & {nameOf(game.teamB[1])}
                  </span>
                </p>
              ) : (
                <p className="stack-tv-waiting">{tv.waiting}</p>
              )}
            </section>
          )
        })}
      </div>
      <section className="stack-tv-next" aria-label={tv.upNext}>
        <h2>{tv.upNext}</h2>
        {next.length === 0 ? (
          <p>{tv.lineEmpty}</p>
        ) : (
          <ol>
            {next.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </ol>
        )}
      </section>
      <footer className="stack-tv-foot">
        <span>{tv.footer}</span>
        <button type="button" className="chipbtn" onClick={onExit}>
          {tv.exit}
        </button>
      </footer>
    </div>
  )
}
