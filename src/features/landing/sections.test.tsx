import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { peso, pricing, site } from '../../config/site'
import { Hero, ShortVersion } from './sections'

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
})

describe('Hero', () => {
  it('links the secondary button to the live demo', () => {
    const { getByRole } = render(<Hero />)
    expect(getByRole('link', { name: /live demo/i })).toHaveAttribute('href', site.demoUrl)
    expect(site.demoUrl).toBe('https://claudex-courts.plotline.fit')
  })
})
