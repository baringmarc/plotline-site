// The static sections of the landing page, top to bottom. Their words come from config/site.ts.
import { useRef, useState, type KeyboardEvent } from 'react'
import { PhoneMockup } from '../../components/PhoneMockup'
import { Reveal } from '../../components/Reveal'
import { SectionHead } from '../../components/SectionHead'
import { Slider } from '../../components/Slider'
import {
  atAGlance,
  contactAnchor,
  costs,
  faqGroups,
  faqHead,
  finalBand,
  features,
  featuresAlso,
  featuresAlsoLabel,
  featuresHead,
  hero,
  highlights,
  highlightsAlso,
  highlightsAlsoLabel,
  highlightsHead,
  messageLink,
  moneyFlow,
  openPlay,
  peso,
  playerSide,
  pricing,
  shortVersion,
  site,
  steps,
  stepsHead,
  venues,
  venuesHead,
  type Venue,
} from '../../config/site'
import { TodayGrid, VenueFrame } from './Illustrations'
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
          <div className="ctas">
            <a className="btn main" href={contactAnchor}>
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
  const { get } = shortVersion
  return (
    <section className="white" id="short-version">
      <div className="in">
        <SectionHead label={shortVersion.label} title={shortVersion.title} lead={shortVersion.lead} />
        <Reveal className="card short">
          <h3>{get.title}</h3>
          <div className="chips">
            {get.points.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
          <p className="center midcta">
            <a href="#pricing">{shortVersion.link}</a>
          </p>
        </Reveal>
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
        <SectionHead label={venuesHead.label} title={venuesHead.title} lead={venuesHead.lead} />
        {/* a few venues sit in one centred row; a longer list becomes a swipeable slider */}
        {venues.length > 3 ? (
          <Slider label="Venues" twoRows={venues.length >= 4}>
            {venues.map((v) => (
              <VenueCard key={v.name} venue={v} />
            ))}
          </Slider>
        ) : (
          <div className="venuerow">
            {venues.map((v) => (
              <VenueCard key={v.name} venue={v} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function PlayerSide() {
  const total = playerSide.steps.length
  return (
    <section id="players">
      <div className="in">
        <SectionHead label={playerSide.label} title={playerSide.title} lead={playerSide.lead} />
        {/* one swipeable row on phones, four columns on wide screens */}
        <ol className="walk" aria-label={playerSide.label}>
          {playerSide.steps.map((s, i) => (
            <li key={s.title}>
              <div className="frame">
                <PlayerScreen mock={s.mock} />
                <span className="sr-only">{s.alt}</span>
              </div>
              <span className="eyebrow">{playerSide.stepLabel(i + 1, total)}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="openplay-strip">{openPlay.text}</p>
      </div>
    </section>
  )
}

/** A labelled row of short items under a card grid. */
function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="also">
      <h3>{label}</h3>
      <div className="chips">
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="white" id="features">
      <div className="in">
        <SectionHead label={featuresHead.label} title={featuresHead.title} lead={featuresHead.lead} />
        <div className="side-split">
          <div className="side-items">
            {features.map((f, i) => (
              <Reveal key={f.title} className="side-item" delay={i * 80}>
                <span className="ico" aria-hidden="true">
                  {f.icon}
                </span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <TodayGrid />
        </div>
        <ChipList label={featuresAlsoLabel} items={featuresAlso} />
      </div>
    </section>
  )
}

export function Highlights() {
  return (
    <section id="venue">
      <div className="in">
        <SectionHead label={highlightsHead.label} title={highlightsHead.title} lead={highlightsHead.lead} />
        <div className="venue-split">
          <VenueFrame />
          <ol className="venue-list">
            {highlights.map((h, i) => (
              <li key={h.title}>
                <Reveal delay={i * 80}>
                  <h3>{h.title}</h3>
                  <p>{h.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
        <ChipList label={highlightsAlsoLabel} items={highlightsAlso} />
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
        <div className="nots">
          <span id="nots-label">{moneyFlow.neverBilled}</span>
          <ul aria-labelledby="nots-label">
            {pricing.notBilled.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <Reveal className="card">
          <h3>{example.title}</h3>
          <p className="hint">{example.caption(example.hours, peso(example.ratePerHour))}</p>
          <div className="ex">
            <div className="bar-wrap">
              <div className="paysline">
                {example.playerPaysLine} {peso(worked.playerPays)}
              </div>
              <div
                className="stack"
                role="img"
                aria-label={`${example.courtLabel} ${peso(worked.courtPrice)} plus ${example.feeLabel.toLowerCase()} ${peso(worked.fee)}`}
              >
                <div className="court">
                  {example.courtLabel} {peso(worked.courtPrice)}
                </div>{' '}
                <div className="fee">
                  {example.feeLabel} {peso(worked.fee)}
                </div>
              </div>
              <div className="brace" aria-hidden="true">
                <span className="a">
                  {example.venueKeeps} {peso(worked.venueKeeps)}
                </span>
                <span className="b">{example.ourFee}</span>
              </div>
              <p className="hint">{example.notToScale}</p>
            </div>
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
          </div>
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
        <Reveal className="card" delay={80}>
          <h3>{moneyFlow.label}</h3>
          <Timeline steps={moneyFlow.steps} marks={['', 'you', 'you', 'inv']} />
          <p className="quiet">{moneyFlow.quiet}</p>
        </Reveal>
        <p className="center midcta">
          <a className="btn main" href={contactAnchor}>
            {costs.cta} →
          </a>
        </p>
      </div>
    </section>
  )
}

/** A numbered sequence: stacked with a line down the side on phones, a row from 760px. `marks` colours a step's number. */
function Timeline({ steps, marks = [] }: { steps: { title: string; body: string }[]; marks?: string[] }) {
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={s.title} className={marks[i] || undefined}>
          <span className="num" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <b>{s.title}</b>
            <span>{s.body}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function Steps() {
  return (
    <section id="start">
      <div className="in">
        <SectionHead label={stepsHead.label} title={stepsHead.title} lead={stepsHead.lead} />
        <Timeline steps={steps} />
      </div>
    </section>
  )
}

export function Faq() {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (i: number) => {
    setActive(i)
    tabs.current[i]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const last = faqGroups.length - 1
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    select(next)
  }

  return (
    <section className="white" id="faq">
      <div className="in">
        <SectionHead
          label={faqHead.label}
          title={faqHead.title}
          lead={
            <>
              {faqHead.lead} <a href={messageLink}>{faqHead.leadLink}</a>.
            </>
          }
        />
        <div className="faq-tabs" role="tablist" aria-label={faqHead.title}>
          {faqGroups.map((g, i) => (
            <button
              key={g.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`faq-tab-${g.id}`}
              aria-selected={i === active}
              aria-controls={`faq-panel-${g.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {g.label}
            </button>
          ))}
        </div>
        {faqGroups.map((g, i) => (
          <div
            key={g.id}
            className="faq"
            role="tabpanel"
            id={`faq-panel-${g.id}`}
            aria-labelledby={`faq-tab-${g.id}`}
            hidden={i !== active}
          >
            {g.items.map((f, j) => (
              <details key={f.q} open={j === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function AtAGlance() {
  return (
    <section id="at-a-glance">
      <div className="in narrow">
        <SectionHead label={atAGlance.label} title={atAGlance.title} lead={atAGlance.lead} />
        <div className="keys">
          {atAGlance.keyFigures.map((k, i) => (
            <div key={k.label} className={i === 2 ? 'hot' : undefined}>
              <b>{k.value}</b>
              <span>{k.label}</span>
            </div>
          ))}
        </div>
        {atAGlance.groups.map((g) => (
          <div key={g.title} className="glance-group">
            <h3>{g.title}</h3>
            <dl className="facts">
              {g.rows.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

export function FinalBand() {
  return (
    <section className="band">
      <div className="in">
        <img src="/logo.svg" alt="" width={56} height={56} />
        <h2>{finalBand.title}</h2>
        <p>{finalBand.body}</p>
        <a className="btn main" href={contactAnchor}>
          {hero.primaryCta} →
        </a>
      </div>
    </section>
  )
}
