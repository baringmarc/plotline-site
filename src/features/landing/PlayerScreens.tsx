// Drawn phone screens for the walkthrough steps the live demo can't show without a real booking.
// Decorative: the step's caption says what happens, so screen readers skip these.
import { peso, playerSide, pricing, type ScreenMock } from '../../config/site'

const { sample, mocks } = playerSide

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

const SCREENS: Record<ScreenMock, () => React.JSX.Element> = { pay: Pay, confirmed: Confirmed, link: Link }

export function PlayerScreen({ mock }: { mock: ScreenMock }) {
  const Screen = SCREENS[mock]
  return (
    <div className="mock" aria-hidden="true">
      <Screen />
    </div>
  )
}
