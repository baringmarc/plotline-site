import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paddleStack } from '../../config/paddleStack'
import {
  addPairs,
  addPlayers,
  backInLine,
  createSession,
  fillCourts,
  isRoundFormat,
  lockPair,
  locksOffered,
  recordScore,
  removePlayer,
  skipGame,
  StackError,
  standings,
  timeOut,
  unlockPair,
} from './engine'
import { loadStackFonts } from './fonts'
import { parseNames } from './parseNames'
import { ShareCardDialog } from './shareCards/ShareCardDialog'
import { clearStack, loadStack, loadVoicePref, saveStack, saveVoicePref, STACK_STORAGE_KEY, type StackState } from './storage'
import { StartForm } from './StartForm'
import { TvBoard } from './TvBoard'
import { getLiveStack, type LiveStackView } from './live/api'
import { GoLivePanel } from './live/GoLivePanel'
import { HANDOFF_QUERY, parseHandoff, venueLogoUrl } from './live/handoff'
import { LIVE_KEY_STORAGE_KEY, loadLiveKey } from './live/liveKey'
import { useLiveStack } from './live/useLiveStack'
import { announce, callOutText, canSpeak, requestWakeLock } from './voice'
import { courtTone, teamStreak } from './tvInfo'
import type { Game, Player, Session, Team } from './types'

const { board, end, ended: endedCopy, venueCta, voice, tv, handoff: handoffCopy } = paddleStack

