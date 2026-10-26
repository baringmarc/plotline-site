import {
  Audiences,
  Demo,
  Faq,
  Features,
  FinalBand,
  Hero,
  OpenPlay,
  Pricing,
  Steps,
  Venues,
} from '../features/landing/sections'
import { ReviewsSection } from '../features/reviews/ReviewsSection'
import { SignupSection } from '../features/signup/SignupForm'

export function LandingPage() {
  return (
    <>
      <Hero />
      <Venues />
      <ReviewsSection />
      <Audiences />
      <OpenPlay />
      <Features />
      <Pricing />
      <Steps />
      <Demo />
      <SignupSection />
      <Faq />
      <FinalBand />
    </>
  )
}
