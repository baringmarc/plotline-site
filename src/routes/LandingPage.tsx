import {
  AdminTour,
  AtAGlance,
  Costs,
  Faq,
  Highlights,
  FinalBand,
  Hero,
  PlayerSide,
  ShortVersion,
  Steps,
} from '../features/landing/sections'
import { VenuesSection } from '../features/venues/VenuesSection'
import { ReviewsSection } from '../features/reviews/ReviewsSection'
import { ContactSection } from '../features/contact/ContactForm'

/** The sections in the SPEC §3.1 order. Plain, tinted and dark backgrounds take turns. */
export function LandingPage() {
  return (
    <>
      <Hero />
      <ShortVersion />
      <PlayerSide />
      <AdminTour />
      <Highlights />
      <Costs />
      <AtAGlance />
      <VenuesSection />
      <ReviewsSection />
      <Steps />
      <Faq />
      <ContactSection />
      <FinalBand />
    </>
  )
}
