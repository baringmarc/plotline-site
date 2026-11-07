import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

// No network: the reviews read, the venue feed and the forms are mocked at their api modules.
vi.mock('../features/reviews/api', () => ({
  fetchApprovedReviews: () => Promise.resolve([]),
  sendReview: vi.fn(),
}))
vi.mock('../features/venues/api', () => ({ fetchPublicVenues: () => Promise.resolve([]), DEMO_SLUG: 'claudex-courts' }))
vi.mock('../features/contact/api', () => ({ sendContact: vi.fn() }))
vi.mock('../components/Turnstile', () => ({ Turnstile: () => null }))

function sectionIds(): string[] {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return [...container.querySelectorAll('section[id]')].map((s) => s.id)
}

describe('LandingPage section order (T2.2)', () => {
  it('renders "At a glance" right after Pricing, before Venues', () => {
    const ids = sectionIds()
    const pricing = ids.indexOf('pricing')
    expect(pricing).toBeGreaterThanOrEqual(0)
    expect(ids[pricing + 1]).toBe('at-a-glance')
    expect(ids[pricing + 2]).toBe('venues')
  })

  it('renders "At a glance" once, and no separate money section', () => {
    const ids = sectionIds()
    expect(ids.filter((id) => id === 'at-a-glance')).toHaveLength(1)
    expect(ids.filter((id) => id === 'pricing')).toHaveLength(1)
    expect(ids).not.toContain('money')
  })

  it('keeps every other section in its place, ending with the final band (id="final")', () => {
    expect(sectionIds()).toEqual([
      'short-version',
      'players',
      'features',
      'venue',
      'pricing',
      'at-a-glance',
      'venues',
      'reviews',
      'start',
      'faq',
      'contact',
      'final',
    ])
  })
})
