import { useEffect, useRef, useState, type FormEvent } from 'react'
import { validateReview, type ReviewPayload } from '../../lib/siteForms'
import { useSendReview } from './hooks'

type Fields = Omit<ReviewPayload, 'started'>

const EMPTY: Fields = { name: '', venue: '', quote: '', role: 'player', rating: 0, consent: false, website: '' }

export function ReviewForm() {
  const [f, setF] = useState<Fields>(EMPTY)
  const [clientError, setClientError] = useState<string | null>(null)
  const started = useRef(0)
  const form = useRef<HTMLFormElement>(null)
  const send = useSendReview()

  // The form opens from a button; bring it into view.
  useEffect(() => {
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payload: ReviewPayload = { ...f, started: started.current }
    const check = validateReview(payload)
    if (!check.ok) {
      setClientError(check.error)
      return
    }
    setClientError(null)
    send.mutate(payload)
  }

  if (send.isSuccess) {
    return (
      <div className="card rvform okmsg" role="status">
        <div className="tick" aria-hidden="true">
          ⭐
        </div>
        <h3>{send.data.message}</h3>
      </div>
    )
  }

  const error = clientError ?? (send.error ? send.error.message : null)

  return (
    <form
      ref={form}
      className="card rvform stack"
      onSubmit={onSubmit}
      onFocus={() => {
        if (started.current === 0) started.current = Date.now()
      }}
      noValidate
    >
      <h3 style={{ margin: 0 }}>Write a review</h3>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Rating</legend>
        <div className="starpick">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= f.rating ? 'on' : ''}
              aria-label={n === 1 ? '1 star' : `${n} stars`}
              aria-pressed={n === f.rating}
              onClick={() => set('rating', n)}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label className="f">
        Your name
        <input maxLength={60} placeholder="e.g. Ana R." value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
      </label>
      <div className="radios" role="radiogroup" aria-label="I am a">
        <label>
          <input type="radio" name="rvrole" checked={f.role === 'player'} onChange={() => set('role', 'player')} /> Player
        </label>
        <label>
          <input type="radio" name="rvrole" checked={f.role === 'owner'} onChange={() => set('role', 'owner')} /> Venue owner
        </label>
      </div>
      <label className="f">
        <span>
          Venue <small>(optional)</small>
        </span>
        <input
          maxLength={80}
          placeholder="Where you play, or the venue you run"
          value={f.venue}
          onChange={(e) => set('venue', e.target.value)}
        />
      </label>
      <label className="f">
        Your review
        <textarea rows={3} maxLength={400} value={f.quote} onChange={(e) => set('quote', e.target.value)} />
      </label>
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
        <span>You may show my review and first name on this site.</span>
      </label>
      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}
      <button className="btn main full" type="submit" disabled={send.isPending}>
        {send.isPending ? 'Sending...' : 'Send review'}
      </button>
    </form>
  )
}
