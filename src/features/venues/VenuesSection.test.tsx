import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoVenue, site, venuesHead, venuesLive } from '../../config/site'
import { ApiError } from '../../lib/queryClient'
import type { PublicVenue } from './api'
import { VenuesSection } from './VenuesSection'

// No network: the read is mocked at the api module.
const fetchPublicVenues = vi.fn<() => Promise<PublicVenue[]>>()
vi.mock('./api', () => ({ fetchPublicVenues: () => fetchPublicVenues(), DEMO_SLUG: 'claudex-courts' }))

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <VenuesSection />
    </QueryClientProvider>,
  )
}

function venue(slug: string, name: string, over: Partial<PublicVenue> = {}): PublicVenue {
  return { slug, name, city: 'Cebu City', logoUrl: null, url: `https://${slug}.plotline.fit`, ...over }
}

const FOUR = [
  venue('alpha-courts', 'Alpha Courts'),
  venue('bravo-courts', 'Bravo Courts', { city: 'Davao City' }),
  venue('charlie-courts', 'Charlie Courts', { city: null }),
  venue('delta-courts', 'Delta Courts', { logoUrl: 'http://localhost:55321/storage/v1/object/public/venue-media/d.png' }),
]

/** Words in the section's `<p>` elements (the T2.1 body copy cap, 90 words). */
function bodyWords(container: HTMLElement): number {
  return [...container.querySelectorAll('p')].reduce((n, p) => n + (p.textContent ?? '').trim().split(/\s+/).filter(Boolean).length, 0)
}

/** Visitors never see an error or a zero in this section. */
function expectNoErrorOrZero(container: HTMLElement) {
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/error|could not|couldn.t|failed|went wrong|try again|unavailable/i)
  expect(text).not.toMatch(/(^|[^\d])0([^\d]|$)/)
  expect(text).not.toMatch(/no venues/i)
}

/** Waits until the read has settled: the loading skeleton is gone. */
async function settled() {
  await waitFor(() => expect(screen.queryByLabelText('Loading venues')).toBeNull())
}

/** The demo state: today's copy and one demo card (empty feed or a failed read). */
async function expectDemoState(container: HTMLElement) {
  await settled()
  expect(screen.getByRole('heading', { name: venuesHead.title })).toBeInTheDocument()
  expect(screen.getByText(venuesHead.label)).toBeInTheDocument()
  expect(screen.getByText(venuesHead.lead)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: venuesLive.title })).toBeNull()

  const cards = [...container.querySelectorAll('.vcard')] as HTMLElement[]
  expect(cards).toHaveLength(1)
  const card = cards[0]
  expect(card.querySelector('.badge')?.textContent).toBe(demoVenue.name.charAt(0).toUpperCase())
  expect(card.textContent).toContain(demoVenue.name)
  expect(card.textContent).toContain(demoVenue.location)
  const link = within(card).getByRole('link', { name: venuesHead.open })
  expect(link).toHaveAttribute('href', site.demoUrl)
  expect(link).toHaveClass('btn', 'ghost')
  expect(link).toHaveAttribute('target', '_blank')
  expect(screen.queryByRole('region', { name: 'Venues' })).toBeNull()
}

beforeEach(() => {
  fetchPublicVenues.mockReset()
})

describe('VenuesSection config (T3.1)', () => {
  it('keeps the demo venue as its own config entry, linked to the demo', () => {
    expect(demoVenue).toEqual({ name: 'Claudex Courts', location: 'Our demo venue', url: site.demoUrl })
    expect(venuesHead.open).toBe('Open the demo')
    expect(site.demoUrl).toBe('https://claudex-courts.plotline.fit')
  })

  it('has live-feed copy for the label, title, lead, card link and demo link', () => {
    for (const key of ['label', 'title', 'lead', 'open', 'demo'] as const) expect(venuesLive[key].trim()).not.toBe('')
  })
})