/** `/paddle-stack`: a free open-play queue on one device (SPEC §4 "Paddle Stack rules"). */
export function StackPage() {
  const [state, setState] = useState<StackState | null>(() => loadStack())
  const [storageFailed, setStorageFailed] = useState(false)
  const [speakable] = useState(() => canSpeak())
  const [voiceOn, setVoiceOn] = useState(() => speakable && loadVoicePref())
  const [tvOpen, setTvOpen] = useState(false)
  const [nowOn, setNowOn] = useState<number | null>(null)
  /** A hand-off link that couldn't be used (T6.3), and a hand-off waiting for the organizer's answer. */
  const [handoffNote, setHandoffNote] = useState<string | null>(null)
  const [asking, setAsking] = useState<{ code: string; secret: string; view: LiveStackView } | null>(null)
  const handoffTaken = useRef(false)
  const release = useRef<Promise<() => void> | null>(null)
  const askedFullscreen = useRef(false)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  /** The `?tv=1` window opened by "Open TV in a new window": the TV board alone, following the organizer's window. */
  const tvWindow = params.get('tv') === '1'
  // The ?tv=1 window never publishes, so it doesn't hold a channel of its own (T6.9).
  const live = useLiveStack({ joinChannel: !tvWindow })
  /** The `?tv=1` window is showing the TV board (not the start screen or the final standings). */
  const tvWindowBoard = tvWindow && !!state && !state.ended
  /**
   * The live code the `?tv=1` window shows as its join QR (T6.6). That window doesn't publish, so it can't see the
   * live status: it follows the key the organizer's window saves on this device.
   */
  const [windowLiveCode, setWindowLiveCode] = useState<string | null>(() => loadLiveKey()?.code ?? null)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIVE_KEY_STORAGE_KEY || e.key === null) setWindowLiveCode(loadLiveKey()?.code ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
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

  /** Starts the venue's stack here: the key is stored with the venue, and the session takes its title and courts. */
  const startHandoff = (link: { code: string; secret: string }, view: LiveStackView) => {
    live.adopt({
      code: link.code,
      secret: link.secret,
      version: view.version,
      ...(view.venue ? { venue: { name: view.venue.name, logoPath: view.venue.logoPath } } : {}),
    })
    setHandoffNote(null)
    setAsking(null)
    commit({ session: fillCourts(createSession({ format: 'fair', courts: view.courts, title: view.title })), ended: false })
  }

  // A hand-off link from a venue (T6.3). The secret leaves the address bar at once, whatever the outcome; this runs
  // once, since React's development mode mounts twice and the first run already took the link.
  useEffect(() => {
    if (handoffTaken.current) return
    if (!new URLSearchParams(window.location.search).has(HANDOFF_QUERY)) return
    handoffTaken.current = true
    const link = parseHandoff(window.location.search, window.location.hash)
    window.history.replaceState(null, '', '/paddle-stack')
    // The `?tv=1` window never takes a hand-off; it only loses the link from its address bar.
    if (tvWindow) return
    // A link that doesn't parse reads nothing; every outcome is reported from the promise.
    const reading: Promise<LiveStackView | null> = link ? getLiveStack(link.code) : Promise.resolve(null)
    reading.then(
      (view) => {
        if (!link) setHandoffNote(handoffCopy.bad)
        else if (!view || view.ended) setHandoffNote(handoffCopy.expired)
        else if (current.current && !current.current.ended) setAsking({ ...link, view })
        else startHandoff(link, view)
      },
      () => setHandoffNote(handoffCopy.failed),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load, by design
  }, [tvWindow])

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
        <TvBoard session={state.session} nowOn={nowOn} onExit={exitTvWindow} joinCode={windowLiveCode} />
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
      {state && !state.ended && tvOpen && (
        <TvBoard
          session={state.session}
          nowOn={nowOn}
          onExit={closeTv}
          joinCode={live.key && live.status?.state !== 'stopped' ? live.key.code : null}
        />
      )}
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
      {handoffNote && <p className="hint stack-note" role="alert">{handoffNote}</p>}
      {asking && (
        <section className="stack-ask" role="alertdialog" aria-labelledby="stack-ask-title">
          <p id="stack-ask-title">{handoffCopy.ask}</p>
          <button type="button" className="btn main" onClick={() => startHandoff(asking, asking.view)}>
            {handoffCopy.replace}
          </button>
          <button type="button" className="btn ghost" onClick={() => setAsking(null)}>
            {handoffCopy.keep}
          </button>
        </section>
      )}
      {state && !state.ended && !tvOpen && <GoLivePanel session={state.session} live={live} />}
      {state && !state.ended && !tvOpen && live.key?.venue && (
        <p className="stack-handoff-venue">
          {live.key.venue.logoPath && (
            <img className="stack-venue-logo" src={venueLogoUrl(live.key.venue.logoPath)} alt="" />
          )}
          <span>{handoffCopy.venueOf(live.key.venue.name)}</span>
        </p>
      )}
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
        <div className="stack-venue-text">
          <h2>{venueCta.title}</h2>
          <p>{venueCta.body}</p>
        </div>
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

/** Players grouped as sides, in the given order: one player, or a locked pair whose partners are both listed. */
function sidesOf(session: Session, ids: string[]): Player[][] {
  const byId = new Map(session.players.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const out: Player[][] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const p = byId.get(id)!
    const partner = p.partner !== undefined && ids.includes(p.partner) ? byId.get(p.partner) : undefined
    const side = partner ? [p, partner] : [p]
    for (const x of side) seen.add(x.id)
    out.push(side)
  }
  return out
}

function Board({ session, act, onEnd, onRestart }: BoardProps) {
  const [confirming, setConfirming] = useState(false)
  const [adding, setAdding] = useState('')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const ids = { add: useId(), first: useId(), second: useId() }
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? ''
  const playing = session.games.filter((g) => g.status === 'playing')
  const out = session.players.filter((p) => p.status === 'out')
  const roundOn = isRoundFormat(session.format) && playing.length > 0
  const roundRobin = session.format === 'round-robin'
  /** Pairs can be locked and unlocked on the board (SPEC §4 "Pair locks"); Round Robin keeps the start's pairs. */
  const locks = locksOffered(session.play, session.format) && !roundRobin
  const pairedRoundRobin = roundRobin && session.players.some((p) => p.partner !== undefined)
  /** Who a solo player can pair with: other solo players off court. */
  const candidates = (id: string) =>
    session.players.filter((p) => p.id !== id && p.partner === undefined && (p.status === 'waiting' || p.status === 'out'))
  const label = (side: Player[]) => side.map((p) => p.name).join(' & ')

  /** A side's buttons: Pair with… on a solo (in the line), Unlock on a pair. */
  const pairControls = (side: Player[], inLine: boolean) => {
    if (side.length === 2) {
      if (roundRobin) return null
      return (
        <button type="button" className="chipbtn" aria-label={`${board.unlock} ${label(side)}`} onClick={() => act((s) => unlockPair(s, side[0].id))}>
          {board.unlock}
        </button>
      )
    }
    const others = candidates(side[0].id)
    if (!locks || !inLine || others.length === 0) return null
    return (
      <select
        className="stack-pair-pick"
        aria-label={board.pairWith(side[0].name)}
        value=""
        onChange={(e) => {
          const other = e.target.value
          if (other) act((s) => lockPair(s, side[0].id, other))
        }}
      >
        <option value="">{board.pairPlaceholder}</option>
        {others.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    )
  }

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
            {sidesOf(session, session.line).map((side) => (
              <li key={side[0].id} className={side.length === 2 ? 'stack-line-pair' : undefined}>
                <span>{label(side)}</span>
                {pairControls(side, true)}
                <button
                  type="button"
                  className="chipbtn"
                  aria-label={`${board.timeOut} ${label(side)}`}
                  onClick={() => act((s) => timeOut(s, side[0].id))}
                >
                  {board.timeOut}
                </button>
                <button
                  type="button"
                  className="chipbtn"
                  aria-label={`${board.remove} ${label(side)}`}
                  onClick={() => act((s) => removePlayer(s, side[0].id))}
                >
                  {board.remove}
                </button>
              </li>
            ))}
          </ol>
        )}
        {pairedRoundRobin ? (
          <form
            className="stack-add stack-add-pair"
            aria-labelledby={ids.add}
            onSubmit={(e) => {
              e.preventDefault()
              const [a, b] = [first.trim(), second.trim()]
              if (!a || !b) return
              act((s) => addPairs(s, [[a, b]]))
              setFirst('')
              setSecond('')
            }}
          >
            <p className="stack-add-pair-title" id={ids.add}>
              {board.addPairLabel}
            </p>
            <label htmlFor={ids.first}>{board.addPairFirst}</label>
            <input id={ids.first} type="text" value={first} onChange={(e) => setFirst(e.target.value)} />
            <label htmlFor={ids.second}>{board.addPairSecond}</label>
            <div>
              <input id={ids.second} type="text" value={second} onChange={(e) => setSecond(e.target.value)} />
              <button type="submit" className="btn dark">
                {board.addPairSubmit}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="stack-add"
            onSubmit={(e) => {
              e.preventDefault()
              const list = parseNames(adding)
              if (list.length) act((s) => addPlayers(s, list))
              setAdding('')
            }}
          >
            <label htmlFor={ids.add}>{board.addLabel}</label>
            <div>
              <input id={ids.add} type="text" value={adding} onChange={(e) => setAdding(e.target.value)} />
              <button type="submit" className="btn dark">
                {board.addSubmit}
              </button>
            </div>
          </form>
        )}
      </section>
      {out.length > 0 && (
        <div className="stack-out">
          <p>{board.onBreak}</p>
          <ul>
            {sidesOf(
              session,
              out.map((p) => p.id),
            ).map((side) => (
              <li key={side[0].id} className={side.length === 2 ? 'stack-line-pair' : undefined}>
                <span>{label(side)}</span>
                {pairControls(side, false)}
                <button
                  type="button"
                  className="chipbtn"
                  aria-label={`${board.backInLine} ${label(side)}`}
                  onClick={() => act((s) => backInLine(s, side[0].id))}
                >
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
