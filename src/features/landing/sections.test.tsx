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
  moneyFlow,
  navLinks,
  openPlay,
  peso,
  playerSide,
  pricing,
  provider,
  shortVersion,
  site,
  steps,
  stepsHead,
} from '../../config/site'
import { feeComparison, workedExample } from './pricing'
import * as sectionsModule from './sections'
import {
  AtAGlance,
  Costs,
  Faq,
  Features,
  Highlights,
  FinalBand,
  Hero,
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
  ['AtAGlance', AtAGlance],
  ['Steps', Steps],
  ['Faq', Faq],
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

/** The worked example the page uses, from config and the fee. */
const worked = () => workedExample(costs.example.ratePerHour, costs.example.hours, pricing.bookingFee)

/** True if some small element (a line, not the whole section) mentions `pattern` and contains `amount`. */
function lineWith(container: HTMLElement, pattern: RegExp, amount: string): boolean {
  return [...container.querySelectorAll('*')].some((el) => {
    const t = el.textContent ?? ''
    return t.length <= 120 && pattern.test(t) && new RegExp(`${amount}(?!\\d)`).test(t)
  })
}

describe('Costs', () => {
  it('labels the percentage column as an illustration', () => {
    const { getByRole, getByText } = render(<Costs />)
    expect(getByRole('columnheader', { name: `A ${costs.compare.percent}% fee` })).toBeInTheDocument()
    expect(getByText(/only illustrates a percentage fee/)).toBeInTheDocument()
    expect(getByRole('table').querySelectorAll('tbody tr')).toHaveLength(costs.compare.courtPrices.length)
  })
})

// ---- T2.2 Pricing section --------------------------------------------------------------------

describe('Pricing section (T2.2)', () => {
  it('is one section that keeps id="pricing", so the nav "Pricing" anchor still works', () => {
    const { container } = render(<Costs />)
    expect(container.querySelectorAll('section')).toHaveLength(1)
    expect(container.querySelector('section')).toHaveAttribute('id', 'pricing')
    expect(navLinks.find((l) => l.label === 'Pricing')?.href).toBe('#pricing')
  })

  it('no longer exports MoneyFlow, and no separate money band is left on the page', () => {
    expect(sectionsModule).not.toHaveProperty('MoneyFlow')
    const { container } = render(
      <>
        {STATIC_SECTIONS.map(([name, Section]) => (
          <Section key={name} />
        ))}
      </>,
    )
    expect(container.querySelector('#money')).toBeNull()
    expect(container.querySelector('section.dark')).toBeNull()
  })

  it('shows the two stat tiles from config', () => {
    const { getByText, getAllByText } = render(<Costs />)
    expect(costs.stats).toHaveLength(2)
    for (const s of costs.stats) {
      expect(getByText(s.label)).toBeInTheDocument()
      expect(getAllByText(s.value).length).toBeGreaterThan(0)
    }
  })

  it('has a "Never billed" list with every item from pricing.notBilled', () => {
    const { getByRole } = render(<Costs />)
    const list = getByRole('list', { name: moneyFlow.neverBilled })
    expect(list.tagName).toBe('UL')
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(pricing.notBilled)
  })

  it('draws the worked example as a stacked bar labelled with the court price and the fee', () => {
    const w = worked()
    const { getByRole } = render(<Costs />)
    const bar = getByRole('img', { name: new RegExp(peso(w.courtPrice)) })
    const label = bar.getAttribute('aria-label') ?? ''
    expect(label).toContain(peso(w.courtPrice))
    expect(label).toMatch(new RegExp(`${peso(w.fee)}(?!\\d)`))
    expect(bar.textContent).toMatch(/\bCourt\b/)
    expect(bar.textContent).toMatch(/\bFee\b/)
  })

  it('the bar adds up to workedExample(): a "player pays" line with the total', () => {
    const w = worked()
    expect(w.playerPays).toBe(w.courtPrice + w.fee)
    const { container } = render(<Costs />)
    expect(lineWith(container, /player pays/i, peso(w.playerPays))).toBe(true)
  })

  it('says the fee segment is not drawn to scale', () => {
    const { getByText } = render(<Costs />)
    expect(getByText(/not (drawn )?to scale/i)).toBeInTheDocument()
  })

  it('builds every table row from feeComparison()', () => {
    const rows = feeComparison(costs.compare.courtPrices, pricing.bookingFee, costs.compare.percent)
    const { getByRole } = render(<Costs />)
    const body = [...getByRole('table').querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('th, td')].map((c) => c.textContent),
    )
    expect(body).toEqual(rows.map((r) => [peso(r.courtPrice), peso(r.flat), peso(r.percentage)]))
  })

  it('shows "Where the money goes" as a four-step timeline from moneyFlow.steps', () => {
    const { container, getByText } = render(<Costs />)
    expect(getByText(moneyFlow.label)).toBeInTheDocument()
    const timeline = container.querySelector('ol.timeline') as HTMLElement
    expect(timeline).not.toBeNull()
    const items = within(timeline).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(moneyFlow.steps).toHaveLength(4)
    moneyFlow.steps.forEach((s, i) => {
      expect(items[i].textContent).toContain(s.title)
      expect(items[i].textContent).toContain(s.body)
    })
  })

  it('keeps the quiet-month line', () => {
    const { getByText } = render(<Costs />)
    expect(getByText(moneyFlow.quiet)).toBeInTheDocument()
  })

  it('ends with one call to action, to the contact form', () => {
    const { getAllByRole } = render(<Costs />)
    const links = getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', contactAnchor)
    expect(links[0].textContent).toContain(costs.cta)
  })
})