describe('VenuesSection while loading (T3.1)', () => {
  it('shows skeleton cards labelled "Loading venues" on the white #venues section', () => {
    fetchPublicVenues.mockReturnValue(new Promise(() => {}))
    const { container } = renderSection()
    expect(container.querySelector('section#venues')).toHaveClass('white')
    expect(screen.getByLabelText('Loading venues')).toBeInTheDocument()
    expectNoErrorOrZero(container)
  })

  it('still links to the demo while loading', () => {
    fetchPublicVenues.mockReturnValue(new Promise(() => {}))
    const { container } = renderSection()
    const demoLinks = [...container.querySelectorAll('a')].filter((a) => a.getAttribute('href') === site.demoUrl)
    expect(demoLinks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('VenuesSection with an empty feed (T3.1)', () => {
  it('shows today\'s demo content: the venuesHead copy and one ghost "Open the demo" card', async () => {
    fetchPublicVenues.mockResolvedValue([])
    const { container } = renderSection()
    await expectDemoState(container)
    expect(container.querySelector('section#venues')).toHaveClass('white')
  })

  it('shows no zero, no "no venues" text and no error', async () => {
    fetchPublicVenues.mockResolvedValue([])
    const { container } = renderSection()
    await settled()
    expect(screen.getByRole('heading', { name: venuesHead.title })).toBeInTheDocument()
    expectNoErrorOrZero(container)
  })

  it('keeps the body copy within 90 words (T2.1 cap)', async () => {
    fetchPublicVenues.mockResolvedValue([])
    const { container } = renderSection()
    await settled()
    expect(screen.getByRole('heading', { name: venuesHead.title })).toBeInTheDocument()
    expect(bodyWords(container)).toBeLessThanOrEqual(90)
  })
})

describe('VenuesSection when the read fails (T3.1)', () => {
  it('falls back to the demo content, exactly as for an empty feed', async () => {
    fetchPublicVenues.mockRejectedValue(new ApiError('relation unavailable', '42P01'))
    const { container } = renderSection()
    await expectDemoState(container)
  })

  it('shows no error text and no zero to visitors', async () => {
    fetchPublicVenues.mockRejectedValue(new ApiError('relation unavailable', '42P01'))
    const { container } = renderSection()
    await settled()
    expect(screen.getByRole('heading', { name: venuesHead.title })).toBeInTheDocument()
    expectNoErrorOrZero(container)
    expect(container.textContent).not.toContain('relation unavailable')
  })
})

describe('VenuesSection with one venue (T3.1)', () => {
  const logo = 'http://localhost:55321/storage/v1/object/public/venue-media/acme/logo.png'
  const acme = venue('acme-courts', 'Acme Courts', { city: 'Cebu City', logoUrl: logo })

  it('uses the "already booking online" copy from venuesLive', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { container } = renderSection()
    expect(await screen.findByRole('heading', { name: venuesLive.title })).toBeInTheDocument()
    expect(screen.getByText(venuesLive.label)).toBeInTheDocument()
    expect(screen.getByText(venuesLive.lead)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: venuesHead.title })).toBeNull()
    expect(container.querySelector('section#venues')).toHaveClass('white')
  })

  it('shows one card in the centred row: the logo as the badge, the name and the city', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    const cards = [...container.querySelectorAll('.vcard')] as HTMLElement[]
    expect(cards).toHaveLength(1)
    const card = cards[0]
    expect(card.closest('.venuerow')).not.toBeNull()
    const img = card.querySelector('.badge img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', logo)
    expect(img).toHaveAttribute('alt', '')
    expect(card.textContent).toContain('Acme Courts')
    expect(card.textContent).toContain('Cebu City')
    expect(screen.queryByRole('region', { name: 'Venues' })).toBeNull()
  })

  it('links the card to the venue\'s own address in a new tab', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    const card = container.querySelector('.vcard') as HTMLElement
    const link = within(card).getByRole('link', { name: venuesLive.open })
    expect(link).toHaveAttribute('href', 'https://acme-courts.plotline.fit')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('adds a separate demo link (not a card) below the cards; the demo venue is never a card', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    const demo = screen.getByRole('link', { name: venuesLive.demo })
    expect(demo).toHaveAttribute('href', site.demoUrl)
    expect(demo.closest('.vcard')).toBeNull()
    const lastCard = [...container.querySelectorAll('.vcard')].at(-1) as Element
    expect(lastCard.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const card of container.querySelectorAll('.vcard')) {
      expect(card.textContent).not.toContain(demoVenue.name)
      expect(within(card as HTMLElement).queryByRole('link', { name: venuesHead.open })).toBeNull()
    }
  })

  it('shows the first letter, uppercased, when the venue has no logo, and leaves out a missing city', async () => {
    fetchPublicVenues.mockResolvedValue([venue('banana-courts', 'banana Courts', { city: null, logoUrl: null })])
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    const card = container.querySelector('.vcard') as HTMLElement
    expect(card.querySelector('.badge img')).toBeNull()
    expect(card.querySelector('.badge')?.textContent).toBe('B')
    expect(card.textContent).toContain('banana Courts')
    expect(card.textContent).not.toMatch(/null|undefined/)
  })

  it('shows no zero and no error text', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    expectNoErrorOrZero(container)
  })
})

