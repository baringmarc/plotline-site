import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paddleStack } from '../../config/paddleStack'
import {
  addPairs,
  addPlayers,
  backInLine,
  fillCourts,
  isRoundFormat,
  recordScore,
  removePlayer,
  skipGame,
  StackError,
  standings,
  timeOut,
} from './engine'
import { loadStackFonts } from './fonts'
import { parseNames } from './parseNames'
import { ShareCardDialog } from './shareCards/ShareCardDialog'
import { clearStack, loadStack, loadVoicePref, saveStack, saveVoicePref, STACK_STORAGE_KEY, type StackState } from './storage'
import { StartForm } from './StartForm'
import { TvBoard } from './TvBoard'
import { GoLivePanel } from './live/GoLivePanel'
import { useLiveStack } from './live/useLiveStack'
import { announce, callOutText, canSpeak, requestWakeLock } from './voice'
import { courtTone, teamStreak } from './tvInfo'
import type { Game, Session, Team } from './types'

const { board, end, ended: endedCopy, venueCta, voice, tv } = paddleStack

/** `/paddle-stack`: a free open-play queue on one device (SPEC §4 "Paddle Stack rules"). */
export function StackPage() {
  const [state, setState] = useState<StackState | null>(() => loadStack())
  const [storageFailed, setStorageFailed] = useState(false)
  const [speakable] = useState(() => canSpeak())
  const [voiceOn, setVoiceOn] = useState(() => speakable && loadVoicePref())
  const [tvOpen, setTvOpen] = useState(false)
  const [nowOn, setNowOn] = useState<number | null>(null)
  const live = useLiveStack()
  const release = useRef<Promise<() => void> | null>(null)
  const askedFullscreen = useRef(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  /** The `?tv=1` window opened by "Open TV in a new window": the TV board alone, following the organizer's window. */
  const tvWindow = params.get('tv') === '1'
  /** The `?tv=1` window is showing the TV board (not the start screen or the final standings). */
  const tvWindowBoard = tvWindow && !!state && !state.ended
  const current = useRef(state)
  useEffect(() => {
    current.current = state
  }, [state])
  // Paddle Stack's display face (T8.2), loaded only here so the landing page's first load doesn't grow.
  useEffect(() => {
    loadStackFonts()
  }, [])

  /** Games on court in `next` that weren't in `prev`. */
  const newGames = (prev: StackState | null, next: StackState | null): Game[] => {
    const before = new Set(prev?.session.games.map((g) => g.id) ?? [])
    return next?.session.games.filter((g) => g.status === 'playing' && !before.has(g.id)) ?? []
  }

  const commit = (next: StackState) => {
    // Courts filled by this change: show the banner and, with voice on, call each one out once.
    const filled = newGames(state, next)
    if (filled.length) {
      setNowOn(filled[filled.length - 1].court)
      if (voiceOn && speakable) {
        const nameOf = (id: string) => next.session.players.find((p) => p.id === id)?.name ?? ''
        for (const g of filled) {
          announce(callOutText(g.court, g.teamA.map(nameOf), g.teamB.map(nameOf)))
        }
      }
    }
    setState(next)
    if (!saveStack(next)) setStorageFailed(true)
    // Every change goes to the live stack (if this device has one); the final board is published as the end.
    if (next.ended) live.end(next.session)
    else live.submit(next.session)
  }

  const openTv = () => {
    setTvOpen(true)
    try {
      const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
      if (root.requestFullscreen) {
        askedFullscreen.current = true
        void root.requestFullscreen()?.catch?.(() => {})
      }
    } catch {
      // Full screen is optional.
    }
    release.current = requestWakeLock()
  }
  const closeTv = () => {
    askedFullscreen.current = false
    setTvOpen(false)
    void release.current?.then((done) => done())
    release.current = null
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.()?.catch?.(() => {})
    } catch {
      // Not in full screen.
    }
  }
  // The browser drops the wake lock when the tab is hidden; ask again when it comes back while a TV board shows.
  useEffect(() => {
    if (!tvOpen && !tvWindowBoard) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      void release.current?.then((done) => done())
      release.current = requestWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tvOpen, tvWindowBoard])
  // Follow changes saved by another window on this device (the `?tv=1` window, or a second tab). Those changes
  // were already called out where they were made, so here they only move the banner.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STACK_STORAGE_KEY) return
      const loaded = loadStack()
      const filled = newGames(current.current, loaded)
      if (filled.length) setNowOn(filled[filled.length - 1].court)
      setState(loaded)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  // Leaving full screen (the browser's own Escape) closes TV mode, if TV mode asked for it.
  useEffect(() => {
    const onChange = () => {
      if (askedFullscreen.current && !document.fullscreenElement) closeTv()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  })
  // The TV window keeps its screen on from the start; any page left while holding the lock lets it go.
  useEffect(() => {
    if (tvWindowBoard) release.current = requestWakeLock()
    return () => {
      void release.current?.then((done) => done())
      release.current = null
    }
  }, [tvWindowBoard])
  /** Runs an engine action, then refills the courts. Refused actions leave the session as it was. */
  const act = (fn: (s: Session) => Session) => {
    if (!state) return
    let next: Session
    try {
      next = fillCourts(fn(state.session))
    } catch (err) {
      if (err instanceof StackError) return
      throw err
    }
    commit({ ...state, session: next })
  }
  const reset = () => {
    live.forget()
    clearStack()
    setState(null)
  }

  /** Closes the `?tv=1` window. Browsers refuse to close a window the script didn't open (a bookmark, a typed URL), so then it goes back to the board. */
  function exitTvWindow() {
    window.close()
    setTimeout(() => {
      if (!window.closed) navigate('/paddle-stack', { replace: true })
    }, 150)
  }

  if (tvWindowBoard && state) {
    return (
      <div className="page paddle-stack">
        <TvBoard session={state.session} nowOn={nowOn} onExit={exitTvWindow} />
      </div>
    )
  }

  return (
    <div className="page paddle-stack">
      <h1>{paddleStack.title}</h1>
      <p className="lead">{paddleStack.lead}</p>
      {storageFailed && (
        <p className="hint" role="status">
          {paddleStack.storageNote}
        </p>
      )}
      {!state && <StartForm onStart={(session) => commit({ session: fillCourts(session), ended: false })} />}
      {state && !state.ended && tvOpen && <TvBoard session={state.session} nowOn={nowOn} onExit={closeTv} />}
      {state && !state.ended && !tvOpen && (
        <div className="stack-tools">
          <button type="button" className="btn dark" onClick={openTv}>
            {tv.open}
          </button>
          <button type="button" className="btn ghost" onClick={() => window.open('/paddle-stack?tv=1', tv.windowName)}>
            {tv.openWindow}
          </button>
          <label className="check">
            <input
              type="checkbox"
              aria-describedby="stack-voice-hint"
              checked={speakable && voiceOn}
              disabled={!speakable}
              onChange={(e) => {
                setVoiceOn(e.target.checked)
                saveVoicePref(e.target.checked)
              }}
            />
            <b>{voice.label}</b>
          </label>
          <small className="hint" id="stack-voice-hint">
            {voice.hint}
          </small>
          <button
            type="button"
            className="chipbtn"
            disabled={!speakable}
            onClick={() => announce(callOutText(voice.sample.court, voice.sample.a, voice.sample.b))}
          >
            {voice.test}
          </button>
          {!speakable && <p className="hint">{voice.unsupported}</p>}
        </div>
      )}
      {state && !state.ended && !tvOpen && <GoLivePanel session={state.session} live={live} />}
      {state && !state.ended && !tvOpen && (
        <Board
          session={state.session}
          act={act}
          onEnd={() => commit({ ...state, ended: true })}
          onRestart={() => {
            if (window.confirm(paddleStack.restartConfirm)) reset()
          }}
        />
      )}
      {state?.ended && (
        <section className="stack-ended" aria-labelledby="stack-final">
          <h2 id="stack-final">{endedCopy.title}</h2>
          <ShareableStandings session={state.session} label={endedCopy.title} />
          <button type="button" className="btn main" onClick={reset}>
            {endedCopy.again}
          </button>
        </section>
      )}
      <Guide />
      <aside className="stack-venue">
        <h2>{venueCta.title}</h2>
        <p>{venueCta.body}</p>
        <a className="btn ghost" href={venueCta.href}>
          {venueCta.link}
        </a>
      </aside>
    </div>
  )
}

/** How to run open play, and the organizers' FAQ (T5.6): under the tool, for people who arrive from search. */
function Guide() {
  const { guide, faq } = paddleStack
  return (
    <>
      <section className="stack-guide" aria-labelledby="stack-guide-title">
        <h2 id="stack-guide-title">{guide.title}</h2>
        <div className="stack-guide-grid">
          {guide.sections.map((g) => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              <p>{g.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="stack-faq" aria-labelledby="stack-faq-title">
        <h2 id="stack-faq-title">{faq.title}</h2>
        <div className="faq">
          {faq.items.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span className="chev" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9l7 7 7-7" />
                  </svg>
                </span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  )
}

interface BoardProps {
  session: Session
  act: (fn: (s: Session) => Session) => void
  onEnd: () => void
  onRestart: () => void
}

function Board({ session, act, onEnd, onRestart }: BoardProps) {
  const [confirming, setConfirming] = useState(false)
  const [adding, setAdding] = useState('')
  const addId = useId()
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? ''
  const playing = session.games.filter((g) => g.status === 'playing')
  const out = session.players.filter((p) => p.status === 'out')
  const roundOn = isRoundFormat(session.format) && playing.length > 0

  return (
    <>
      {session.title && <h2 className="stack-title">{session.title}</h2>}
      <div className="stack-courts">
        {Array.from({ length: session.courts }, (_, i) => i + 1).map((n) => (
          <Court
            key={n}
            number={n}
            game={playing.find((g) => g.court === n)}
            nameOf={nameOf}
            streakOf={(t) => teamStreak(session, t)}
            act={act}
          />
        ))}
      </div>
      {roundOn && <p className="hint">{board.roundWait}</p>}

      <section className="stack-line" aria-labelledby="stack-upnext">
        <h2 id="stack-upnext">{board.upNext}</h2>
        {session.line.length === 0 ? (
          <p className="hint">{board.lineEmpty}</p>
        ) : (
          <ol>
            {session.line.map((id) => (
              <li key={id}>
                <span>{nameOf(id)}</span>
                <button type="button" className="chipbtn" aria-label={`${board.timeOut} ${nameOf(id)}`} onClick={() => act((s) => timeOut(s, id))}>
                  {board.timeOut}
                </button>
                <button type="button" className="chipbtn" aria-label={`${board.remove} ${nameOf(id)}`} onClick={() => act((s) => removePlayer(s, id))}>
                  {board.remove}
                </button>
              </li>
            ))}
          </ol>
        )}
        <form
          className="stack-add"
          onSubmit={(e) => {
            e.preventDefault()
            const list = parseNames(adding)
            // Fixed pairs: names are paired in the order given, as on the start screen; a name left over is dropped.
            if (session.teams === 'fixed') {
              const pairs = Array.from({ length: Math.floor(list.length / 2) }, (_, i) => [list[i * 2], list[i * 2 + 1]] as [string, string])
              if (pairs.length) act((s) => addPairs(s, pairs))
            } else if (list.length) act((s) => addPlayers(s, list))
            setAdding('')
          }}
        >
          <label htmlFor={addId}>{board.addLabel}</label>
          <div>
            <input id={addId} type="text" value={adding} onChange={(e) => setAdding(e.target.value)} />
            <button type="submit" className="btn dark">
              {board.addSubmit}
            </button>
          </div>
        </form>
      </section>
      {out.length > 0 && (
        <div className="stack-out">
          <p>{board.onBreak}</p>
          <ul>
            {out.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button type="button" className="chipbtn" aria-label={`${board.backInLine} ${p.name}`} onClick={() => act((s) => backInLine(s, p.id))}>
                  {board.backInLine}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="stack-standings" aria-labelledby="stack-standings">
        <h2 id="stack-standings">{paddleStack.standings.title}</h2>
        <ShareableStandings session={session} label={paddleStack.standings.title} />
      </section>

      <div className="stack-actions">
        {confirming ? (
          <div className="stack-confirm" role="alertdialog" aria-labelledby="stack-confirm">
            <p id="stack-confirm">{end.confirm}</p>
            <button type="button" className="btn main" onClick={onEnd}>
              {end.yes}
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
              {end.no}
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn dark" onClick={() => setConfirming(true)}>
              {end.button}
            </button>
            <button type="button" className="btn ghost" onClick={onRestart}>
              {paddleStack.restart}
            </button>
          </>
        )}
      </div>
    </>
  )
}

interface CourtProps {
  number: number
  game: Game | undefined
  nameOf: (id: string) => string
  /** Wins in a row for this side (T8.6); a chip shows from 2. */
  streakOf: (team: Team) => number
  act: (fn: (s: Session) => Session) => void
}

const SCORE = /^\d{1,2}$/

function Court({ number, game, nameOf, streakOf, act }: CourtProps) {
  const [editing, setEditing] = useState(false)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState('')
  const headingId = useId()
  const team = (ids: readonly string[]) => ids.map(nameOf).join(' & ')
  const side = (ids: Team) => {
    const streak = streakOf(ids)
    return (
      <span className="stack-side">
        <span>{team(ids)}</span>
        {streak >= 2 && <span className="stack-court-streak">{paddleStack.tv.streak(streak)}</span>}
      </span>
    )
  }
  const close = () => {
    setEditing(false)
    setA('')
    setB('')
    setError('')
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!game) return
    if (!SCORE.test(a.trim()) || !SCORE.test(b.trim())) {
      setError(board.badScore)
      return
    }
    const [sa, sb] = [Number(a), Number(b)]
    if (sa === sb) {
      setError(board.tie)
      return
    }
    act((s) => recordScore(s, game.id, sa, sb))
    close()
  }

  return (
    <section className={`stack-court tone-${courtTone(number)}${game ? '' : ' empty'}`} aria-labelledby={headingId}>
      <h2 id={headingId}>
        {board.court} {number}
      </h2>
      {!game ? (
        <p className="hint">{board.waiting}</p>
      ) : (
        <>
          <p className="stack-teams">
            {side(game.teamA)}
            <small className="stack-vs">{board.vs}</small>
            {side(game.teamB)}
          </p>
          {editing ? (
            <form className="stack-score" onSubmit={save} noValidate>
              {/* Each box shows its team (T8.2, the user's call), so the two scores can't be swapped. */}
              <div className="stack-score-teams">
                <label className="stack-score-field">
                  <span>{team(game.teamA)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`${board.scoreFor} ${team(game.teamA)}`}
                    value={a}
                    onChange={(e) => setA(e.target.value)}
                  />
                </label>
                <span className="stack-score-dash" aria-hidden="true">
                  –
                </span>
                <label className="stack-score-field">
                  <span>{team(game.teamB)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`${board.scoreFor} ${team(game.teamB)}`}
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                  />
                </label>
              </div>
              {error && (
                <p className="err" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn main">
                {board.saveScore}
              </button>
              <button type="button" className="btn ghost" onClick={close}>
                {board.cancel}
              </button>
            </form>
          ) : (
            <div className="stack-court-actions">
              <button type="button" className="btn main" onClick={() => setEditing(true)}>
                {board.enterScore}
              </button>
              <button type="button" className="btn ghost" onClick={() => act((s) => skipGame(s, game.id))}>
                {board.skipScore}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** The standings with "Share card" on each row and "Share standings" under them; both open the card preview (T8.7). */
function ShareableStandings({ session, label }: { session: Session; label: string }) {
  // undefined: closed; null: the group card; a player id: that player's card.
  const [card, setCard] = useState<string | null | undefined>(undefined)
  const close = useCallback(() => setCard(undefined), [])
  return (
    <>
      <StandingsTable session={session} label={label} onCard={setCard} />
      <ShareBox session={session} onOpen={() => setCard(null)} />
      {card !== undefined && <ShareCardDialog session={session} playerId={card ?? undefined} onClose={close} />}
    </>
  )
}

function StandingsTable({ session, label, onCard }: { session: Session; label: string; onCard: (playerId: string) => void }) {
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
            <th scope="col">
              <span className="sr-only">{paddleStack.share.cardButton}</span>
            </th>
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
                <td>
                  <button
                    type="button"
                    className="stack-card-btn"
                    aria-label={paddleStack.share.cardButtonFor(r.name)}
                    onClick={() => onCard(r.playerId)}
                  >
                    {paddleStack.share.cardButton}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** "Share standings": opens the group card's preview (T5.5, T8.7). Enabled once a game is scored. */
function ShareBox({ session, onOpen }: { session: Session; onOpen: () => void }) {
  const scored = session.games.some((g) => g.status === 'scored')
  return (
    <div className="stack-share">
      <div>
        <button type="button" className="btn main" disabled={!scored} onClick={onOpen}>
          {paddleStack.share.button}
        </button>
      </div>
    </div>
  )
}
