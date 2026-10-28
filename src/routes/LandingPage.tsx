import {
  AtAGlance,
  Costs,
  Faq,
  Features,
  FinalBand,
  Hero,
  MoneyFlow,
  PlayerSide,
  ShortVersion,
  Steps,
  Venues,
} from '../features/landing/sections'
import { ReviewsSection } from '../features/reviews/ReviewsSection'
import { ContactSection } from '../features/contact/ContactForm'

/** The sections in the SPEC §3.1 order. Plain, tinted and dark backgrounds take turns. */
export function LandingPage() {
  return (
    <>
      <Hero />
      <ShortVersion />
      <PlayerSide />
      <Features />
      <Costs />
      <MoneyFlow />
      <Venues />
      <ReviewsSection />
      <Steps />
      <Faq />
      <AtAGlance />
      <ContactSection />
      <FinalBand />
    </>
  )
}
