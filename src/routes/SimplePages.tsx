import { Link } from 'react-router-dom'
import { site } from '../config/site'

// Placeholders. Have the real Terms and Privacy Policy written for your business before launch
// (in the Philippines, the privacy notice should follow the Data Privacy Act of 2012).

export function TermsPage() {
  return (
    <div className="page">
      <h1>Terms of Service</h1>
      <p className="hint">Placeholder. Replace with your own terms before launch.</p>
      <p>These terms cover your use of {site.name} as a venue owner.</p>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <div className="page">
      <h1>Privacy Policy</h1>
      <p className="hint">Placeholder. Replace with your own privacy notice before launch.</p>
      <p>
        Questions about your data: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
      </p>
    </div>
  )
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
