import { Link } from 'react-router-dom'
import { site } from '../config/site'

export function Footer() {
  return (
    <footer className="foot">
      <div className="in">
        <span>
          © {new Date().getFullYear()} {site.name} · {site.slogan}
        </span>
        <span>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <a href={site.facebookUrl} target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a href={`mailto:${site.supportEmail}`}>Email us</a>
        </span>
      </div>
    </footer>
  )
}
