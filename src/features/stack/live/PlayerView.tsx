/**
 * `/paddle-stack/live/<code>` (T6.4): the organizer's board on a player's own phone, view-only. It follows the
 * stack live (`useLiveViewer`) and rebuilds the board from the snapshot (SPEC §4 "Live stacks").
 */
import { useEffect, useId } from 'react'
import { Link, useParams } from 'react-router-dom'
import { paddleStack } from '../../../config/paddleStack'
import { standings } from '../engine'
import { loadStackFonts } from '../fonts'
import { courtTone, teamStreak } from '../tvInfo'
import type { Game, Session, Team } from '../types'
import type { LiveStackView, LiveVenue } from './api'
import { venueBookUrl, venueLogoUrl } from './handoff'
import { sessionFromSnapshot } from './snapshot'
import { useLiveViewer } from './useLiveViewer'

const { board, tv, viewer: copy, handoff } = paddleStack

const timeOf = (d: Date) => d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export function PlayerView() {
  const { code = '' } = useParams()
  const state = useLiveViewer(code)
  useEffect(() => {
    loadStackFonts()
  }, [])

  let body
  if (state.kind === 'loading') {
    body = (
      <>
        <h1>{copy.heading}</h1>
        <p className="hint" role="status">
          {copy.loading}
        </p>
      </>
    )
  } else if (state.kind === 'not_found') {
    body = (
      <>
        <h1>{copy.heading}</h1>
        <p className="stack-note">{copy.notFound}</p>
      </>
    )
  } else if (state.kind === 'error') {
    body = (
      <div role="alert">
        <h1>{copy.heading}</h1>
        <p className="stack-note">{copy.error}</p>
        <button type="button" className="btn main" onClick={() => window.location.reload()}>
          {copy.reload}
        </button>
      </div>
    )
  } else {
    body = <Ready view={state.view} mode={state.mode} updatedAt={state.updatedAt} />
  }

  return (
    <div className="page paddle-stack stack-viewer">
      {body}
      <aside className="stack-venue">
        <p>{copy.ownStack}</p>
        <Link className="btn ghost" to="/paddle-stack">
          {copy.ownStackLink}
        </Link>
      </aside>
    </div>
  )
}

function Ready({ view, mode, updatedAt }: { view: LiveStackView; mode: 'live' | 'polling'; updatedAt: Date }) {
  const session = view.snapshot ? sessionFromSnapshot(view.snapshot) : null
  const status = view.ended ? copy.endedNote : mode === 'live' ? copy.live : copy.polling
  return (
    <>
      {view.venue && <VenueHeader venue={view.venue} />}
      <h1>{view.title || copy.heading}</h1>
      <p className="stack-viewer-status">
        <span aria-label={copy.statusLabel} role="status" className={`stack-viewer-dot ${view.ended ? 'ended' : mode}`}>
          {status}
        </span>
        <span>
          {copy.lastUpdated} {timeOf(updatedAt)}
        </span>
      </p>
      <p className="hint">{copy.viewOnly}</p>
      {!session ? (
        // An ended stack with no board says only that it has ended (the status line above).
        !view.ended && <p className="stack-note">{copy.notStarted}</p>
      ) : view.ended ? (
        <section className="stack-ended" aria-labelledby="viewer-final">
          <h2 id="viewer-final">{copy.finalStandings}</h2>
          <Standings session={session} label={copy.finalStandings} />
        </section>
      ) : (
        <LiveBoard session={session} />
      )}
    </>
  )
}

function VenueHeader({ venue }: { venue: LiveVenue }) {
  return (
    <div className="stack-viewer-venue">
      <p className="stack-viewer-venue-name">
        {venue.logoPath && <img className="stack-venue-logo" src={venueLogoUrl(venue.logoPath)} alt="" />}
        <span>{handoff.venueOf(venue.name)}</span>
      </p>
      <a className="btn main" href={venueBookUrl(venue.slug)}>
        {copy.bookCourt}
      </a>
    </div>
  )
}

function LiveBoard({ session }: { session: Session }) {
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? ''
  const playing = session.games.filter((g) => g.status === 'playing')
  const out = session.players.filter((p) => p.status === 'out')
  return (
    <>
      <div className="stack-courts">
        {Array.from({ length: session.courts }, (_, i) => i + 1).map((n) => (
          <Court key={n} number={n} game={playing.find((g) => g.court === n)} session={session} nameOf={nameOf} />
        ))}
      </div>
      <section className="stack-line" aria-labelledby="viewer-upnext">
        <h2 id="viewer-upnext">{board.upNext}</h2>
        {session.line.length === 0 ? (
          <p className="hint">{board.lineEmpty}</p>
        ) : (
          <ol>
            {session.line.map((id) => (
              <li key={id}>
                <span>{nameOf(id)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {out.length > 0 && (
        <div className="stack-out">
          <p>{board.onBreak}</p>
          <ul>
            {out.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <section className="stack-standings" aria-labelledby="viewer-standings">
        <h2 id="viewer-standings">{paddleStack.standings.title}</h2>
        <Standings session={session} label={paddleStack.standings.title} />
      </section>
    </>
  )
}

function Court({ number, game, session, nameOf }: { number: number; game: Game | undefined; session: Session; nameOf: (id: string) => string }) {
  const headingId = useId()
  const side = (ids: Team) => {
    const streak = teamStreak(session, ids)
    return (
      <span className="stack-side">
        <span>{ids.map(nameOf).join(' & ')}</span>
        {streak >= 2 && <span className="stack-court-streak">{tv.streak(streak)}</span>}
      </span>
    )
  }
  return (
    <section className={`stack-court tone-${courtTone(number)}${game ? '' : ' empty'}`} aria-labelledby={headingId}>
      <h2 id={headingId}>
        {board.court} {number}
      </h2>
      {!game ? (
        <p className="hint">{session.play === 'singles' ? tv.waitingSingles : tv.waiting}</p>
      ) : (
        <p className="stack-teams">
          {side(game.teamA)}
          <small className="stack-vs">{board.vs}</small>
          {side(game.teamB)}
        </p>
      )}
    </section>
  )
}

function Standings({ session, label }: { session: Session; label: string }) {
  const rows = standings(session)
  const s = paddleStack.standings
  if (rows.every((r) => r.games === 0)) return <p className="hint">{s.empty}</p>
  return (
    <div className="stack-table">
      <table aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{s.place}</th>
            <th scope="col">{s.player}</th>
            <th scope="col">{s.wins}</th>
            <th scope="col">{s.losses}</th>
            <th scope="col">{s.diff}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.pointsFor - r.pointsAgainst
            return (
              <tr key={r.playerId}>
                <td>{r.place}</td>
                <td>{r.name}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{diff > 0 ? `+${diff}` : diff}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
