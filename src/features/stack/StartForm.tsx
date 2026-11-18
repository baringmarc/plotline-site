import { useId, useState, type FormEvent } from 'react'
import { paddleStack } from '../../config/paddleStack'
import { createSession, MAX_COURTS, MAX_TITLE, type NewPlayer } from './engine'
import { parseNames } from './parseNames'
import { formatsFor, pairUp } from './startOptions'
import type { Format, Level, Play, Session, Teams } from './types'

const { start, formats } = paddleStack
const key = (name: string) => name.toLocaleLowerCase()

/** The start screen (T8.5): title, play, courts, players with levels and pairs, teams, and the rotation. */
export function StartForm({ onStart }: { onStart: (s: Session) => void }) {
  const [title, setTitle] = useState('')
  const [play, setPlay] = useState<Play>('doubles')
  const [teams, setTeams] = useState<Teams>('open')
  const [courts, setCourts] = useState(2)
  const [format, setFormat] = useState<Format>('fair')
  const [names, setNames] = useState('')
  const [levels, setLevels] = useState<Record<string, Level>>({})
  const [error, setError] = useState<string | null>(null)
  const ids = {
    title: useId(),
    courts: useId(),
    names: useId(),
    hint: useId(),
    details: useId(),
    pairs: useId(),
    fmt: useId(),
  }

  const list = parseNames(names)
  const offered = formatsFor(play, teams)
  const shown = formats.filter((f) => offered.includes(f.id))
  const selected = formats.find((f) => f.id === format)

  /** A play or teams change can hide the chosen format: it resets to Fair rotation, which every combination offers. */
  const choose = (nextPlay: Play, nextTeams: Teams) => {
    setPlay(nextPlay)
    setTeams(nextTeams)
    setError(null)
    if (!formatsFor(nextPlay, nextTeams).includes(format)) setFormat('fair')
  }

  const withLevel = (name: string): NewPlayer => {
    const level = levels[key(name)]
    return level ? { name, level } : name
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (list.length < (play === 'singles' ? 2 : 4)) {
      setError(play === 'singles' ? start.needTwo : start.needFour)
      return
    }
    if (teams === 'fixed') {
      const { pairs, leftover } = pairUp(list)
      if (leftover) {
        setError(start.needEven)
        return
      }
      onStart(
        createSession({
          title,
          play,
          teams,
          format,
          courts,
          pairs: pairs.map(([a, b]) => [withLevel(a), withLevel(b)]),
        }),
      )
      return
    }
    onStart(
      createSession({
        title,
        play,
        teams,
        format,
        courts,
        names: list.map(withLevel),
      }),
    )
  }

  const chip = (name: string) => (
    <span className="stack-chip" key={key(name)}>
      <b>{name}</b>
      <select
        aria-label={start.levelFor(name)}
        value={levels[key(name)] ?? ''}
        onChange={(e) => {
          const value = e.target.value
          setLevels((prev) => {
            const next = { ...prev }
            if (value) next[key(name)] = Number(value) as Level
            else delete next[key(name)]
            return next
          })
        }}
      >
        <option value="">{start.noLevel}</option>
        {start.levels.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </span>
  )

  const { pairs, leftover } = pairUp(list)

  return (
    <form className="formcard stack-start" onSubmit={submit} noValidate>
      <label htmlFor={ids.title}>{start.titleLabel}</label>
      <input
        id={ids.title}
        type="text"
        maxLength={MAX_TITLE}
        value={title}
        placeholder={start.titlePlaceholder}
        onChange={(e) => setTitle(e.target.value)}
      />

      <fieldset className="stack-play">
        <legend>{start.playLabel}</legend>
        {start.plays.map((p) => (
          <label key={p.id} className="stack-format">
            <input
              type="radio"
              name="stack-play"
              value={p.id}
              checked={play === p.id}
              onChange={() => choose(p.id, p.id === 'singles' ? 'open' : teams)}
            />
            <span>
              <b>{p.label}</b>
            </span>
          </label>
        ))}
      </fieldset>

      <label htmlFor={ids.courts}>{start.courtsLabel}</label>
      <select id={ids.courts} value={courts} onChange={(e) => setCourts(Number(e.target.value))}>
        {Array.from({ length: MAX_COURTS }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <label htmlFor={ids.names}>{start.namesLabel}</label>
      <textarea
        id={ids.names}
        rows={8}
        value={names}
        placeholder={start.namesPlaceholder}
        aria-describedby={ids.hint}
        onChange={(e) => {
          setNames(e.target.value)
          setError(null)
        }}
      />
      <p className="hint" id={ids.hint}>
        {start.namesHint}
      </p>

      {list.length > 0 && (
        <fieldset className="stack-players">
          <legend>{start.playersLabel}</legend>
          {teams === 'fixed' ? (
            <>
              <p className="hint" id={ids.pairs}>
                {start.pairsHint}
              </p>
              <ol className="stack-pairs">
                {pairs.map(([a, b], i) => (
                  <li key={`${key(a)}|${key(b)}`} role="group" aria-label={start.pairLabel(i + 1)}>
                    <small>{start.pairLabel(i + 1)}</small>
                    {chip(a)}
                    {chip(b)}
                  </li>
                ))}
                {leftover && <li className="stack-leftover">{chip(leftover)}</li>}
              </ol>
            </>
          ) : (
            <div className="stack-chips">{list.map(chip)}</div>
          )}
        </fieldset>
      )}

      {play === 'doubles' && (
        <fieldset className="stack-play stack-teams">
          <legend>{start.teamsLabel}</legend>
          {start.teams.map((t) => (
            <label key={t.id} className="stack-format">
              <input type="radio" name="stack-teams" value={t.id} checked={teams === t.id} onChange={() => choose(play, t.id)} />
              <span>
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset aria-describedby={ids.details}>
        <legend>{start.formatLabel}</legend>
        <div className="stack-formats">
          {(['left', 'right'] as const).map((col) => (
            <div className="stack-formats-col" key={col}>
              {shown
                .filter((f) => f.column === col)
                .map((f) => (
                  <label key={f.id} className="stack-format">
                    <input
                      type="radio"
                      name="stack-format"
                      value={f.id}
                      checked={format === f.id}
                      aria-labelledby={`${ids.fmt}-${f.id}`}
                      aria-describedby={`${ids.fmt}-${f.id}-hint`}
                      onChange={() => setFormat(f.id)}
                    />
                    <span>
                      <span className="stack-format-head">
                        <b id={`${ids.fmt}-${f.id}`}>{f.label}</b>
                        <span className="stack-badge">{f.badge}</span>
                      </span>
                      <small id={`${ids.fmt}-${f.id}-hint`}>{f.hint}</small>
                    </span>
                  </label>
                ))}
            </div>
          ))}
        </div>
        {selected && (
          <p className="stack-format-details" id={ids.details} aria-live="polite">
            {selected.details}
          </p>
        )}
      </fieldset>

      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn main">
        {start.submit}
      </button>
    </form>
  )
}
