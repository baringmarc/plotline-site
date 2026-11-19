import QrCreator from 'qr-creator'
import { useEffect, useRef } from 'react'
import { paddleStack } from '../../config/paddleStack'
import { joinUrl, shortJoinLink } from './live/joinLink'
import { courtTone, lastResult, teamStreak } from './tvInfo'
import type { Session, Team } from './types'

const { tv } = paddleStack

/** The join QR and short link in the bottom band (T6.6). Dark on white so phones read it in either theme. */
function JoinQr({ code }: { code: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) QrCreator.render({ text: joinUrl(code), size: 300, ecLevel: 'M', quiet: 2, fill: '#000', background: '#fff' }, canvas.current)
  }, [code])
  return (
    <div className="stack-tv-qr has-code">
      <p className="stack-tv-qr-title">{tv.join.title}</p>
      <canvas ref={canvas} width={300} height={300} aria-label={tv.join.qrLabel} />
      <p className="stack-tv-qr-link">{shortJoinLink(code)}</p>
    </div>
  )
}

/**
 * The big-screen view for a TV or tablet facing the courts: no controls but Exit (or Escape).
 * Design A "Court bands" (T8.6, the user's pick): logo and title on top, a coloured band per court, Up next along the bottom.
 */
export function TvBoard({
  session,
  nowOn,
  onExit,
  joinCode,
}: {
  session: Session
  nowOn: number | null
  onExit: () => void
  /** The live stack's code while this device is live (T6.6): the bottom slot shows its join QR and short link. */
  joinCode?: string | null
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onExit])

  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? ''
  const playing = session.games.filter((g) => g.status === 'playing')
  const singles = session.play === 'singles'
  const next = session.line.slice(0, singles ? 2 : 4)
  const onBreak = session.players.filter((p) => p.status === 'out')
  const formatLabel = paddleStack.formats.find((f) => f.id === session.format)?.label ?? ''
  const playLabel = paddleStack.start.plays.find((p) => p.id === session.play)?.label ?? ''

  const side = (ids: Team) => {
    const streak = teamStreak(session, ids)
    return (
      <span className="stack-tv-side">
        <span>{ids.map(nameOf).join(' & ')}</span>
        {streak >= 2 && <span className="stack-tv-streak">{tv.streak(streak)}</span>}
      </span>
    )
  }

  return (
    <div className="stack-tv">
      <header className="stack-tv-head">
        <div className="stack-tv-logo">
          <img src="/logo.svg" alt="" />
          <span>{tv.brand}</span>
        </div>
        {session.title ? <h1 className="stack-tv-title">{session.title}</h1> : <span />}
        <div className="stack-tv-banner-slot">
          {nowOn !== null && (
            <p className="stack-tv-banner" key={`${nowOn}-${session.games.length}`}>
              {tv.nowOn} {nowOn}
            </p>
          )}
        </div>
      </header>
      <div className="stack-tv-courts">
        {Array.from({ length: session.courts }, (_, i) => i + 1).map((n) => {
          const game = playing.find((g) => g.court === n)
          const last = lastResult(session, n)
          return (
            <section
              key={n}
              className={`stack-tv-court tone-${courtTone(n)}${game ? '' : ' empty'}`}
              aria-label={`${tv.court} ${n}`}
            >
              <div className="stack-tv-band">
                <h2>
                  {tv.court} {n}
                </h2>
                {last && <span className="stack-tv-last">{tv.lastGame(last.high, last.low)}</span>}
              </div>
              {game ? (
                <p className="stack-tv-teams">
                  {side(game.teamA)}
                  <small className="stack-vs">{tv.vs}</small>
                  {side(game.teamB)}
                </p>
              ) : (
                <p className="stack-tv-waiting">{singles ? tv.waitingSingles : tv.waiting}</p>
              )}
            </section>
          )
        })}
      </div>
      <div className="stack-tv-bottom">
        <div className="stack-tv-bottom-main">
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
          {onBreak.length > 0 && (
            <p className="stack-tv-break">
              {tv.onBreak} {onBreak.map((p) => p.name).join(', ')}
            </p>
          )}
        </div>
        {joinCode ? (
          <JoinQr code={joinCode} />
        ) : (
          <div className="stack-tv-qr" aria-hidden="true" />
        )}
      </div>
      <footer className="stack-tv-foot">
        <span>{tv.footer}</span>
        <span className="stack-tv-meta">{[formatLabel, playLabel].filter(Boolean).join(' · ')}</span>
        <button type="button" className="chipbtn" onClick={onExit}>
          {tv.exit}
        </button>
      </footer>
    </div>
  )
}
