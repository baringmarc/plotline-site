// The static sections of the landing page, top to bottom. Their words come from config/site.ts.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PhoneMockup } from '../../components/PhoneMockup'
import { Reveal } from '../../components/Reveal'
import { SectionHead } from '../../components/SectionHead'
import {
  adminDemo,
  adminTour,
  adminTourHead,
  atAGlance,
  contactAnchor,
  costs,
  faqGroups,
  faqHead,
  finalBand,
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
} from '../../config/site'
import { VenueFrame } from './Illustrations'
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
    <section className="white tight" id="short-version">
      <div className="in">
        <Reveal className="short">
          <div>
            <span className="eyebrow">{shortVersion.label}</span>
            <h2 className="title">{withHighlight(shortVersion.title, shortVersion.titleHighlight)}</h2>
            <p>
              {shortVersion.lead} <a href="#pricing">{shortVersion.link}</a>
            </p>
          </div>
          <div>
            <h3 className="get">{withHighlight(get.title, get.titleHighlight)}</h3>
            <div className="chips">
              {get.points.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          </div>
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
        <div className="openplay-strip">
          <div>
            <b>{openPlay.title}</b>
            <span>{openPlay.text}</span>
          </div>
          <div className="chips">
            {openPlay.chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
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

/** A tablist's keys (WAI-ARIA tabs): arrows wrap, Home and End jump. Null for any other key. */
function nextTab(key: string, i: number, last: number): number | null {
  if (key === 'ArrowRight') return i === last ? 0 : i + 1
  if (key === 'ArrowLeft') return i === 0 ? last : i - 1
  if (key === 'Home') return 0
  if (key === 'End') return last
  return null
}

/**
 * "Watch the demo": the silent admin video, click to play. preload="none" and no autoplay, so nothing of the video
 * loads until play; the poster waits until the block nears the viewport (straight away without IntersectionObserver),
 * so the first load fetches nothing new. The captions track is off by default: they are burned into the picture.
 */
export function AdminDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  return (
    <div className="admin-demo" ref={ref}>
      <h3>{adminDemo.title}</h3>
      <p>{adminDemo.caption}</p>
      <video
        controls
        preload="none"
        playsInline
        width={adminDemo.width}
        height={adminDemo.height}
        poster={near ? adminDemo.poster : undefined}
      >
        {adminDemo.sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
        <track kind="captions" src={adminDemo.captions.src} srcLang={adminDemo.captions.srclang} label={adminDemo.captions.label} />
        {adminDemo.fallback}
      </video>
    </div>
  )
}

/** "Your side": a tour of the admin pages, one tab each, with real screenshots. Hidden panels' images are lazy, so they load only when shown. */
export function AdminTour() {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const next = nextTab(e.key, i, adminTour.length - 1)
    if (next === null) return
    e.preventDefault()
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <section className="white" id="features">
      <div className="in">
        <SectionHead label={adminTourHead.label} title={adminTourHead.title} lead={adminTourHead.lead} />
        <div className="admin-tabs" role="tablist" aria-label={adminTourHead.title}>
          {adminTour.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`admin-tab-${t.id}`}
              aria-selected={i === active}
              aria-controls={`admin-panel-${t.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {adminTour.map((t, i) => (
          <div
            key={t.id}
            className="admin-panel"
            role="tabpanel"
            id={`admin-panel-${t.id}`}
            aria-labelledby={`admin-tab-${t.id}`}
            hidden={i !== active}
          >
            <div className="admin-shots">
              {t.shots.map((s, j) => (
                <div key={s.src} className="admin-frame">
                  <div className="browser-bar" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <img
                    src={s.src}
                    alt={s.alt}
                    width={s.width}
                    height={s.height}
                    loading={i === 0 && j === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </div>
              ))}
            </div>
            <div className="admin-text">
              <h3>{t.title}</h3>
              <ul>
                {t.callouts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {t.phone && (
                <div className="admin-phone">
                  <img
                    src={t.phone.src}
                    alt={t.phone.alt}
                    width={t.phone.width}
                    height={t.phone.height}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        <AdminDemo />
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
          <div>
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
            <ChipList label={highlightsAlsoLabel} items={highlightsAlso} />
          </div>
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
        <div className="tiles">
          {costs.stats.map((s, i) => (
            <div key={s.label} className={i === 1 ? 'tile hot' : 'tile'}>
              <div className="k">{s.label}</div>
              <div className="big">{s.value}</div>
              <div className="s">{s.note}</div>
            </div>
          ))}
        </div>
        <ul className="nots" aria-label={moneyFlow.neverBilled}>
          {pricing.notBilled.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <Reveal className="card">
          <h3>{example.title}</h3>
          <p className="card-sub">{example.caption(example.hours, peso(example.ratePerHour))}</p>
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
            <dl className="sum">
              <div>
                <dt>{example.courtPrice}</dt>
                <dd>{peso(worked.courtPrice)}</dd>
              </div>
              <div>
                <dt>{example.fee}</dt>
                <dd>{peso(worked.fee)}</dd>
              </div>
              <div>
                <dt>{example.playerPays}</dt>
                <dd>{peso(worked.playerPays)}</dd>
              </div>
              <div>
                <dt>{example.venueKeeps}</dt>
                <dd>{peso(worked.venueKeeps)}</dd>
              </div>
            </dl>
          </div>
        </Reveal>
        <Reveal className="card" delay={80}>
          <h3>{moneyFlow.label}</h3>
          <p className="card-sub">{moneyFlow.lead}</p>
          <Timeline steps={moneyFlow.steps} marks={['', 'you', 'you', 'inv']} />
          <p className="quiet">{moneyFlow.quiet}</p>
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
        <Timeline steps={steps} marks={['', 'you', 'you', 'inv']} />
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
    const next = nextTab(e.key, i, faqGroups.length - 1)
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
                <summary>
                  {f.q}
                  <span className="chev" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 9l7 7 7-7" />
                    </svg>
                  </span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        ))}
        <p className="more">
          {faqHead.lead} <a href={messageLink}>{faqHead.leadLink}</a>
        </p>
      </div>
    </section>
  )
}

export function AtAGlance() {
  return (
    <section id="at-a-glance">
      <div className="in">
        <SectionHead label={atAGlance.label} title={atAGlance.title} lead={atAGlance.lead} />
        <div className="keys">
          {atAGlance.keyFigures.map((k, i) => (
            <div key={k.label} className={i === 2 ? 'hot' : undefined}>
              <b>{k.value}</b>
              <span>{k.label}</span>
            </div>
          ))}
        </div>
        <div className="groups">
          {atAGlance.groups.map((g) => (
            <div key={g.title} className="grp">
              <h3>{g.title}</h3>
              <dl>
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
      </div>
    </section>
  )
}

export function FinalBand() {
  return (
    <section className="band" id="final">
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
