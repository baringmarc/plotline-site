import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { courtOptions, site } from '../../config/site'
import { validateSignup, type SignupPayload } from '../../../supabase/functions/_shared/validate.ts'
import { useRegisterVenue } from './hooks'

type Fields = Omit<SignupPayload, 'started'>

const EMPTY: Fields = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  venueName: '',
  location: '',
  courts: 2,
  facebook: '',
  message: '',
  // Open play is free now (no add-on); the old local validator still expects the field until T1.8 removes it.
  openPlayAddon: false,
  password: '',
  password2: '',
  agreeTerms: false,
  agreeCertify: false,
  website: '',
}

export function SignupSection() {
  return (
    <section className="signup" id="signup">
      <div className="in">
        <h2 className="title">Start your {site.trialDays}-day free trial</h2>
        <p className="sub">Tell us about your venue. We confirm your email, then set up your booking page.</p>
        <SignupForm />
      </div>
    </section>
  )
}

export function SignupForm() {
  const [f, setF] = useState<Fields>(EMPTY)
  const [clientError, setClientError] = useState<string | null>(null)
  // When the visitor first touches the form; the server rejects forms filled faster than a person can.
  const started = useRef(0)
  const register = useRegisterVenue()

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }))
  const markStarted = () => {
    if (started.current === 0) started.current = Date.now()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payload: SignupPayload = { ...f, started: started.current }
    const check = validateSignup(payload)
    if (!check.ok) {
      setClientError(check.error)
      return
    }
    setClientError(null)
    register.mutate(payload)
  }

  if (register.isSuccess) {
    return (
      <div className="card formcard okmsg" role="status">
        <div className="tick" aria-hidden="true">
          ✉️
        </div>
        <h2 style={{ margin: '0 0 8px' }}>Check your email</h2>
        <p>
          We sent a confirmation link to <b>{register.data.email || 'your email'}</b>. Click it to confirm, and we will set
          up your booking page.
        </p>
        <p className="hint">Not there after a few minutes? Check your Spam or Promotions folder.</p>
      </div>
    )
  }

  const error = clientError ?? (register.error ? register.error.message : null)

  return (
    <form className="card formcard stack" onSubmit={onSubmit} onFocus={markStarted} noValidate>
      <div className="fields">
        <label className="f">
          First name
          <input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" required />
        </label>
        <label className="f">
          Last name
          <input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" required />
        </label>
        <label className="f">
          Email
          <input
            type="email"
            inputMode="email"
            value={f.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="f">
          Mobile number
          <input
            type="tel"
            inputMode="tel"
            placeholder="0917 123 4567"
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            autoComplete="tel"
            required
          />
        </label>
        <label className="f wide">
          Venue name
          <input
            placeholder="e.g. Sample Pickle Park"
            value={f.venueName}
            onChange={(e) => set('venueName', e.target.value)}
            autoComplete="organization"
            required
          />
        </label>
        <label className="f">
          City or town
          <input placeholder="e.g. Pasig" value={f.location} onChange={(e) => set('location', e.target.value)} required />
        </label>
        <label className="f">
          Number of courts
          <select value={f.courts} onChange={(e) => set('courts', Number(e.target.value))}>
            {courtOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="f wide">
          <span>
            Facebook page <small>(optional)</small>
          </span>
          <input
            inputMode="url"
            placeholder="facebook.com/yourvenue"
            value={f.facebook}
            onChange={(e) => set('facebook', e.target.value)}
          />
        </label>
        <label className="f">
          Password
          <input
            type="password"
            value={f.password}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="f">
          Repeat password
          <input
            type="password"
            value={f.password2}
            onChange={(e) => set('password2', e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="f wide">
          <span>
            Anything we should know? <small>(optional)</small>
          </span>
          <textarea
            rows={2}
            placeholder="Opening hours, rates, open play plans, questions..."
            value={f.message}
            onChange={(e) => set('message', e.target.value)}
          />
        </label>
      </div>

      {/* Honeypot: off-screen and skipped by keyboard and password managers. */}
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            value={f.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={f.agreeTerms} onChange={(e) => set('agreeTerms', e.target.checked)} />
        <span>
          I agree to the <Link to="/terms">Terms</Link> and the <Link to="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={f.agreeCertify} onChange={(e) => set('agreeCertify', e.target.checked)} />
        <span>I own or manage this venue, or I am allowed to sign it up.</span>
      </label>

      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}

      <button className="btn main full" type="submit" disabled={register.isPending}>
        {register.isPending ? 'Creating your account...' : 'Start my free trial →'}
      </button>
    </form>
  )
}
