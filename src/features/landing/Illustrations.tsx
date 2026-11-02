/**
 * Drawings for "Your side" and "Your venue" (T2.3). CSS and inline markup only, coloured from the
 * site's tokens so both themes work. They are decorative: the section text carries the meaning.
 * Sample names and times are made up; no amounts are shown.
 */

const COURTS = ['Court 1', 'Court 2', 'Court 3']
const HOURS = ['6 pm', '7 pm', '8 pm']
/** [court][hour]: 0 free, 1 booked, 2 waiting for a payment proof */
const SLOTS = [
  [1, 1, 0],
  [0, 2, 1],
  [1, 0, 0],
]

export function TodayGrid() {
  return (
    <div className="draw today" aria-hidden="true">
      <div className="draw-bar">
        <strong>Today</strong> <span>3 courts</span>
      </div>
      <div className="today-grid">
        <span />
        {HOURS.map((h) => (
          <span key={h} className="today-h">
            {h}
          </span>
        ))}
        {COURTS.map((c, r) => (
          <div key={c} className="today-row">
            <span className="today-c">{c}</span>
            {SLOTS[r].map((s, i) => (
              <span key={i} className={`slot s${s}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="proof">
        <span className="proof-thumb" />
        <span className="proof-text">
          <strong>Payment proof</strong>
          <span>Ana R. · Court 2, 7 pm</span>
        </span>
        <span className="proof-btns">
          <span className="ok">Approve</span>
          <span>Reject</span>
        </span>
      </div>
    </div>
  )
}

export function VenueFrame() {
  return (
    <div className="draw frame" aria-hidden="true">
      <div className="frame-bar">
        <i />
        <i />
        <i />
        <span className="frame-url">yourvenue.plotline.fit</span>
      </div>
      <div className="frame-page">
        <div className="frame-banner">
          <span className="callout c1">1</span>
        </div>
        <div className="frame-title">
          <strong>Your Venue</strong>
          <span className="callout c2">2</span>
        </div>
        <div className="frame-pay">
          <span className="qr" />
          <span>GCash · Maya · Bank</span>
          <span className="callout c3">3</span>
        </div>
        <div className="frame-sports">
          <span>Badminton</span>
          <span>Pickleball</span>
          <span>Tennis</span>
          <span className="callout c4">4</span>
        </div>
      </div>
    </div>
  )
}
