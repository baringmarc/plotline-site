import { useId, useState, type FormEvent } from 'react'
import { paddleStack } from '../../config/paddleStack'
import {
  addPlayers,
  backInLine,
  createSession,
  fillCourts,
  MAX_COURTS,
  recordScore,
  removePlayer,
  skipGame,
  StackError,
  standings,
  timeOut,
} from './engine'
import { parseNames } from './parseNames'
import { clearStack, loadStack, saveStack, type StackState } from './storage'
import type { Format, Game, Session } from './types'

const { start, formats, board, end, ended: endedCopy, venueCta } = paddleStack

/** `/paddle-stack`: a free open-play queue on one device (SPEC §4 "Paddle Stack rules"). */
export function StackPage() {
  const [state, setState] = useState<StackState | null>(() => loadStack())
  const [storageFailed, setStorageFailed] = useState(false)

  const commit = (next: StackState) => {
    setState(next)
    if (!saveStack(next)) setStorageFailed(true)
  }
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
    clearStack()
    setState(null)
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
      {state && !state.ended && (
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
          <StandingsTable session={state.session} label={endedCopy.title} />
          <button type="button" className="btn main" onClick={reset}>
            {endedCopy.again}
          </button>
        </section>
      )}
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

function StartForm({ onStart }: { onStart: (s: Session) => void }) {
  const [courts, setCourts] = useState(2)
  const [format, setFormat] = useState<Format>('fair')
  const [names, setNames] = useState('')
  const [tooFew, setTooFew] = useState(false)
  const ids = { courts: useId(), names: useId(), hint: useId() }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const list = parseNames(names)
    if (list.length < 4) {
      setTooFew(true)
      return
    }
    onStart(createSession({ format, courts, names: list }))
  }

  return (
    <form className="formcard stack-start" onSubmit={submit} noValidate>
      <label htmlFor={ids.courts}>{start.courtsLabel}</label>
      <select id={ids.courts} value={courts} onChange={(e) => setCourts(Number(e.target.value))}>
        {Array.from({ length: MAX_COURTS }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <fieldset>
        <legend>{start.formatLabel}</legend>
        {formats.map((f) => (
          <label key={f.id} className="stack-format">
            <input
              type="radio"
              name="stack-format"
              value={f.id}
              checked={format === f.id}
              onChange={() => setFormat(f.id as Format)}
            />
            <span>
              <b>{f.label}</b>
              <small>{f.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={ids.names}>{start.namesLabel}</label>
      <textarea
        id={ids.names}
        rows={8}
        value={names}
        placeholder={start.namesPlaceholder}
        aria-describedby={ids.hint}
        onChange={(e) => {
          setNames(e.target.value)
          setTooFew(false)
        }}
      />
      <p className="hint" id={ids.hint}>
        {start.namesHint}
      </p>
      {tooFew && (
        <p className="err" role="alert">
          {start.needFour}
        </p>
      )}
      <button type="submit" className="btn main">
        {start.submit}
      </button>
    </form>
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
  const roundOn = session.format === 'americano' && playing.length > 0

  return (
    <>
      <div className="stack-courts">
        {Array.from({ length: session.courts }, (_, i) => i + 1).map((n) => (
          <Court
            key={n}
            number={n}
            game={playing.find((g) => g.court === n)}
            nameOf={nameOf}
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
            if (list.length) act((s) => addPlayers(s, list))
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
        <StandingsTable session={session} label={paddleStack.standings.title} />
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
  act: (fn: (s: Session) => Session) => void
}

const SCORE = /^\d{1,2}$/

function Court({ number, game, nameOf, act }: CourtProps) {
  const [editing, setEditing] = useState(false)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState('')
  const headingId = useId()
  const team = (ids: [string, string]) => `${nameOf(ids[0])} & ${nameOf(ids[1])}`
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
    <section className={game ? 'stack-court' : 'stack-court empty'} aria-labelledby={headingId}>
      <h3 id={headingId}>
        {board.court} {number}
      </h3>
      {!game ? (
        <p className="hint">{board.waiting}</p>
      ) : (
        <>
          <p className="stack-teams">
            <span>{team(game.teamA)}</span>
            <small>{board.vs}</small>
            <span>{team(game.teamB)}</span>
          </p>
          {editing ? (
            <form className="stack-score" onSubmit={save} noValidate>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${board.scoreFor} ${team(game.teamA)}`}
                value={a}
                onChange={(e) => setA(e.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${board.scoreFor} ${team(game.teamB)}`}
                value={b}
                onChange={(e) => setB(e.target.value)}
              />
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

function StandingsTable({ session, label }: { session: Session; label: string }) {
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
