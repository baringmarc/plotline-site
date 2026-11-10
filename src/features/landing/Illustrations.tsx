/**
 * Drawings for "Your venue". Inline markup coloured from the site's tokens, so both themes work. They
 * are decorative: the section text carries the meaning. No amounts are shown. The venue page uses the
 * demo venue's own photos from /demo. ("Your side" uses real admin screenshots since T4.1.)
 */

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

/** A small line icon (calendar, receipt, move). Unknown names draw nothing. */
export function FeatureIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
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
        <img src="/demo/banner.jpg" alt="" width={800} height={450} loading="lazy" />
        <strong>Claudex Courts</strong>
        <span className="pin">1</span>
      </div>
      <div className="browser-body">
        <div className="browser-photos">
          <img src="/demo/court-1.jpg" alt="" width={400} height={233} loading="lazy" />
          <img src="/demo/court-2.jpg" alt="" width={400} height={618} loading="lazy" />
          <img src="/demo/court-3.jpg" alt="" width={400} height={559} loading="lazy" />
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
