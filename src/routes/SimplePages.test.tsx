import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { peso, pricing, site } from '../config/site'
import { PrivacyPage, TermsPage } from './SimplePages'

function text(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>).container.textContent ?? ''
}

describe('TermsPage', () => {
  it('states the offer as in SAAS-PLAN §1 and the "At a glance" sheet, with the fee from config', () => {
    const t = text(<TermsPage />)
    expect(t).toContain(`A booking fee of ${peso(pricing.bookingFee)} per confirmed online booking`)
    expect(t).toContain('The player pays it')
    expect(t).toContain(`No setup fee, no subscription and no monthly fee: ${peso(0)}`)
    expect(t).toContain('Plotline never holds your money')
    expect(t).toContain('within 7 days')
    expect(t).toContain('bookings already made are still honored')
    for (const n of pricing.notBilled.slice(1)) expect(t).toContain(n.toLowerCase())
    expect(t).not.toMatch(/trial|walk-in|subscription plan|\/month/i)
  })

  it('marks what is not decided yet, and says it is a draft', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/^Draft\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leaving Plotline' })).toBeInTheDocument()
    expect(screen.getByText(/To be decided: the notice to leave/)).toBeInTheDocument()
    expect(screen.getByText(/How a suspension is lifted: to be decided/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your PayMongo account' })).toBeInTheDocument()
  })
})

describe('PrivacyPage', () => {
  it('names every field the forms send and the Data Privacy Act', () => {
    const t = text(<PrivacyPage />)
    for (const field of [
      'first and last name',
      'email',
      'mobile number',
      'venue name',
      'city or town',
      'number of courts',
      'Facebook page',
      'your message',
      'your review',
      'star rating',
    ])
      expect(t).toContain(field)
    expect(t).toContain('Data Privacy Act of 2012')
    expect(t).toContain('Cloudflare Turnstile')
    expect(t).toContain('National Privacy Commission')
    expect(t).toContain(site.supportEmail)
  })

  it('says approved reviews are public, and promises no first-name-only display', () => {
    const t = text(<PrivacyPage />)
    expect(t).toContain('once we approve a review, it is public')
    expect(t).not.toMatch(/first name/i)
    expect(t).not.toMatch(/only the Plotline team\. It is stored/)
  })
})