describe('VenuesSection with up to 3 venues (T3.1)', () => {
  it('keeps 3 venues in the centred row, not a slider', async () => {
    fetchPublicVenues.mockResolvedValue(FOUR.slice(0, 3))
    const { container } = renderSection()
    await screen.findByRole('heading', { name: venuesLive.title })
    const cards = [...container.querySelectorAll('.vcard')]
    expect(cards).toHaveLength(3)
    for (const c of cards) expect(c.closest('.venuerow')).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Venues' })).toBeNull()
    expect(screen.getAllByRole('link', { name: venuesLive.open }).map((a) => a.getAttribute('href'))).toEqual(
      FOUR.slice(0, 3).map((v) => v.url),
    )
    expect(screen.getByRole('link', { name: venuesLive.demo })).toHaveAttribute('href', site.demoUrl)
  })
})

describe('VenuesSection with more than 3 venues (T3.1)', () => {
  it('puts the cards in the "Venues" slider, one per venue, in feed order', async () => {
    fetchPublicVenues.mockResolvedValue(FOUR)
    const { container } = renderSection()
    const slider = await screen.findByRole('region', { name: 'Venues' })
    const cards = [...slider.querySelectorAll('.vcard')] as HTMLElement[]
    expect(cards).toHaveLength(4)
    expect(container.querySelectorAll('.vcard')).toHaveLength(4)
    cards.forEach((c, i) => expect(c.textContent).toContain(FOUR[i].name))
    expect(within(slider).getAllByRole('link', { name: venuesLive.open }).map((a) => a.getAttribute('href'))).toEqual(FOUR.map((v) => v.url))
  })

  it('shows each card\'s logo or first letter and its city when present', async () => {
    fetchPublicVenues.mockResolvedValue(FOUR)
    const { container } = renderSection()
    await screen.findByRole('region', { name: 'Venues' })
    const cards = [...container.querySelectorAll('.vcard')] as HTMLElement[]
    expect(cards[0].querySelector('.badge')?.textContent).toBe('A')
    expect(cards[0].textContent).toContain('Cebu City')
    expect(cards[1].textContent).toContain('Davao City')
    expect(cards[2].textContent).not.toMatch(/null|undefined/)
    expect(cards[3].querySelector('.badge img')).toHaveAttribute('src', FOUR[3].logoUrl)
  })

  it('keeps the demo link outside the slider and outside every card', async () => {
    fetchPublicVenues.mockResolvedValue(FOUR)
    renderSection()
    const slider = await screen.findByRole('region', { name: 'Venues' })
    const demo = screen.getByRole('link', { name: venuesLive.demo })
    expect(demo).toHaveAttribute('href', site.demoUrl)
    expect(slider.contains(demo)).toBe(false)
    expect(demo.closest('.vcard')).toBeNull()
    expect(slider.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the body copy within 90 words (T2.1 cap) and shows no zero or error', async () => {
    fetchPublicVenues.mockResolvedValue(FOUR)
    const { container } = renderSection()
    await screen.findByRole('region', { name: 'Venues' })
    expect(bodyWords(container)).toBeLessThanOrEqual(90)
    expectNoErrorOrZero(container)
  })
})
