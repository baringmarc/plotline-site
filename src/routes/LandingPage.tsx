import {
  Costs,
  Demo,
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
import { SignupSection } from '../features/signup/SignupForm'

export function LandingPage() {
  return (
    <>
      <Hero />
      <ShortVersion />
      <Venues />
      <ReviewsSection />
      <PlayerSide />
      <Features />
      <Costs />
      <MoneyFlow />
      <Steps />
      <Demo />
      <SignupSection />
      <Faq />
      <FinalBand />
    </>
  )
}
