// The static sections of the landing page, top to bottom. Their words come from config/site.ts.
import { PhoneMockup } from '../../components/PhoneMockup'
import { Slider } from '../../components/Slider'
import {
  audiences,
  faqs,
  features,
  hero,
  openPlay,
  plans,
  site,
  steps,
  venues,
  type Venue,
} from '../../config/site'

export function Hero() {
  return (
    <section className="hero">
      <div className="in">
        <div>
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1>{hero.title}</h1>
          <p className="lead">{hero.lead}</p>
          <div className="ctas">
            <a className="btn main" href="#signup">
              {hero.primaryCta} →
            </a>
            <a className="btn ghost" href={site.demoUrl} target="_blank" rel="noreferrer">
              {hero.secondaryCta}
            </a>
          </div>
          <ul className="points">
            {hero.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <PhoneMockup />
      </div>
    </section>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function VenueCard({ venue }: { venue: Venue }) {
  const body = (
    <>
      <span className="badge">{venue.logoUrl ? <img src={venue.logoUrl} alt="" loading="lazy" /> : initials(venue.name)}</span>
      <span>
        <b>{venue.name}</b>
        <small>{venue.location}</small>
      </span>
    </>
  )
  return venue.url ? (
    <a className="card venue" href={venue.url} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <div className="card venue">{body}</div>
  )
}

export function Venues() {
  return (
    <section id="venues">
      <div className="in">
        <h2 className="title">Venues already booking online</h2>
        <p className="sub">Tap one to see its booking page the way players see it.</p>
        <Slider label="Venues" twoRows={venues.length >= 4}>
          {venues.map((v) => (
            <VenueCard key={v.name} venue={v} />
          ))}
        </Slider>
      </div>
    </section>
  )
}

export function Audiences() {
  return (
    <section className="white">
      <div className="in">
        <h2 className="title">Easier for your players and for you</h2>
        <p className="sub">One booking page, two kinds of people who are glad it exists.</p>
        <div className="grid2">
          {audiences.map((a) => (
            <div key={a.title} className="card">
              <h3>{a.title}</h3>
              <ul className="ticks">
                {a.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function OpenPlay() {
  return (
    <section className="op" id="openplay">
      <div className="in">
        <h2 className="title">{openPlay.title}</h2>
        <p className="sub">{openPlay.lead}</p>
        <div className="chips">
          {openPlay.points.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Features() {
  return (
    <section id="features">
      <div className="in">
        <h2 className="title">Everything a court venue needs</h2>
        <p className="sub">Nothing you have to learn. Your staff can use it on day one.</p>
        <div className="grid3">
          {features.map((f) => (
            <div key={f.title} className="card feature">
              <span className="ico" aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Pricing() {
  return (
    <section className="white" id="pricing">
      <div className="in">
        <h2 className="title">Simple monthly pricing</h2>
        <p className="sub">Every plan starts with a {site.trialDays}-day free trial.</p>
        <div className="grid3">
          {plans.map((p) => (
            <div key={p.name} className={p.highlight ? 'card plan hl' : 'card plan'}>
              {p.highlight && <span className="tag">Most popular</span>}
              <h3>{p.name}</h3>
              <div className="price">
                {p.price} <small>{p.period}</small>
              </div>
              <p className="blurb">{p.blurb}</p>
              <ul className="ticks">
                {p.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
              <a className={p.highlight ? 'btn main full' : 'btn dark full'} href="#signup">
                Start free trial
              </a>
            </div>
          ))}
        </div>
        <p className="note">Prices in PHP. Open play is an add-on you can turn on at sign-up.</p>
      </div>
    </section>
  )
}

export function Steps() {
  return (
    <section>
      <div className="in">
        <h2 className="title">Live in three steps</h2>
        <p className="sub">Most venues take their first online booking the same week.</p>
        <div className="grid3">
          {steps.map((s, i) => (
            <div key={s.title} className="card step">
              <span className="num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Demo() {
  return (
    <section id="demo" style={{ padding: '8px 0 20px' }}>
      <div className="in">
        <div className="card demo">
          <div>
            <h3>Try it as a player</h3>
            <p>Open a sample venue and book a slot. Nothing is charged.</p>
          </div>
          <a className="btn dark" href={site.demoUrl} target="_blank" rel="noreferrer">
            Open the demo →
          </a>
        </div>
      </div>
    </section>
  )
}

export function Faq() {
  return (
    <section id="faq" style={{ paddingTop: 20 }}>
      <div className="in">
        <h2 className="title">Questions</h2>
        <p className="sub">
          Something else? <a href={site.messengerUrl}>Message us</a>.
        </p>
        <div className="faq">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalBand() {
  return (
    <section className="band">
      <div className="in">
        <img src="/logo.svg" alt="" width={56} height={56} />
        <h2>Ready to stop answering “available pa po?”</h2>
        <p>Start your free trial today. We help you set up.</p>
        <a className="btn main" href="#signup">
          {hero.primaryCta} →
        </a>
      </div>
    </section>
  )
}
