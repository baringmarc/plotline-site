import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { atAGlance, peso, pricing, site } from '../config/site'
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

  it('says it is a draft, and leaves no "[to be decided]" text (T1.11a)', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/^Draft\./)).toBeInTheDocument()
    const t = document.body.textContent ?? ''
    expect(t).not.toMatch(/to be decided|to be added|to be named/i)
    expect(t).not.toMatch(/\[[^\]]*\]/)
  })

  it('names Plotline as the provider and follows Philippine law (SPEC §6, 2026-10-29)', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const t = document.body.textContent ?? ''
    expect(screen.getByText(/^These terms cover/).textContent).toMatch(/\bPlotline\b(?! is run by \[)/)
    expect(t).not.toMatch(/Provider name/i)
    expect(t).toContain('These terms follow the laws of the Philippines.')
  })

  it('says how the PayMongo key is stored and what happens if it leaks', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const section = screen.getByRole('heading', { name: 'Your PayMongo account' }).closest('section')!
    const t = section.textContent ?? ''
    expect(t).toMatch(/encrypted/i)
    expect(t).toMatch(/only (by )?our server/i)
    expect(t).toMatch(/never shown again/i)
    expect(t).toMatch(/last 4 characters/)
    expect(t).toMatch(/leak/i)
    expect(t).toMatch(/disconnect/i)
    expect(t).toMatch(/replace/i)
  })

  it('says a suspension is lifted once the overdue invoice is paid, usually within one business day', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const t = screen.getByRole('heading', { name: 'Late payment' }).closest('section')!.textContent ?? ''
    expect(t).toMatch(/overdue invoice is paid/i)
    expect(t).toMatch(/within one business day/i)
  })

  it('gives 1 week’s notice before a fee change', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const t = screen.getByRole('heading', { name: 'Changes to the fee' }).closest('section')!.textContent ?? ''
    expect(t).toMatch(/at least (1|one) week/i)
    expect(t).toContain('A change applies only to bookings made after it takes effect.')
  })

  it('states the exit terms: any time by email, no notice period, a final invoice in 7 days, 30 days of access, then deletion', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const t = screen.getByRole('heading', { name: 'Leaving Plotline' }).closest('section')!.textContent ?? ''
    expect(t).toMatch(/any time/i)
    expect(t).toMatch(/email/i)
    expect(t).toMatch(/no notice period/i)
    expect(t).toMatch(/final invoice/i)
    expect(t).toMatch(/within 7 days/)
    expect(t).toMatch(/30 days/)
    expect(t).toMatch(/CSV/)
    expect(t).toMatch(/deleted/i)
    expect(t).toMatch(/invoices/i)
  })

  it('agrees with the "At a glance" sheet on the provider and leaving', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    const t = screen.getByRole('heading', { name: 'Leaving Plotline' }).closest('section')!.textContent ?? ''
    const row = (label: string) => atAGlance.rows.find((r) => r.label === label)
    const provider = row('Provider')
    const leaving = row('Leaving')
    expect(provider?.value).toMatch(/^Plotline\b/)
    expect(screen.getByText(/^These terms cover/).textContent).toContain(provider?.value)
    expect(leaving?.value).toMatch(/any time/i)
    expect(leaving?.value).toMatch(/no notice period/i)
    expect(leaving?.value).toMatch(/30 days/)
    expect(t).toMatch(/any time/i)
    expect(t).toMatch(/no notice period/i)
    expect(t).toMatch(/30 days/)
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

  it('states the 1-year lead retention and names no undecided period (T1.11a)', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    const t = document.body.textContent ?? ''
    expect(screen.getByRole('heading', { name: 'How long we keep it' })).toBeInTheDocument()
    expect(t).toMatch(/1 year after our last contact/)
    expect(t).not.toMatch(/to be decided|to be added/i)
    // the only bracketed text left is the email service still to be named (T1.11b)
    for (const b of t.match(/\[[^\]]*\]/g) ?? []) expect(b).toMatch(/to be named/)
  })

  it('names Plotline as the controller, and says emails to us are kept in our Gmail inbox (Google)', () => {
    const t = text(<PrivacyPage />)
    expect(t).toMatch(/personal information controller is Plotline\b/)
    expect(t).toMatch(/Gmail/)
    expect(t).toMatch(/Google/)
  })
})
