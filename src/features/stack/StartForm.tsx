import { useId, useState, type FormEvent } from 'react'
import { paddleStack } from '../../config/paddleStack'
import { locksOffered, MAX_COURTS, MAX_TITLE, StackError, type NewPlayer } from './engine'
import { parseNames } from './parseNames'
import { formatsFor, startSession } from './startOptions'
import type { Format, Level, Play, Session } from './types'

const { start, formats } = paddleStack
const key = (name: string) => name.toLocaleLowerCase()

/** The start screen (T8.5, T8.9): title, play, courts, players with levels and locked pairs, and the rotation. */
export function StartForm({ onStart }: { onStart: (s: Session) => void }) {
  const [title, setTitle] = useState('')
  const [play, setPlay] = useState<Play>('doubles')
  const [courts, setCourts] = useState(2)
  const [format, setFormat] = useState<Format>('fair')
  const [names, setNames] = useState('')
  const [levels, setLevels] = useState<Record<string, Level>>({})
  /** Locked pairs, by name key; a pair whose names leave the list is ignored. */
  const [pairs, setPairs] = useState<[string, string][]>([])
  const [error, setError] = useState<string | null>(null)
  const ids = {
    title: useId(),
    courts: useId(),
    names: useId(),
    hint: useId(),
    details: useId(),
    pairsHint: useId(),
    fmt: useId(),
  }

  const list = parseNames(names)
  const offered = formatsFor(play)
  const shown = formats.filter((f) => offered.includes(f.id))
  const selected = formats.find((f) => f.id === format)
  const locks = locksOffered(play, format)
  const byKey = new Map(list.map((n) => [key(n), n]))
  /** The pairs still in the list (both names listed), shown and used only where locks are offered. */
  const listed = pairs.filter(([a, b]) => byKey.has(a) && byKey.has(b))
  const partnerOf = new Map(listed.flatMap(([a, b]) => [[a, b], [b, a]] as const))

  /** A play change can hide the chosen format: it resets to Fair rotation, which both plays offer. */
  const choosePlay = (next: Play) => {
    setPlay(next)
    setError(null)
    if (!formatsFor(next).includes(format)) setFormat('fair')
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
    try {
      onStart(
        startSession({
          title,
          play,
          format,
          courts,
          players: list.map(withLevel),
          pairs: listed.map(([a, b]) => [byKey.get(a)!, byKey.get(b)!]),
        }),
      )
    } catch (err) {
      if (err instanceof StackError && err.code === 'needs-pair') setError(start.needAllPairs)
      else throw err
    }
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
      {locks && !partnerOf.has(key(name)) && (
        <select
          className="stack-pair-pick"
          aria-label={start.pairWith(name)}
          value=""
          onChange={(e) => {
            const other = e.target.value
            if (!other) return
            setPairs((prev) => [...prev.filter(([a, b]) => byKey.has(a) && byKey.has(b)), [key(name), key(other)]])
            setError(null)
          }}
        >
          <option value="">{start.pairPlaceholder}</option>
          {list
            .filter((n) => n !== name && !partnerOf.has(key(n)))
            .map((n) => (
              <option key={key(n)} value={n}>
                {n}
              </option>
            ))}
        </select>
      )}
    </span>
  )

  /** The chips in list order; a locked pair shows as one group where its first partner is listed. */
  const chips = () =>
    list.map((name) => {
      const partner = locks ? partnerOf.get(key(name)) : undefined
      if (!partner) return chip(name)
      const other = byKey.get(partner)!
      if (list.indexOf(other) < list.indexOf(name)) return null
      const label = `${name} & ${other}`
      return (
        <span className="stack-pair-group" role="group" aria-label={label} key={`${key(name)}|${partner}`}>
          {chip(name)}
          {chip(other)}
          <button
            type="button"
            className="chipbtn"
            aria-label={`${start.unlock} ${label}`}
            onClick={() => setPairs((prev) => prev.filter(([a, b]) => a !== key(name) && b !== key(name)))}
          >
            {start.unlock}
          </button>
        </span>
      )
    })

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
              onChange={() => choosePlay(p.id)}
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
        <fieldset className="stack-players" aria-describedby={locks ? ids.pairsHint : undefined}>
          <legend>{start.playersLabel}</legend>
          {locks && (
            <p className="hint" id={ids.pairsHint}>
              {start.pairsHint}
            </p>
          )}
          <div className="stack-chips">{chips()}</div>
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
                      onChange={() => {
                        setFormat(f.id)
                        setError(null)
                      }}
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
