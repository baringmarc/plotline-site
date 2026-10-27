import { render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { costs, peso, playerSide, pricing, site } from '../../config/site'
import { workedExample } from './pricing'
import { Costs, Features, Hero, MoneyFlow, PlayerSide, ShortVersion } from './sections'

/**
 * Every peso amount in the section's copy, e.g. ["₱0", "₱10"]. Decorative parts (the phone mockup's
 * sample court rates) are aria-hidden and left out: they're court prices, not ours.
 */
function amounts(container: HTMLElement): string[] {
  const copy = container.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
  return copy.textContent?.match(/₱\s?\d[\d,]*/g) ?? []
}

describe.each([
  ['Hero', Hero],
  ['ShortVersion', ShortVersion],
])('%s', (_, Section) => {
  it('only shows amounts built from the pricing config', () => {
    const { container } = render(<Section />)
    const found = amounts(container)
    expect(found).toContain(peso(pricing.bookingFee))
    for (const a of found) expect([peso(0), peso(pricing.bookingFee)]).toContain(a)
  })

  it('never mentions a trial, a sign-up or a monthly plan', () => {
    const { container } = render(<Section />)
    expect(container.textContent).not.toMatch(/trial|sign[ -]?up|\/month|per month|plan\b/i)
  })
})

describe.each([
  ['Costs', Costs],
  ['MoneyFlow', MoneyFlow],
])('%s', (_, Section) => {
  it('never mentions a trial, a sign-up or a monthly plan', () => {
    const { container } = render(<Section />)
    expect(container.textContent).not.toMatch(/trial|sign[ -]?up|\/month|per month|plan\b/i)
  })
})

describe('Costs', () => {
  it('shows the worked example built from the fee', () => {
    const { getByText } = render(<Costs />)
    const worked = workedExample(costs.example.ratePerHour, costs.example.hours, pricing.bookingFee)
    expect(getByText(peso(worked.playerPays))).toBeInTheDocument()
    expect(getByText(`+ ${peso(pricing.bookingFee)}`)).toBeInTheDocument()
  })

  it('labels the percentage column as an illustration', () => {
    const { getByRole, getByText } = render(<Costs />)
    expect(getByRole('columnheader', { name: `A ${costs.compare.percent}% fee` })).toBeInTheDocument()
    expect(getByText(/only illustrates a percentage fee/)).toBeInTheDocument()
    expect(getByRole('table').querySelectorAll('tbody tr')).toHaveLength(costs.compare.courtPrices.length)
  })
})

describe('MoneyFlow', () => {
  it('lists everything that is never billed', () => {
    const { getByText } = render(<MoneyFlow />)
    for (const n of pricing.notBilled) expect(getByText(n)).toBeInTheDocument()
  })
})

describe('PlayerSide', () => {
  it('shows five numbered steps, screenshots with size and alt text, drawn screens for the rest', () => {
    const { getAllByRole, getByRole, getByText } = render(<PlayerSide />)
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    expect(steps).toHaveLength(5)
    expect(getByText('Step 5 of 5')).toBeInTheDocument()
    const imgs = getAllByRole('img')
    expect(imgs).toHaveLength(playerSide.steps.filter((s) => s.image).length)
    for (const img of imgs) {
      expect(img).toHaveAttribute('width')
      expect(img).toHaveAttribute('height')
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img.getAttribute('alt')).not.toBe('')
    }
  })

  it('draws the payment with the court price plus the fee', () => {
    const { container } = render(<PlayerSide />)
    const total = peso(playerSide.sample.courtPrice + pricing.bookingFee)
    expect(container.querySelector('.mock')?.textContent).toContain(total)
  })
})

/** Features court-booking-system doesn't ship yet (SAAS-PLAN Phase 5 "Copy"; SPEC §3.1). */
const UNSHIPPED =
  /staff accounts?|booking alerts?|waitlist|skill level|reminder|logo|pay at the venue|pay when they arrive|walk-in|open play (sessions? )?(with )?slots|join open play|sign(s)? up for (open play|a session)/i

describe.each([
  ['Hero', Hero],
  ['ShortVersion', ShortVersion],
  ['PlayerSide', PlayerSide],
  ['Features', Features],
  ['Costs', Costs],
  ['MoneyFlow', MoneyFlow],
])('%s', (_, Section) => {
  it('claims no feature that has not shipped', () => {
    const { container } = render(<Section />)
    expect(container.textContent).not.toMatch(UNSHIPPED)
  })
})

describe('a different booking fee', () => {
  afterEach(() => {
    vi.doUnmock('../../config/pricing')
    vi.resetModules()
  })

  it('changes every amount in the hero and the short version', async () => {
    vi.resetModules()
    vi.doMock('../../config/pricing', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../config/pricing')>()
      const pricing = { ...real.pricing, bookingFee: 15 }
      return { pricing, peso: (n: number) => `${pricing.currency}${n.toLocaleString('en-PH')}` }
    })
    const { Hero: SwappedHero, ShortVersion: SwappedShort } = await import('./sections')
    const { container } = render(
      <>
        <SwappedHero />
        <SwappedShort />
      </>,
    )
    const found = amounts(container)
    expect(found).toContain('₱15')
    expect(found).not.toContain('₱10')
  })

  it('changes the fee in what it costs and where the money goes', async () => {
    vi.resetModules()
    vi.doMock('../../config/pricing', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../config/pricing')>()
      const pricing = { ...real.pricing, bookingFee: 15 }
      return { pricing, peso: (n: number) => `${pricing.currency}${n.toLocaleString('en-PH')}` }
    })
    const { Costs: SwappedCosts, MoneyFlow: SwappedFlow } = await import('./sections')
    const { container, getByText, getAllByRole } = render(
      <>
        <SwappedCosts />
        <SwappedFlow />
      </>,
    )
    // 2 hours at ₱400: the player pays ₱815, the venue keeps ₱800
    expect(getByText('+ ₱15')).toBeInTheDocument()
    expect(getByText('₱815')).toBeInTheDocument()
    const flat = getAllByRole('row').slice(1).map((r) => r.querySelector('td.ours')?.textContent)
    expect(flat.every((v) => v === '₱15')).toBe(true)
    expect(container.textContent).toMatch(/₱15 booking fee before they pay/)
    expect(container.textContent).not.toMatch(/₱10(?!\d)/)
  })
})

describe('Hero', () => {
  it('links the secondary button to the live demo', () => {
    const { getByRole } = render(<Hero />)
    expect(getByRole('link', { name: /live demo/i })).toHaveAttribute('href', site.demoUrl)
    expect(site.demoUrl).toBe('https://claudex-courts.plotline.fit')
  })
})
