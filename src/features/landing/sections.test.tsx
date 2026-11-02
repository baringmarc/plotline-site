import { render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  atAGlance,
  contactAnchor,
  costs,
  faqGroups,
  features,
  featuresAlso,
  highlights,
  highlightsAlso,
  navLinks,
  peso,
  playerSide,
  pricing,
  provider,
  shortVersion,
  site,
} from '../../config/site'
import { workedExample } from './pricing'
import {
  AtAGlance,
  Costs,
  Faq,
  Features,
  Highlights,
  FinalBand,
  Hero,
  MoneyFlow,
  PlayerSide,
  ShortVersion,
  Steps,
  Venues,
} from './sections'

/** Every section that needs no data (Venues and the reviews have their own states). */
const STATIC_SECTIONS = [
  ['Hero', Hero],
  ['ShortVersion', ShortVersion],
  ['PlayerSide', PlayerSide],
  ['Features', Features],
  ['Highlights', Highlights],
  ['Costs', Costs],
  ['MoneyFlow', MoneyFlow],
  ['Steps', Steps],
  ['Faq', Faq],
  ['AtAGlance', AtAGlance],
  ['FinalBand', FinalBand],
] as const

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

describe.each(STATIC_SECTIONS)('%s', (_, Section) => {
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

describe.each(STATIC_SECTIONS)('%s', (_, Section) => {
  it('claims no feature that has not shipped', () => {
    const { container } = render(<Section />)
    expect(container.textContent).not.toMatch(UNSHIPPED)
  })
})

describe('calls to action', () => {
  it('all point at the contact form', () => {
    const { getAllByRole } = render(
      <>
        <Hero />
        <Costs />
        <FinalBand />
      </>,
    )
    // every link except the live demo is a call to action
    const ctas = getAllByRole('link').filter((a) => a.getAttribute('href') !== site.demoUrl)
    expect(ctas).toHaveLength(3)
    for (const a of ctas) expect(a).toHaveAttribute('href', contactAnchor)
  })

  it('nav links each point at a section on the page', () => {
    const { container } = render(
      <>
        {STATIC_SECTIONS.map(([name, Section]) => (
          <Section key={name} />
        ))}
      </>,
    )
    for (const l of navLinks) expect(container.querySelector(l.href)).not.toBeNull()
  })
})

describe('AtAGlance', () => {
  const allRows = () => atAGlance.groups.flatMap((g) => g.rows)

  it('lists every row of every group, with the fee from config', () => {
    const { getAllByRole, getByText } = render(<AtAGlance />)
    expect(getAllByRole('term')).toHaveLength(allRows().length)
    expect(getByText(new RegExp(`^${peso(pricing.bookingFee)} per confirmed online booking`))).toBeInTheDocument()
    expect(allRows().map((r) => r.label)).not.toContain('Term')
  })

  it('has no flat "rows" list any more: three groups instead (T2.1)', () => {
    expect(atAGlance).not.toHaveProperty('rows')
    expect(atAGlance.groups).toHaveLength(3)
  })

  it('groups the rows as the service, the money, and your data and leaving (T2.1)', () => {
    expect(atAGlance.groups.map((g) => g.rows.map((r) => r.label))).toEqual([
      ['Service', 'Courts', 'Provider'],
      ['Booking fee', 'Not billed', 'Payments', 'Billing'],
      ['Your data', 'Leaving'],
    ])
    for (const g of atAGlance.groups) expect(g.title.trim()).not.toBe('')
  })

  it('renders each group title and its rows', () => {
    const { getByText, getAllByRole } = render(<AtAGlance />)
    for (const g of atAGlance.groups) expect(getByText(g.title)).toBeInTheDocument()
    const terms = getAllByRole('term').map((t) => t.textContent)
    expect(terms).toEqual(allRows().map((r) => r.label))
  })

  it('keeps the "Provider" and "Leaving" rows (SPEC §3.1 row 10, T1.11a), now inside the groups', () => {
    const { getAllByRole } = render(<AtAGlance />)
    const value = (label: string) => getAllByRole('term').find((t) => t.textContent === label)?.nextElementSibling?.textContent
    expect(value('Provider')).toBe(provider)
    expect(value('Provider')).toMatch(/^Plotline\b/)
    expect(value('Leaving')).toMatch(/any time/i)
    expect(value('Leaving')).toMatch(/no notice period/i)
    expect(value('Leaving')).toMatch(/30 days/)
  })
})

describe('Faq', () => {
  it('"Message us" opens Messenger (T1.11a)', () => {
    const { getByRole } = render(<Faq />)
    expect(getByRole('link', { name: 'Message us' })).toHaveAttribute('href', 'https://m.me/61595759948011')
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

// ---- T2.1 Copy pass ----------------------------------------------------------------------------

/** Every section of the landing page that renders without data (the reviews and the form aside). */
const PAGE_SECTIONS = [...STATIC_SECTIONS, ['Venues', Venues]] as const

/** Words in a piece of text, split on whitespace. */
function words(text: string | null | undefined): number {
  return (text ?? '').trim().split(/\s+/).filter(Boolean).length
}

/** The section's body copy: the words of all its `<p>` elements (T2.1 acceptance, 2026-11-02). */
function bodyWords(container: HTMLElement): number {
  return [...container.querySelectorAll('p')].reduce((n, p) => n + words(p.textContent), 0)
}

const MAX_BODY_WORDS = 90

describe('body copy word cap (T2.1)', () => {
  it.each(PAGE_SECTIONS.filter(([name]) => name !== 'Faq'))(
    '%s has at most 90 words of body copy across its <p> elements',
    (_, Section) => {
      const { container } = render(<Section />)
      expect(bodyWords(container)).toBeLessThanOrEqual(MAX_BODY_WORDS)
    },
  )

  it('each FAQ group has at most 90 words of answers', () => {
    expect(faqGroups).toHaveLength(3)
    for (const g of faqGroups) {
      const total = g.items.reduce((n, item) => n + words(item.a), 0)
      expect(total, g.id).toBeLessThanOrEqual(MAX_BODY_WORDS)
    }
  })
})

describe('"paid by the player" (T2.1)', () => {
  it('appears in at most two sections of the page', () => {
    const withPhrase = PAGE_SECTIONS.filter(([, Section]) => {
      const { container, unmount } = render(<Section />)
      const found = /paid by the player/i.test(container.textContent ?? '')
      unmount()
      return found
    }).map(([name]) => name)
    expect(withPhrase.length).toBeLessThanOrEqual(2)
  })
})

describe('Hero (T2.1)', () => {
  it('has no stat tiles', () => {
    const { container } = render(<Hero />)
    expect(container.querySelector('.stat')).toBeNull()
    expect(container.querySelector('.stats')).toBeNull()
  })
})

describe('ShortVersion (T2.1)', () => {
  it('lists the 8 "what you get" items as short chips', () => {
    const { getByText } = render(<ShortVersion />)
    expect(shortVersion.get.points).toHaveLength(8)
    for (const p of shortVersion.get.points) {
      expect(words(p)).toBeLessThanOrEqual(6)
      expect(getByText(p)).toBeInTheDocument()
    }
  })

  it('states the fee from pricing exactly once, in its head (the cost line)', () => {
    const fee = peso(pricing.bookingFee)
    const { container } = render(<ShortVersion />)
    expect(amounts(container).filter((a) => a === fee)).toHaveLength(1)
    expect(amounts(container.querySelector('.shead') as HTMLElement)).toEqual([fee])
    expect(shortVersion).not.toHaveProperty('cost')
  })

  it('links to the pricing section', () => {
    const { getByRole } = render(<ShortVersion />)
    expect(getByRole('link', { name: new RegExp(shortVersion.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toHaveAttribute(
      'href',
      '#pricing',
    )
  })
})

describe('Features (T2.1)', () => {
  it('shows exactly 3 headline cards and 3 "also" chips', () => {
    expect(features).toHaveLength(3)
    expect(featuresAlso).toHaveLength(3)
    const { getByRole, getByText } = render(<Features />)
    for (const f of features) {
      expect(getByRole('heading', { name: f.title })).toBeInTheDocument()
      expect(getByText(f.body)).toBeInTheDocument()
    }
    for (const chip of featuresAlso) expect(getByText(chip)).toBeInTheDocument()
  })

  it('keeps peak/off-peak rates, hours and blackouts, and earnings and occupancy with CSV as chips', () => {
    expect(featuresAlso.some((c) => /peak/i.test(c) && /off-peak/i.test(c))).toBe(true)
    expect(featuresAlso.some((c) => /hours/i.test(c) && /blackout/i.test(c))).toBe(true)
    expect(featuresAlso.some((c) => /earnings/i.test(c) && /occupancy/i.test(c) && /CSV/.test(c))).toBe(true)
  })
})

describe('Highlights (T2.1)', () => {
  it('shows exactly 4 headline cards and 3 "also" chips', () => {
    expect(highlights).toHaveLength(4)
    expect(highlightsAlso).toHaveLength(3)
    const { getByRole, getByText } = render(<Highlights />)
    for (const h of highlights) {
      expect(getByRole('heading', { name: h.title })).toBeInTheDocument()
      expect(getByText(h.body)).toBeInTheDocument()
    }
    for (const chip of highlightsAlso) expect(getByText(chip)).toBeInTheDocument()
  })
})

describe('Faq groups (T2.1)', () => {
  it('has three groups, Players, Money and Your setup, of three questions each', () => {
    expect(faqGroups.map((g) => g.id)).toEqual(['players', 'money', 'setup'])
    for (const g of faqGroups) {
      expect(g.label.trim()).not.toBe('')
      expect(g.items).toHaveLength(3)
    }
    const questions = faqGroups.flatMap((g) => g.items.map((i) => i.q))
    expect(new Set(questions).size).toBe(9)
  })

  it('renders a label for each group and every question and answer', () => {
    const { container, getByText } = render(<Faq />)
    for (const g of faqGroups) {
      expect(getByText(g.label)).toBeInTheDocument()
      for (const item of g.items) {
        expect(getByText(item.q)).toBeInTheDocument()
        const answer = [...container.querySelectorAll('p')].find((p) => p.textContent === item.a)
        expect(answer, item.q).toBeDefined()
      }
    }
  })

  it('still says PayMongo’s own fee is between the venue and PayMongo, in the Money group (SPEC §3.1)', () => {
    const money = faqGroups.find((g) => g.id === 'money')!
    expect(money.items.some((i) => /PayMongo/.test(i.q + i.a) && /fee/i.test(i.a))).toBe(true)
  })
})

/** Every shipped feature claim (SPEC §3.1 "Feature claims", rows 4 and 4b): T2.1 may move them, never drop them. */
const FEATURE_CLAIMS: [string, RegExp][] = [
  ['peak and off-peak rates', /peak and off-peak/i],
  ['hours and blackouts', /blackout/i],
  ['earnings', /earnings/i],
  ['occupancy', /occupancy/i],
  ['CSV export', /CSV/],
  ['payment proofs', /payment proofs?/i],
  ['move a booking', /move a (confirmed )?booking/i],
  ['the today view', /today/i],
  ['a banner', /banner/i],
  ['court photos', /photos/i],
  ['amenities', /amenities/i],
  ['social links', /social/i],
  ['a Google Maps pin', /maps/i],
  ['house rules', /house rules/i],
  ['every sport in one venue', /every sport/i],
  ['the venue’s own address', /plotline\.fit|own (web )?address/i],
  ['payment accounts with QR codes', /QR/],
  ['up to 10 payment accounts', /up to 10\b/i],
  ['guest booking', /guest/i],
  ['player emails', /\bemails?\b/i],
  ['My bookings', /My bookings/],
  ['no limit on courts', /no limit/i],
  ['open play', /open play/i],
]

describe('feature claims on the page (T2.1)', () => {
  it.each(FEATURE_CLAIMS)('still mentions %s somewhere on the page', (_, claim) => {
    const { container } = render(
      <>
        {PAGE_SECTIONS.map(([name, Section]) => (
          <Section key={name} />
        ))}
      </>,
    )
    expect(container.textContent).toMatch(claim)
  })
})

describe('a different booking fee, across the page (T2.1)', () => {
  afterEach(() => {
    vi.doUnmock('../../config/pricing')
    vi.resetModules()
  })

  it('changes every fee amount in every section, "At a glance" and the FAQ included', async () => {
    vi.resetModules()
    vi.doMock('../../config/pricing', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../config/pricing')>()
      const pricing = { ...real.pricing, bookingFee: 15 }
      return { pricing, peso: (n: number) => `${pricing.currency}${n.toLocaleString('en-PH')}` }
    })
    const swapped = await import('./sections')
    const { container } = render(
      <>
        <swapped.Hero />
        <swapped.ShortVersion />
        <swapped.PlayerSide />
        <swapped.Features />
        <swapped.Highlights />
        <swapped.Costs />
        <swapped.MoneyFlow />
        <swapped.Venues />
        <swapped.Steps />
        <swapped.Faq />
        <swapped.AtAGlance />
        <swapped.FinalBand />
      </>,
    )
    const found = amounts(container)
    expect(found).toContain('₱15')
    expect(found).not.toContain('₱10')
    expect(container.textContent).toMatch(/₱15 per confirmed online booking/)
  })
})
