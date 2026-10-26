import { site } from '../config/site'

const HOURS = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM']
// One row per hour, one entry per court: what the sample booking screen shows.
const SLOTS: Array<Array<'free' | 'taken' | 'open-play' | 'picked'>> = [
  ['free', 'taken', 'free'],
  ['taken', 'taken', 'free'],
  ['picked', 'free', 'taken'],
  ['picked', 'open-play', 'open-play'],
  ['taken', 'free', 'free'],
  ['free', 'free', 'taken'],
]

/** A static picture of a venue's booking page, drawn with CSS. Swap for a real screenshot later. */
export function PhoneMockup() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="screen">
        <div className="bar">
          Sample Pickle Park
          <small>Booking by {site.name}</small>
        </div>
        <div className="days">
          <span>Thu</span>
          <span className="on">Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
        <div className="grid">
          <span />
          <b>Court 1</b>
          <b>Court 2</b>
          <b>Court 3</b>
          {HOURS.map((h, row) => (
            <Row key={h} hour={h} slots={SLOTS[row]} />
          ))}
        </div>
        <div className="book">Book 6 PM – 8 PM · ₱800</div>
      </div>
    </div>
  )
}

function Row({ hour, slots }: { hour: string; slots: string[] }) {
  return (
    <>
      <i>{hour}</i>
      {slots.map((s, i) => (
        <span key={i} className={`slot ${s}`} />
      ))}
    </>
  )
}
