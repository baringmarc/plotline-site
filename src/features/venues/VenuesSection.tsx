import { SectionHead } from '../../components/SectionHead'
import { Slider } from '../../components/Slider'
import { demoVenue, site, venuesHead, venuesLive } from '../../config/site'
import type { PublicVenue } from './api'
import { usePublicVenues } from './hooks'

/**
 * Venues that book on Plotline, from `public_venues`. An empty or failed read shows the demo card,
 * as before the feed existed, so visitors never see an error or a zero.
 */
export function VenuesSection() {
  const venues = usePublicVenues()
  const live = venues.data ?? []

  return (
    <section className="white" id="venues">
      <div className="in">
        {venues.isPending ? (
          <>
            <SectionHead label={venuesHead.label} title={venuesHead.title} lead={venuesHead.lead} />
            <div className="venuerow" role="status" aria-label="Loading venues">
              <div className="vcard skeleton" />
              <div className="vcard skeleton" />
            </div>
            <DemoLink />
          </>
        ) : live.length === 0 ? (
          <>
            <SectionHead label={venuesHead.label} title={venuesHead.title} lead={venuesHead.lead} />
            <div className="venuerow">
              <div className="vcard">
                <span className="badge">{demoVenue.name.charAt(0).toUpperCase()}</span>
                <div>
                  <b>{demoVenue.name}</b>
                  <small>{demoVenue.location}</small>
                </div>
                <a className="btn ghost" href={demoVenue.url} target="_blank" rel="noreferrer">
                  {venuesHead.open}
                </a>
              </div>
            </div>
          </>
        ) : (
          <>
            <SectionHead label={venuesLive.label} title={venuesLive.title} lead={venuesLive.lead} />
            {/* a few venues sit in one centred row; a longer list becomes a swipeable slider */}
            {live.length > 3 ? (
              <Slider label="Venues" twoRows>
                {live.map((v) => (
                  <VenueCard key={v.slug} venue={v} />
                ))}
              </Slider>
            ) : (
              <div className="venuerow">
                {live.map((v) => (
                  <VenueCard key={v.slug} venue={v} />
                ))}
              </div>
            )}
            <DemoLink />
          </>
        )}
      </div>
    </section>
  )
}

function DemoLink() {
  return (
    <p className="center venue-demo">
      <a href={site.demoUrl} target="_blank" rel="noreferrer">
        {venuesLive.demo}
      </a>
    </p>
  )
}

function VenueCard({ venue }: { venue: PublicVenue }) {
  return (
    <div className="vcard">
      <span className="badge">
        {venue.logoUrl ? <img src={venue.logoUrl} alt="" loading="lazy" /> : venue.name.charAt(0).toUpperCase()}
      </span>
      <div>
        <b>{venue.name}</b>
        {venue.city && <small>{venue.city}</small>}
      </div>
      <a className="btn ghost" href={venue.url} target="_blank" rel="noreferrer">
        {venuesLive.open}
      </a>
    </div>
  )
}
