// Drawn phone screens for the player's walkthrough, in the app's dark theme.
// Decorative: each step has a screen-reader-only description (`alt` in site.ts) beside its drawing.
import { peso, playerSide, pricing, type ScreenMock } from '../../config/site'

const { sample, mocks } = playerSide

/** Which cells of the booking grid (hour row, court column) are booked, and which two the player picked. */
const TAKEN = new Set(['0-1', '1-0', '1-1', '2-2', '4-1'])
const PICKED = new Set(['1-1', '2-1'])

function cellClass(row: number, col: number): string {
  const key = `${row}-${col}`
  return PICKED.has(key) ? 'picked' : TAKEN.has(key) ? 'taken' : 'free'
}

function Pick() {
  return (
    <>
      <div className="scr-head">
        {mocks.findTitle}
        <small>{mocks.findSub}</small>
      </div>
      <div className="scr-days">
        {mocks.days.map((d, i) => (
          <span key={d} className={i === 1 ? 'on' : undefined}>
            {d}
          </span>
        ))}
      </div>
      <div className="scr-grid">
        <span />
        {mocks.findCourts.map((c) => (
          <b key={c}>{c}</b>
        ))}
        {mocks.findHours.map((h, r) => (
          <div key={h} style={{ display: 'contents' }}>
            <i>{h}</i>
            {mocks.findCourts.map((c, i) => (
              <span key={c} className={`scr-cell ${cellClass(r, i)}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="scr-key">
        <span>
          <span className="scr-cell free" />
          {mocks.open}
        </span>
        <span>
          <span className="scr-cell taken" />
          {mocks.booked}
        </span>
        <span>
          <span className="scr-cell picked" />
          {mocks.picked}
        </span>
      </div>
      <div className="scr-sum">
        <div>
          <span>{mocks.hoursPicked}</span>
          <b>{peso(sample.courtPrice)}</b>
        </div>
        <div className="scr-btn">{mocks.continue}</div>
      </div>
    </>
  )
}

function Pay() {
  return (
    <>
      <div className="scr-head">
        {mocks.payTitle}
        <small>{mocks.paySub}</small>
      </div>
      <div className="scr-body">
        <div className="scr-row">
          <span>{mocks.court(sample.hours)}</span>
          <span>{peso(sample.courtPrice)}</span>
        </div>
        <div className="scr-row">
          <span>{mocks.fee}</span>
          <span>{peso(pricing.bookingFee)}</span>
        </div>
        <div className="scr-row tot">
          <span>{mocks.total}</span>
          <span>{peso(sample.courtPrice + pricing.bookingFee)}</span>
        </div>
        <div className="scr-chips">
          {mocks.methods.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="scr-pay">
          <img src="/demo/qr.svg" alt="" width={52} height={52} loading="lazy" />
          <div>
            <b>{mocks.qrTitle}</b>
            <span>{mocks.qrNote}</span>
          </div>
        </div>
      </div>
      <div className="scr-sum">
        <div className="scr-btn">{mocks.payButton}</div>
      </div>
    </>
  )
}

function Confirmed() {
  return (
    <>
      <div className="scr-head">
        {mocks.confirmedTitle}
        <small>{mocks.findTitle}</small>
      </div>
      <div className="scr-body">
        <div className="scr-badge">{mocks.confirmed}</div>
        <div className="scr-row">
          <span>{sample.court}</span>
          <span>{sample.hoursLabel}</span>
        </div>
        <div className="scr-row">
          <span>{sample.day}</span>
          <span>{peso(sample.courtPrice + pricing.bookingFee)}</span>
        </div>
        <div className="scr-row">
          <span>{mocks.reference}</span>
          <span>{sample.reference}</span>
        </div>
      </div>
    </>
  )
}

function Link() {
  return (
    <>
      <div className="scr-head">
        {mocks.linkTitle}
        <small>{mocks.linkBody}</small>
      </div>
      <div className="scr-body">
        <div className="scr-url">{sample.link}</div>
      </div>
      <div className="scr-sum">
        <div className="scr-btn">{mocks.copy}</div>
      </div>
    </>
  )
}

const SCREENS: Record<ScreenMock, () => React.JSX.Element> = { pick: Pick, pay: Pay, confirmed: Confirmed, link: Link }

export function PlayerScreen({ mock }: { mock: ScreenMock }) {
  const Screen = SCREENS[mock]
  return (
    <div className="scr" aria-hidden="true">
      <Screen />
    </div>
  )
}
