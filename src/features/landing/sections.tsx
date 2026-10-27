// The static sections of the landing page, top to bottom. Their words come from config/site.ts.
import { PhoneMockup } from '../../components/PhoneMockup'
import { Reveal } from '../../components/Reveal'
import { SectionHead } from '../../components/SectionHead'
import { Slider } from '../../components/Slider'
import {
  costs,
  faqs,
  features,
  featuresHead,
  hero,
  moneyFlow,
  openPlay,
  peso,
  playerSide,
  pricing,
  shortVersion,
  site,
  steps,
  venues,
  type Venue,
} from '../../config/site'
import { PlayerScreen } from './PlayerScreens'
import { feeComparison, workedExample } from './pricing'

export function Hero() {
  return (
    <section className="hero">
      <div className="in">
        <div>
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1>{withHighlight(hero.title, hero.titleHighlight)}</h1>
          <p className="lead">{hero.lead}</p>
          <div className="promises">
            <span className="eyebrow">{hero.promisesLabel}</span>
            <ul className="ticks">
              {hero.promises.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="stats">
            {hero.stats.map((s) => (
              <div key={s.label} className="stat">
                <span className="lbl">{s.label}</span>
                <span className="big">{s.value}</span>
                <small>{s.note}</small>
              </div>
            ))}
          </div>
          <div className="ctas">
            <a className="btn main" href="#signup">
              {hero.primaryCta} →
            </a>
            <a className="btn ghost" href={site.demoUrl} target="_blank" rel="noreferrer">
              {hero.secondaryCta}
            </a>
          </div>
        </div>
        <PhoneMockup />
      </div>
    </section>
  )
}

export function ShortVersion() {
  const { get, cost } = shortVersion
  return (
    <section className="white" id="short-version">
      <div className="in">
        <SectionHead label={shortVersion.label} title={shortVersion.title} lead={shortVersion.lead} />
        <div className="grid2">
          <Reveal className="card">
            <h3>{get.title}</h3>
            <ul className="ticks">
              {get.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="card" delay={80}>
            <h3>{cost.title}</h3>
            <ul className="ticks">
              {cost.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <ul className="ticks crosses">
              {cost.notCharged.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Reveal>
        </div>
        <p className="money">{shortVersion.money}</p>
      </div>
    </section>
  )
}

/** Shows `words` inside `text` in the brand's highlight colour. */
function withHighlight(text: string, words: string) {
  const at = words ? text.indexOf(words) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <em>{words}</em>
      {text.slice(at + words.length)}
    </>
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

export function PlayerSide() {
  const total = playerSide.steps.length
  return (
    <section className="white" id="players">
      <div className="in">
        <SectionHead label={playerSide.label} title={playerSide.title} lead={playerSide.lead} />
        {/* one swipeable row on phones, five columns on wide screens */}
        <ol className="walk" aria-label={playerSide.label}>
          {playerSide.steps.map((s, i) => (
            <li key={s.title}>
              <div className="frame">
                {s.image ? (
                  <img src={s.image.src} width={s.image.width} height={s.image.height} alt={s.image.alt} loading="lazy" />
                ) : (
                  s.mock && <PlayerScreen mock={s.mock} />
                )}
              </div>
              <span className="eyebrow">{playerSide.stepLabel(i + 1, total)}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <Reveal className="card openplay">
          <h3>{openPlay.title}</h3>
          <p>{openPlay.lead}</p>
          <div className="chips">
            {openPlay.points.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function Features() {
  return (
    <section id="features">
      <div className="in">
        <SectionHead label={featuresHead.label} title={featuresHead.title} lead={featuresHead.lead} />
        <div className="grid3">
          {features.map((f, i) => (
            // staggered by column, so each row of three fades in left to right
            <Reveal key={f.title} className="card feature" delay={(i % 3) * 80}>
              <span className="ico" aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Costs() {
  const { example, compare } = costs
  const worked = workedExample(example.ratePerHour, example.hours, pricing.bookingFee)
  const rows = feeComparison(compare.courtPrices, pricing.bookingFee, compare.percent)
  return (
    <section className="white" id="pricing">
      <div className="in">
        <SectionHead label={costs.label} title={costs.title} lead={costs.lead} />
        <div className="stats center-stats">
          {costs.stats.map((s) => (
            <div key={s.label} className="stat">
              <span className="lbl">{s.label}</span>
              <span className="big">{s.value}</span>
              <small>{s.note}</small>
            </div>
          ))}
        </div>
        <div className="grid2">
          <Reveal className="card">
            <h3>{example.title}</h3>
            <p className="hint">{example.caption(example.hours, peso(example.ratePerHour))}</p>
            <dl className="facts sums">
              <div>
                <dt>{example.courtPrice}</dt>
                <dd>{peso(worked.courtPrice)}</dd>
              </div>
              <div>
                <dt>{example.fee}</dt>
                <dd>+ {peso(worked.fee)}</dd>
              </div>
              <div className="total">
                <dt>{example.playerPays}</dt>
                <dd>{peso(worked.playerPays)}</dd>
              </div>
              <div className="total">
                <dt>{example.venueKeeps}</dt>
                <dd>{peso(worked.venueKeeps)}</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal className="card" delay={80}>
            <h3>{compare.title}</h3>
            <div className="tablewrap">
              <table className="ptable">
                <thead>
                  <tr>
                    <th scope="col">{compare.columns.courtPrice}</th>
                    <th scope="col">{compare.columns.flat}</th>
                    <th scope="col">{compare.columns.percentage(compare.percent)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.courtPrice}>
                      <th scope="row">{peso(r.courtPrice)}</th>
                      <td className="ours">{peso(r.flat)}</td>
                      <td>{peso(r.percentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">{compare.note(compare.percent)}</p>
          </Reveal>
        </div>
        <p className="center midcta">
          <a className="btn main" href="#signup">
            {costs.cta} →
          </a>
        </p>
      </div>
    </section>
  )
}

export function MoneyFlow() {
  return (
    <section className="dark" id="money">
      <div className="in">
        <SectionHead label={moneyFlow.label} title={moneyFlow.title} />
        <ol className="flow">
          {moneyFlow.steps.map((s, i) => (
            <li key={s.title}>
              <Reveal className="card step" delay={i * 80}>
                <span className="num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <div className="card never">
          <h3>{moneyFlow.neverBilled}</h3>
          <ul className="ticks crosses">
            {pricing.notBilled.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="money">{moneyFlow.quiet}</p>
        </div>
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