describe('PlayerSide (T2.4)', () => {
  it('shows four numbered steps with their captions (find and pick merged, 2026-11-02)', () => {
    const { getByRole, getByText, queryByText } = render(<PlayerSide />)
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    expect(playerSide.steps).toHaveLength(4)
    expect(steps).toHaveLength(4)
    expect(playerSide.steps[0].title).toBe('Pick a free slot')
    playerSide.steps.forEach((s, i) => {
      expect(within(steps[i]).getByText(playerSide.stepLabel(i + 1, 4))).toBeInTheDocument()
      expect(within(steps[i]).getByRole('heading', { name: s.title })).toBeInTheDocument()
      expect(within(steps[i]).getByText(s.body)).toBeInTheDocument()
    })
    expect(getByText('Step 4 of 4')).toBeInTheDocument()
    expect(queryByText(/Step \d of 5/)).toBeNull()
  })

  it('draws all four screens (pick, pay, confirmed, link) and uses no screenshots', () => {
    expect(playerSide.steps.map((s) => s.mock)).toEqual(['pick', 'pay', 'confirmed', 'link'])
    for (const s of playerSide.steps) expect(s).not.toHaveProperty('image')
    const { container } = render(<PlayerSide />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toMatch(/\/screens\//)
  })

  it('shows each drawn screen in the app’s dark theme, hidden from screen readers, one per step', () => {
    const { getByRole } = render(<PlayerSide />)
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    for (const step of steps) {
      const screens = step.querySelectorAll('.mock.dark')
      expect(screens).toHaveLength(1)
      expect(screens[0].closest('[aria-hidden="true"]')).not.toBeNull()
      expect(screens[0].textContent?.trim()).not.toBe('')
    }
  })

  it('keeps a text alternative for each of the four drawn screens, in its step', () => {
    const { getByRole } = render(<PlayerSide />)
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    playerSide.steps.forEach((s, i) => {
      expect(s.alt.trim()).not.toBe('')
      expect(within(steps[i]).getByText(s.alt)).toBeInTheDocument()
    })
  })

  it('sits on the normal page background, not a dark or tinted band', () => {
    const { container } = render(<PlayerSide />)
    const section = container.querySelector('section#players') as HTMLElement
    expect(section).not.toBeNull()
    expect(section.classList.contains('dark')).toBe(false)
    expect(section.classList.contains('white')).toBe(false)
  })

  it('draws the payment with the court price plus the fee', () => {
    const { container } = render(<PlayerSide />)
    const total = peso(playerSide.sample.courtPrice + pricing.bookingFee)
    const pay = [...container.querySelectorAll('.mock')].find((m) => m.textContent?.includes(playerSide.mocks.payTitle))
    expect(pay?.textContent).toContain(total)
  })

  it('turns open play into a one-line strip: one short text, no card, no chips', () => {
    // cast so this compiles before and after openPlay changes shape
    const { text } = openPlay as unknown as { text: string }
    expect(typeof text).toBe('string')
    expect(openPlay).not.toHaveProperty('points')
    expect(words(text)).toBeLessThanOrEqual(18)
    expect(text).toMatch(/open play/i)
    const { container } = render(<PlayerSide />)
    const strips = container.querySelectorAll('.openplay-strip')
    expect(strips).toHaveLength(1)
    expect(strips[0].textContent).toContain(text)
    expect(container.querySelector('.card.openplay, .openplay.card')).toBeNull()
    expect(strips[0].closest('.card')).toBeNull()
    expect(container.querySelector('.chips')).toBeNull()
  })
})

describe('ShortVersion, the slim card (T2.4)', () => {
  it('is one slim card whose only link goes to #pricing', () => {
    const { container, getAllByRole } = render(<ShortVersion />)
    expect(container.querySelectorAll('.card')).toHaveLength(1)
    const links = getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '#pricing')
  })
})

describe('Steps, "Getting started" (T2.4)', () => {
  it('renders the four steps on the shared timeline (ol.timeline), in order', () => {
    const { container } = render(<Steps />)
    const timeline = container.querySelector('ol.timeline') as HTMLElement
    expect(timeline).not.toBeNull()
    const items = within(timeline).getAllByRole('listitem')
    expect(items).toHaveLength(steps.length)
    expect(steps).toHaveLength(4)
    steps.forEach((s, i) => {
      expect(items[i].textContent).toContain(s.title)
      expect(items[i].textContent).toContain(s.body)
      expect(items[i].querySelector('.num')?.textContent?.trim()).toBe(String(i + 1))
    })
  })

  it('no longer uses the old .flow grid or step cards', () => {
    const { container } = render(<Steps />)
    expect(container.querySelector('.flow')).toBeNull()
    expect(container.querySelector('.card.step')).toBeNull()
    expect(container.querySelector('.step')).toBeNull()
  })

  it('keeps the "Getting started" head', () => {
    const { getByRole } = render(<Steps />)
    expect(getByRole('heading', { name: stepsHead.title })).toBeInTheDocument()
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
  /** The terms of the three groups (the key figures, however they're marked up, are left out). */
  const groupTerms = (terms: HTMLElement[]) =>
    terms.map((t) => t.textContent).filter((t) => !atAGlance.keyFigures.some((k) => k.label === t))

  it('lists every row of every group, with the fee from config', () => {
    const { getAllByRole, getByText } = render(<AtAGlance />)
    expect(groupTerms(getAllByRole('term'))).toHaveLength(allRows().length)
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
    expect(groupTerms(getAllByRole('term'))).toEqual(allRows().map((r) => r.label))
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

describe('AtAGlance key figures (T2.2)', () => {
  it('has four key figures: ₱0 setup, ₱0 monthly, the fee per online booking, 30 days to export after leaving', () => {
    const k = atAGlance.keyFigures
    expect(k).toHaveLength(4)
    expect(k.map((f) => f.value).slice(0, 3)).toEqual([peso(0), peso(0), peso(pricing.bookingFee)])
    expect(k[0].label).toMatch(/setup/i)
    expect(k[1].label).toMatch(/monthly/i)
    expect(k[2].label).toMatch(/online booking/i)
    const last = `${k[3].value} ${k[3].label}`
    expect(last).toMatch(/30 days/)
    expect(last).toMatch(/export/i)
    expect(last).toMatch(/leav/i)
    for (const f of k) expect(f.label.trim()).not.toBe('')
  })

  it('renders every key figure, above the three groups, and keeps id="at-a-glance"', () => {
    const { container, getAllByText, getByText } = render(<AtAGlance />)
    expect(container.querySelector('section')).toHaveAttribute('id', 'at-a-glance')
    const firstGroup = getByText(atAGlance.groups[0].title)
    const before = (el: Element) => Boolean(el.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING)
    for (const f of atAGlance.keyFigures) {
      expect(before(getByText(f.label)), f.label).toBe(true)
      expect(getAllByText(f.value).some(before), f.value).toBe(true)
    }
    for (const g of atAGlance.groups) expect(getByText(g.title)).toBeInTheDocument()
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

  it('changes the fee in the pricing section: bar, player pays line, table and timeline (T2.2)', async () => {
    vi.resetModules()
    vi.doMock('../../config/pricing', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../config/pricing')>()
      const pricing = { ...real.pricing, bookingFee: 15 }
      return { pricing, peso: (n: number) => `${pricing.currency}${n.toLocaleString('en-PH')}` }
    })
    const { Costs: SwappedCosts } = await import('./sections')
    const { container, getByRole, getAllByRole } = render(<SwappedCosts />)
    // 2 hours at ₱400: the player pays ₱815, the venue keeps ₱800
    const bar = getByRole('img', { name: /₱800/ })
    expect(bar.getAttribute('aria-label')).toMatch(/₱15(?!\d)/)
    expect(bar.getAttribute('aria-label')).not.toMatch(/₱10(?!\d)/)
    expect(lineWith(container, /player pays/i, '₱815')).toBe(true)
    const flat = getAllByRole('row').slice(1).map((r) => r.querySelector('td.ours')?.textContent)
    expect(flat).toHaveLength(costs.compare.courtPrices.length)
    expect(flat.every((v) => v === '₱15')).toBe(true)
    expect(container.querySelector('ol.timeline')?.textContent).toMatch(/₱15 booking fee before they pay/)
    expect(container.textContent).not.toMatch(/₱10(?!\d)/)
  })

  it('changes the fee key figure in "At a glance" (T2.2)', async () => {
    vi.resetModules()
    vi.doMock('../../config/pricing', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../config/pricing')>()
      const pricing = { ...real.pricing, bookingFee: 15 }
      return { pricing, peso: (n: number) => `${pricing.currency}${n.toLocaleString('en-PH')}` }
    })
    const swappedSite = await import('../../config/site')
    const { AtAGlance: SwappedGlance } = await import('./sections')
    expect(swappedSite.atAGlance.keyFigures.map((k) => k.value).slice(0, 3)).toEqual(['₱0', '₱0', '₱15'])
    const { container, getByText } = render(<SwappedGlance />)
    expect(getByText('₱15')).toBeInTheDocument()
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
        <swapped.AtAGlance />
        <swapped.Venues />
        <swapped.Steps />
        <swapped.Faq />
        <swapped.FinalBand />
      </>,
    )
    const found = amounts(container)
    expect(found).toContain('₱15')
    expect(found).not.toContain('₱10')
    expect(container.textContent).toMatch(/₱15 per confirmed online booking/)
  })
})

// ---- T2.3 "Your side" and "Your venue" (layout details with the drawings mocked: sections.layout.test.tsx) ----

/** True if the element is hidden from assistive tech, or sits in an image with a text alternative. */
function hiddenOrLabelled(el: Element): boolean {
  if (el.closest('[aria-hidden="true"]')) return true
  const img = el.closest('[role="img"]')
  return Boolean(img && (img.getAttribute('aria-label')?.trim() || img.getAttribute('aria-labelledby')?.trim()))
}

describe('drawings in Your side and Your venue (T2.3)', () => {
  it('Features draws the Today grid inside its .side-split, hidden or labelled', () => {
    const { container } = render(<Features />)
    const split = container.querySelector('.side-split') as HTMLElement
    expect(split).not.toBeNull()
    const drawing = [...split.querySelectorAll('[aria-hidden="true"], [role="img"]')].find((el) =>
      /proof/i.test(el.textContent ?? ''),
    )
    expect(drawing, 'a drawing with the payment-proof card').toBeDefined()
    expect(hiddenOrLabelled(drawing!)).toBe(true)
  })

  it('Highlights draws the venue frame with four numbered callouts inside its .venue-split, hidden or labelled', () => {
    const { container } = render(<Highlights />)
    const callouts = [...container.querySelectorAll('.venue-split .callout')]
    expect(callouts.map((c) => c.textContent?.trim())).toEqual(['1', '2', '3', '4'])
    for (const c of callouts) expect(hiddenOrLabelled(c)).toBe(true)
  })

  it.each([
    ['Features', Features],
    ['Highlights', Highlights],
  ])('%s: every inline SVG is aria-hidden or labelled, and no <img> is used', (_, Section) => {
    const { container } = render(<Section />)
    for (const svg of container.querySelectorAll('svg')) expect(hiddenOrLabelled(svg)).toBe(true)
    expect(container.querySelector('img')).toBeNull()
  })
})
