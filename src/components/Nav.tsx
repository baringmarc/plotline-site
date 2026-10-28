import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contactAnchor, messageLink, nav, navLinks, site } from '../config/site'

/** Sticky top bar. On a phone the links fold into a menu button beside the contact button. */
export function Nav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={open ? 'nav open' : 'nav'}>
      <div className="in">
        <Link className="logo" to="/" onClick={() => setOpen(false)}>
          <img src="/logo.svg" alt="" />
          <span>
            {site.name} {site.nameSuffix && <b>{site.nameSuffix}</b>}
          </span>
        </Link>
        <nav className="navlinks" aria-label="Main">
          {navLinks.map((l) => (
            <a key={l.href} className="l" href={`/${l.href}`}>
              {l.label}
            </a>
          ))}
          <a className="btn main navcta" href={`/${contactAnchor}`}>
            {nav.cta}
          </a>
          <button
            type="button"
            className="menubtn"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="menupanel"
            onClick={() => setOpen((o) => !o)}
          >
            <span />
          </button>
        </nav>
      </div>
      <div className="menupanel" id="menupanel">
        {navLinks.map((l) => (
          <a key={l.href} href={`/${l.href}`} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
        {/* a new tab only for Messenger; the email fallback opens the mail app */}
        <a
          href={messageLink}
          {...(site.messengerUrl ? { target: '_blank', rel: 'noreferrer' } : {})}
          onClick={() => setOpen(false)}
        >
          {nav.messenger}
        </a>
      </div>
    </header>
  )
}
