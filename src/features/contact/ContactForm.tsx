import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SectionHead } from '../../components/SectionHead'
import { Turnstile } from '../../components/Turnstile'
import { contact, site } from '../../config/site'
import { MAX_COURTS, validateContact, type ContactPayload } from '../../lib/siteForms'
import { turnstileSiteKey } from '../../lib/turnstile'
import { useSendContact } from './hooks'

type Fields = Omit<ContactPayload, 'started' | 'turnstileToken' | 'courts'> & { courts: string }

const EMPTY: Fields = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  venueName: '',
  location: '',
  courts: '',
  facebook: '',
  message: '',
  consent: false,
  website: '',
}

export function ContactSection() {
  return (
    <section className="contact" id="contact">
      <div className="in">
        <SectionHead label={contact.label} title={contact.title} lead={contact.lead} />
        <ContactForm siteKey={turnstileSiteKey} />
      </div>
    </section>
  )
}

/** `siteKey` empty: no human check is shown (no key configured yet; the server decides). */
export function ContactForm({ siteKey }: { siteKey: string }) {
  const [f, setF] = useState<Fields>(EMPTY)
  const [token, setToken] = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const [checkFailed, setCheckFailed] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  // When the visitor first touches the form; the server drops forms filled faster than a person can.
  const started = useRef(0)
  const send = useSendContact()
  const t = contact.fields

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }))
  const markStarted = () => {
    if (started.current === 0) started.current = Date.now()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payload: ContactPayload = {
      ...f,
      courts: Number(f.courts),
      started: started.current,
      ...(siteKey ? { turnstileToken: token } : {}),
    }
    const check = validateContact(payload)
    if (!check.ok) return setClientError(check.error)
    if (siteKey && !token) return setClientError(checkFailed ? contact.turnstileFailed : contact.turnstileNeeded)
    setClientError(null)
    send.mutate(payload, {
      // A token works once, so any failed send needs a fresh one.
      onError: () => setResetSignal((n) => n + 1),
    })
  }

  if (send.isSuccess) {
    return (
      <div className="card formcard okmsg" role="status">
        <div className="tick" aria-hidden="true">
          ✓
        </div>
        <h3>{contact.thanksTitle}</h3>
        <p>{contact.thanksBody}</p>
        {site.bookCallUrl && (
          <a className="btn main" href={site.bookCallUrl} target="_blank" rel="noreferrer">
            {contact.bookCall} →
          </a>
        )}
      </div>
    )
  }

  // The load failure has its own notice above, so it isn't repeated here.
  const error = clientError === contact.turnstileFailed ? null : (clientError ?? (send.error ? send.error.message : null))

  return (
    <form className="card formcard stack" onSubmit={onSubmit} onFocus={markStarted} noValidate>
      <div className="fields">
        <label className="f">
          {t.firstName}
          <input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" required />
        </label>
        <label className="f">
          {t.lastName}
          <input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" required />
        </label>
        <label className="f">
          {t.email}
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
          {t.phone}
          <input
            type="tel"
            inputMode="tel"
            placeholder={t.phonePlaceholder}
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            autoComplete="tel"
            required
          />
        </label>
        <label className="f wide">
          {t.venueName}
          <input
            placeholder={t.venueNamePlaceholder}
            value={f.venueName}
            onChange={(e) => set('venueName', e.target.value)}
            autoComplete="organization"
            required
          />
        </label>
        <label className="f">
          {t.location}
          <input placeholder={t.locationPlaceholder} value={f.location} onChange={(e) => set('location', e.target.value)} required />
        </label>
        <label className="f">
          {t.courts}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_COURTS}
            value={f.courts}
            onChange={(e) => set('courts', e.target.value)}
            required
          />
        </label>
        <label className="f wide">
          <span>
            {t.facebook} <small>{t.optional}</small>
          </span>
          <input
            inputMode="url"
            maxLength={200}
            placeholder={t.facebookPlaceholder}
            value={f.facebook}
            onChange={(e) => set('facebook', e.target.value)}
          />
        </label>
        <label className="f wide">
          <span>
            {t.message} <small>{t.optional}</small>
          </span>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder={t.messagePlaceholder}
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
        <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
        <span>
          {contact.consentBefore} <Link to="/privacy">{contact.consentLink}</Link>.
        </span>
      </label>

      {siteKey && (
        <Turnstile
          siteKey={siteKey}
          onToken={setToken}
          resetSignal={resetSignal}
          onLoadError={() => setCheckFailed(true)}
        />
      )}
      {checkFailed && (
        <p className="err" role="alert">
          {contact.turnstileFailed} <a href={site.messengerUrl}>{contact.messageUs}</a>
        </p>
      )}

      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}

      <button className="btn main full" type="submit" disabled={send.isPending}>
        {send.isPending ? contact.sending : `${contact.submit} →`}
      </button>
    </form>
  )
}
