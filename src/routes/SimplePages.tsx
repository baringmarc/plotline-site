import { Link } from 'react-router-dom'
import { legalDraftNotice, privacy, site, terms, type LegalPage } from '../config/site'

/** A Terms or Privacy page: title, the draft notice while it applies, then its sections. */
function Legal({ page }: { page: LegalPage }) {
  return (
    <article className="page legal">
      <h1>{page.title}</h1>
      {legalDraftNotice && <p className="hint draft">{legalDraftNotice}</p>}
      <p className="hint">Last updated {page.updated}</p>
      <p>{page.intro}</p>
      {page.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.list && (
            <ul>
              {s.list.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  )
}

export function TermsPage() {
  return <Legal page={terms(site.supportEmail)} />
}

export function PrivacyPage() {
  return <Legal page={privacy(site.supportEmail)} />
}

export function NotFoundPage() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </div>
  )
}
