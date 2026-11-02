// Drawn phone screens for the player's walkthrough, in the app's dark theme.
// Decorative: each step has a screen-reader-only description (`alt` in site.ts) beside its drawing.
import { peso, playerSide, pricing, type ScreenMock } from '../../config/site'

const { sample, mocks } = playerSide

function Row({ hour, row }: { hour: string; row: number }) {
  return (
    <>
      <i>{hour}</i>
      {mocks.findCourts.map((c, i) => (
        <span key={c} className={row === 2 && i === 1 ? 'slot on' : row === 1 && i === 2 ? 'slot taken' : 'slot'} />
      ))}
    </>
  )
}

function Pick() {
  return (
    <>
      <b className="mtitle">{mocks.findTitle}</b>
      <span>{mocks.day}</span>
      <div className="mgrid">
        <i />
        {mocks.findCourtsShort.map((c) => (
          <b key={c}>{c}</b>
        ))}
        {mocks.findHours.map((h, r) => (
          <Row key={h} hour={h} row={r} />
        ))}
      </div>
      <span className="mcard">
        <b>{sample.court}</b>
        <br />
        {sample.when}
      </span>
      <dl className="msum">
        <div className="mtotal">
          <dt>{mocks.pickTotal}</dt>
          <dd>{peso(sample.courtPrice)}</dd>
        </div>
      </dl>
      <span className="mbtn">{mocks.continue}</span>
    </>
  )
}

function Pay() {
  return (
    <>
      <b className="mtitle">{mocks.payTitle}</b>
      <dl className="msum">
        <div>
          <dt>{mocks.court(sample.hours)}</dt>
          <dd>{peso(sample.courtPrice)}</dd>
        </div>
        <div>
          <dt>{mocks.fee}</dt>
          <dd>{peso(pricing.bookingFee)}</dd>
        </div>
        <div className="mtotal">
          <dt>{mocks.total}</dt>
          <dd>{peso(sample.courtPrice + pricing.bookingFee)}</dd>
        </div>
      </dl>
      <div className="mchips">
        {mocks.methods.map((m, i) => (
          <span key={m} className={i === 0 ? 'on' : undefined}>
            {m}
          </span>
        ))}
      </div>
      <span className="mbtn">{mocks.payButton}</span>
    </>
  )
}

function Confirmed() {
  return (
    <>
      <span className="mbadge">✓ {mocks.confirmed}</span>
      <b className="mtitle">{sample.court}</b>
      <span>{sample.when}</span>
      <dl className="msum">
        <div>
          <dt>{mocks.reference}</dt>
          <dd>{sample.reference}</dd>
        </div>
        <div className="mtotal">
          <dt>{mocks.total}</dt>
          <dd>{peso(sample.courtPrice + pricing.bookingFee)}</dd>
        </div>
      </dl>
    </>
  )
}

function Link() {
  return (
    <>
      <b className="mtitle">{mocks.linkTitle}</b>
      <span>{mocks.linkBody}</span>
      <span className="murl">{sample.link}</span>
      <span className="mbtn">{mocks.copy}</span>
      <span className="mcard">
        <b>{sample.court}</b>
        <br />
        {sample.when}
      </span>
    </>
  )
}

const SCREENS: Record<ScreenMock, () => React.JSX.Element> = { pick: Pick, pay: Pay, confirmed: Confirmed, link: Link }

export function PlayerScreen({ mock }: { mock: ScreenMock }) {
  const Screen = SCREENS[mock]
  return (
    <div className="mock dark" aria-hidden="true">
      <Screen />
    </div>
  )
}
