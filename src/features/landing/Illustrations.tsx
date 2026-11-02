/**
 * Drawings for "Your side" and "Your venue". Inline markup coloured from the site's tokens, so both
 * themes work. They are decorative: the section text carries the meaning. Sample names and times are
 * made up; no amounts are shown. The venue page uses the demo venue's own photos from /demo.
 */

const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4']
const HOURS = ['5 PM', '6 PM', '7 PM', '8 PM']
/** [hour][court]: a guest's first name for a booking, 'Open' for a free slot, 'Proof' for one waiting on a payment proof */
const SLOTS = [
  ['Ana', 'Open', 'Ben', 'Open'],
  ['Ana', 'Proof', 'Ben', 'Cris'],
  ['Open', 'Proof', 'Open', 'Cris'],
  ['Open', 'Open', 'Dan', 'Open'],
]

const ICONS: Record<string, React.JSX.Element> = {
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  move: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
}

/** The line icon in a "Your side" item. Unknown names draw nothing. */
export function FeatureIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function TodayGrid() {
  return (
    <div className="dash" aria-hidden="true">
      <div className="dash-top">
        <b>Today</b>
        <span>Wed, Oct 28</span>
      </div>
      <div className="dash-grid">
        <span />
        {COURTS.map((c) => (
          <span key={c} className="h">
            {c}
          </span>
        ))}
        {SLOTS.map((row, r) => (
          <div key={HOURS[r]} style={{ display: 'contents' }}>
            <span className="t">{HOURS[r]}</span>
            {row.map((cell, c) => (
              <div key={c} className={`dash-cell ${cell === 'Open' ? 'open' : cell === 'Proof' ? 'wait' : 'booked'}`}>
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="dash-proof">
        <span className="dash-thumb" />
        <span className="txt">
          <b>Court 2, 6 to 8 PM</b>
          Proof received. Amount matches.
        </span>
        <span className="btns">
          <span className="ok">Approve</span>
          <span>Reject</span>
        </span>
      </div>
    </div>
  )
}

export function VenueFrame() {
  return (
    <div className="browser" aria-hidden="true">
      <div className="browser-bar">
        <i />
        <i />
        <i />
        <span className="browser-url">claudex-courts.plotline.fit</span>
        <span className="pin">2</span>
      </div>
      <div className="browser-banner">
        <img src="/demo/banner.jpg" alt="" width={1000} height={347} loading="lazy" />
        <strong>Claudex Courts</strong>
        <span className="pin">1</span>
      </div>
      <div className="browser-body">
        <div className="browser-photos">
          <img src="/demo/court-1.jpg" alt="" width={400} height={300} loading="lazy" />
          <img src="/demo/court-2.jpg" alt="" width={400} height={300} loading="lazy" />
          <img src="/demo/court-3.jpg" alt="" width={400} height={300} loading="lazy" />
        </div>
        <div className="browser-pay">
          <img src="/demo/qr.svg" alt="" width={62} height={62} loading="lazy" />
          <div>
            <b>Pay with GCash</b>
            <span>Scan to pay. Up to 10 accounts.</span>
          </div>
          <span className="pin">3</span>
        </div>
        <div className="browser-meta">
          <span>Pickleball</span>
          <span>Badminton</span>
          <span>Parking</span>
          <span>Open 6 AM to 10 PM</span>
          <span className="pin">4</span>
        </div>
      </div>
    </div>
  )
}
