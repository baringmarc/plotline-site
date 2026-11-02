import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  atAGlance,
  contactAnchor,
  costs,
  faqGroups,
  faqHead,
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
  venues,
  venuesHead,
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

  it('says the fee segment is drawn wider than its true share (example.notToScale, artifact wording)', () => {
    expect(costs.example.notToScale).toBe('The fee is drawn wider than its true share so it can be read.')
    expect(costs.example.notToScale).not.toMatch(/not to scale/i)
    const { getByText } = render(<Costs />)
    expect(getByText(costs.example.notToScale)).toBeInTheDocument()
  })

  it('shows the stat tiles as .tile cards, the second one .tile.hot', () => {
    const { container } = render(<Costs />)
    const tiles = [...container.querySelectorAll('.tile')]
    expect(tiles).toHaveLength(costs.stats.length)
    expect(tiles[0]).not.toHaveClass('hot')
    expect(tiles[1]).toHaveClass('hot')
    costs.stats.forEach((st, i) => {
      expect(tiles[i].textContent).toContain(st.label)
      expect(tiles[i].textContent).toContain(st.value)
      expect(tiles[i].textContent).toContain(st.note)
    })
  })

  it('names the "Never billed" list by aria-label only, with no visible label', () => {
    const { getByRole, queryByText } = render(<Costs />)
    expect(getByRole('list', { name: moneyFlow.neverBilled })).toHaveAttribute('aria-label', moneyFlow.neverBilled)
    expect(queryByText(moneyFlow.neverBilled)).toBeNull()
  })

  it('orders the cards: worked example, then "Where the money goes" with its lead, then the comparison table', () => {
    const { getByRole, getByText } = render(<Costs />)
    const example = getByRole('heading', { name: costs.example.title })
    const flow = getByRole('heading', { name: moneyFlow.label })
    const compare = getByRole('heading', { name: costs.compare.title })
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(example, flow)).toBe(true)
    expect(follows(flow, compare)).toBe(true)
    const lead = getByText(moneyFlow.lead)
    expect(follows(flow, lead)).toBe(true)
    expect(follows(lead, compare)).toBe(true)
    expect(follows(compare, getByRole('table'))).toBe(true)
  })

  it('lists the worked example’s sum in a dl.sum, with no "+" before the fee', () => {
    const w = worked()
    const { container } = render(<Costs />)
    const sum = container.querySelector('dl.sum') as HTMLElement
    expect(sum).not.toBeNull()
    const rows = [...sum.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent])
    expect(rows).toEqual([
      [costs.example.courtPrice, peso(w.courtPrice)],
      [costs.example.fee, peso(w.fee)],
      [costs.example.playerPays, peso(w.playerPays)],
      [costs.example.venueKeeps, peso(w.venueKeeps)],
    ])
    expect(sum.textContent).not.toContain('+')
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

  it('draws all four screens (pick, pay, confirmed, link) and uses no screenshots; the only image is the pay screen’s QR', () => {
    expect(playerSide.steps.map((s) => s.mock)).toEqual(['pick', 'pay', 'confirmed', 'link'])
    for (const s of playerSide.steps) expect(s).not.toHaveProperty('image')
    const { container, getByRole } = render(<PlayerSide />)
    expect(container.innerHTML).not.toMatch(/\/screens\//)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('src', '/demo/qr.svg')
    expect(imgs[0]).toHaveAttribute('alt', '')
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    expect(steps[1]).toContainElement(imgs[0])
  })

  it('shows each drawn screen in the app’s dark theme, hidden from screen readers, one per step', () => {
    const { getByRole } = render(<PlayerSide />)
    const steps = within(getByRole('list', { name: playerSide.label })).getAllByRole('listitem')
    for (const step of steps) expect(step.querySelector('.mock')).toBeNull()
    for (const step of steps) {
      const screens = step.querySelectorAll('.frame .scr')
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
    const pay = [...container.querySelectorAll('.scr')].find((m) => m.textContent?.includes(playerSide.mocks.payTitle))
    expect(pay).toBeDefined()
    expect(pay?.textContent).toContain(total)
  })

  it('shows open play as one card: its title, a short text and its chips (artifact design)', () => {
    const { title, text, chips } = openPlay
    expect(openPlay).not.toHaveProperty('points')
    expect(title).toMatch(/open play/i)
    expect(words(text)).toBeLessThanOrEqual(18)
    expect(chips.length).toBeGreaterThan(0)
    const { container } = render(<PlayerSide />)
    const cards = container.querySelectorAll('.openplay-strip')
    expect(cards).toHaveLength(1)
    const card = cards[0] as HTMLElement
    expect(within(card).getByText(title)).toBeInTheDocument()
    expect(within(card).getByText(text)).toBeInTheDocument()
    const chipEls = [...card.querySelectorAll('.chips > span')].map((c) => c.textContent)
    expect(chipEls).toEqual(chips)
    expect(container.querySelectorAll('.chips')).toHaveLength(1)
  })
})

describe('ShortVersion, the two-column card (artifact design 2026-11-02)', () => {
  it('is one .short card whose only link goes to #pricing, with no SectionHead above it', () => {
    const { container, getAllByRole } = render(<ShortVersion />)
    expect(container.querySelectorAll('.short')).toHaveLength(1)
    expect(container.querySelector('.shead')).toBeNull()
    const links = getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '#pricing')
    expect(container.querySelector('.short')).toContainElement(links[0])
  })

  it('left column: the label, the title with "Free" highlighted in <em>, and the lead with the pricing link', () => {
    const { container, getByRole } = render(<ShortVersion />)
    const [left] = [...(container.querySelector('.short') as HTMLElement).children] as HTMLElement[]
    expect(within(left).getByText(shortVersion.label)).toBeInTheDocument()
    const h2 = within(left).getByRole('heading', { level: 2 })
    expect(h2.textContent).toBe(shortVersion.title)
    expect(h2.querySelector('em')?.textContent).toBe('Free')
    expect(left.textContent).toContain(shortVersion.lead)
    expect(left).toContainElement(getByRole('link', { name: shortVersion.link }))
  })

  it('right column: "What you get, free" and the 8 points as chips', () => {
    const { container } = render(<ShortVersion />)
    const cols = [...(container.querySelector('.short') as HTMLElement).children] as HTMLElement[]
    expect(cols).toHaveLength(2)
    const right = cols[1]
    expect(within(right).getByRole('heading', { name: shortVersion.get.title })).toBeInTheDocument()
    expect([...right.querySelectorAll('.chips > span')].map((c) => c.textContent)).toEqual(shortVersion.get.points)
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
    expect(container.querySelector('ol.timeline')?.textContent).toMatch(/court price and the ₱15 fee first/)
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
/** Words of answers allowed per FAQ group (user decision 2026-11-02, when the groups grew to 5/4/5). */
const MAX_FAQ_GROUP_WORDS = 120
/** Questions per FAQ group, in config order (players, money, setup). */
const FAQ_GROUP_SIZES = [5, 4, 5]
const FAQ_TOTAL = 14

describe('body copy word cap (T2.1)', () => {
  it.each(PAGE_SECTIONS.filter(([name]) => name !== 'Faq'))(
    '%s has at most 90 words of body copy across its <p> elements',
    (_, Section) => {
      const { container } = render(<Section />)
      expect(bodyWords(container)).toBeLessThanOrEqual(MAX_BODY_WORDS)
    },
  )

  it('each FAQ group has at most 120 words of answers', () => {
    expect(faqGroups).toHaveLength(3)
    for (const g of faqGroups) {
      const total = g.items.reduce((n, item) => n + words(item.a), 0)
      expect(total, g.id).toBeLessThanOrEqual(MAX_FAQ_GROUP_WORDS)
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

  it('states the fee from pricing exactly once, in its title (the cost line)', () => {
    const fee = peso(pricing.bookingFee)
    const { container, getByRole } = render(<ShortVersion />)
    expect(amounts(container).filter((a) => a === fee)).toHaveLength(1)
    expect(amounts(getByRole('heading', { level: 2 }))).toEqual([fee])
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
  it('has three groups, Players, Money and Your setup, of 5, 4 and 5 questions (14 unique)', () => {
    expect(faqGroups.map((g) => g.id)).toEqual(['players', 'money', 'setup'])
    expect(faqGroups.map((g) => g.label)).toEqual(['Players', 'Money', 'Your setup'])
    expect(faqGroups.map((g) => g.items.length)).toEqual(FAQ_GROUP_SIZES)
    for (const g of faqGroups) {
      for (const item of g.items) {
        expect(item.q.trim(), g.id).not.toBe('')
        expect(item.a.trim(), item.q).not.toBe('')
      }
    }
    const questions = faqGroups.flatMap((g) => g.items.map((i) => i.q))
    expect(questions).toHaveLength(FAQ_TOTAL)
    expect(new Set(questions).size).toBe(FAQ_TOTAL)
  })

  it.each([
    ['players', 'Can players see their booking later?'],
    ['players', 'Can I cancel or move a booking?'],
    ['money', 'Do I need a payment processor?'],
    ['setup', 'Can I manage more than one facility?'],
    ['setup', 'Can I block off a court for maintenance?'],
  ])('puts the approved question in the %s group: "%s"', (id, q) => {
    const owners = faqGroups.filter((g) => g.items.some((i) => i.q === q)).map((g) => g.id)
    expect(owners).toEqual([id])
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

  it('Highlights draws the venue frame with four numbered pins inside its .venue-split, hidden or labelled', () => {
    const { container } = render(<Highlights />)
    const pins = [...container.querySelectorAll('.venue-split .pin')]
    expect(pins.map((c) => c.textContent?.trim()).sort()).toEqual(['1', '2', '3', '4'])
    for (const c of pins) expect(hiddenOrLabelled(c)).toBe(true)
    expect(container.querySelector('.callout')).toBeNull()
  })

  it.each([
    ['Features', Features],
    ['Highlights', Highlights],
  ])('%s: every inline SVG is aria-hidden or labelled', (_, Section) => {
    const { container } = render(<Section />)
    for (const svg of container.querySelectorAll('svg')) expect(hiddenOrLabelled(svg)).toBe(true)
  })

  it('Features uses no <img>', () => {
    const { container } = render(<Features />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('Highlights uses only the demo venue’s photos and QR (/demo/), decorative (alt="") and hidden', () => {
    const { container } = render(<Highlights />)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/^\/demo\//)
      expect(img).toHaveAttribute('alt', '')
      expect(hiddenOrLabelled(img)).toBe(true)
    }
  })
})

// ---- T2.5 FAQ in tabs ---------------------------------------------------------------------------

/** True if no ancestor (or the element itself) carries the `hidden` attribute. */
function shown(el: Element): boolean {
  return el.closest('[hidden]') === null
}

/** The tabpanel a tab controls, found through its aria-controls id. */
function panelOf(container: HTMLElement, tab: HTMLElement): HTMLElement {
  const id = tab.getAttribute('aria-controls')
  expect(id, 'tab has aria-controls').toBeTruthy()
  const panel = container.querySelector<HTMLElement>(`[id="${id}"]`)
  expect(panel, `panel #${id}`).not.toBeNull()
  return panel!
}

/** Asserts that exactly the tab at `index` is selected, focusable and showing its panel. */
function expectSelected(container: HTMLElement, tabs: HTMLElement[], index: number) {
  tabs.forEach((tab, i) => {
    const panel = panelOf(container, tab)
    if (i === index) {
      expect(tab, faqGroups[i].label).toHaveAttribute('aria-selected', 'true')
      expect(tab, faqGroups[i].label).toHaveAttribute('tabindex', '0')
      expect(panel.hasAttribute('hidden'), `${faqGroups[i].label} panel hidden`).toBe(false)
    } else {
      expect(tab, faqGroups[i].label).toHaveAttribute('aria-selected', 'false')
      expect(tab, faqGroups[i].label).toHaveAttribute('tabindex', '-1')
      expect(panel.hasAttribute('hidden'), `${faqGroups[i].label} panel hidden`).toBe(true)
    }
  })
}

describe('Faq tabs (T2.5)', () => {
  it('renders a tablist with one tab per FAQ group, named by the group label, in config order', () => {
    const { getByRole } = render(<Faq />)
    const tablist = getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(faqGroups.map((g) => g.label))
    for (const g of faqGroups) expect(within(tablist).getByRole('tab', { name: g.label })).toBeInTheDocument()
  })

  it('selects the first tab (Players) initially, with a roving tabindex and only its panel shown', () => {
    const { container, getAllByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expectSelected(container, tabs, 0)
  })

  it('links each tab to a tabpanel labelled by that tab, holding that group’s questions and answers', () => {
    const { container, getAllByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    const ids = new Set<string>()
    tabs.forEach((tab, i) => {
      const panel = panelOf(container, tab)
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(tab.id).toBeTruthy()
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
      ids.add(panel.id)
      for (const item of faqGroups[i].items) {
        expect(within(panel).getByText(item.q)).toBeInTheDocument()
        expect([...panel.querySelectorAll('p')].some((p) => p.textContent === item.a), item.q).toBe(true)
      }
    })
    expect(ids.size).toBe(3)
    expect(getAllByRole('tabpanel', { hidden: true })).toHaveLength(3)
  })

  it('keeps all three panels in the DOM, the inactive ones with the hidden attribute', () => {
    const { getAllByRole } = render(<Faq />)
    const panels = getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(3)
    expect(panels.filter((p) => p.hasAttribute('hidden'))).toHaveLength(2)
    expect(getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('opens the first answer of each group and leaves the others closed', () => {
    const { container, getAllByRole } = render(<Faq />)
    let seenGroups = 0
    for (const tab of getAllByRole('tab')) {
      const details = [...panelOf(container, tab).querySelectorAll('details')]
      seenGroups += 1
      const size = FAQ_GROUP_SIZES[seenGroups - 1]
      expect(details).toHaveLength(size)
      expect(details.map((d) => d.open)).toEqual(Array.from({ length: size }, (_, i) => i === 0))
    }
    expect(seenGroups).toBe(3)
  })

  it('switches tabs on click: Money then Your setup then Players', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole, getByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    await user.click(getByRole('tab', { name: 'Money' }))
    expectSelected(container, tabs, 1)
    await user.click(getByRole('tab', { name: 'Your setup' }))
    expectSelected(container, tabs, 2)
    await user.click(getByRole('tab', { name: 'Players' }))
    expectSelected(container, tabs, 0)
  })

  it('ArrowRight moves to the next tab and focuses it, wrapping from the last to the first', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expectSelected(container, tabs, 1)
    expect(tabs[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expectSelected(container, tabs, 2)
    expect(tabs[2]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expectSelected(container, tabs, 0)
    expect(tabs[0]).toHaveFocus()
  })

  it('ArrowLeft moves to the previous tab and focuses it, wrapping from the first to the last', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    await user.keyboard('{ArrowLeft}')
    expectSelected(container, tabs, 2)
    expect(tabs[2]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expectSelected(container, tabs, 1)
    expect(tabs[1]).toHaveFocus()
  })

  it('Home and End jump to the first and last tab and focus them', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<Faq />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    await user.keyboard('{End}')
    expectSelected(container, tabs, 2)
    expect(tabs[2]).toHaveFocus()
    await user.keyboard('{Home}')
    expectSelected(container, tabs, 0)
    expect(tabs[0]).toHaveFocus()
  })

  it('makes all fourteen questions reachable: each one is shown once its group’s tab is selected', async () => {
    const user = userEvent.setup()
    const { getByRole, getByText } = render(<Faq />)
    const seen = new Set<string>()
    for (const g of faqGroups) {
      await user.click(getByRole('tab', { name: g.label }))
      for (const item of g.items) {
        expect(shown(getByText(item.q)), item.q).toBe(true)
        seen.add(item.q)
      }
      for (const other of faqGroups.filter((o) => o.id !== g.id)) {
        for (const item of other.items) expect(shown(getByText(item.q)), item.q).toBe(false)
      }
    }
    expect(seen.size).toBe(FAQ_TOTAL)
  })
})

// ---- Landing page follows the artifact design (2026-11-02) -------------------------------------

describe('section heads (artifact design)', () => {
  it.each(STATIC_SECTIONS.filter(([name]) => name !== 'Hero' && name !== 'FinalBand' && name !== 'ShortVersion'))(
    '%s: its head is a plain left-aligned .shead, with no accent bar and no "left" modifier',
    (_, Section) => {
      const { container } = render(<Section />)
      const heads = [...container.querySelectorAll('.shead')]
      expect(heads.length).toBeGreaterThan(0)
      for (const h of heads) {
        expect(h.className).toBe('shead')
        expect(h.querySelector('.bar')).toBeNull()
      }
    },
  )
})

describe('Venues (artifact design)', () => {
  it('sits on a white section with one .vcard per venue', () => {
    const { container } = render(<Venues />)
    expect(container.querySelector('section#venues')).toHaveClass('white')
    expect(container.querySelectorAll('.vcard')).toHaveLength(venues.length)
  })

  it('each card shows the first letter as its badge, the name and location, and a ghost "Open the demo" link to the demo', () => {
    const { container } = render(<Venues />)
    const cards = [...container.querySelectorAll('.vcard')] as HTMLElement[]
    venues.forEach((v, i) => {
      const card = cards[i]
      expect(card.querySelector('.badge')?.textContent).toBe(v.name.charAt(0).toUpperCase())
      expect(card.textContent).toContain(v.name)
      expect(card.textContent).toContain(v.location)
      const link = within(card).getByRole('link', { name: venuesHead.open })
      expect(link).toHaveAttribute('href', v.url)
      expect(link).toHaveClass('btn', 'ghost')
      expect(link).toHaveAttribute('target', '_blank')
    })
    expect(venuesHead.open).toBe('Open the demo')
    expect(venues[0].url).toBe(site.demoUrl)
  })
})

describe('Getting started marks (artifact design)', () => {
  it('marks steps 2 and 3 "you" and step 4 "inv" on the timeline', () => {
    const { container } = render(<Steps />)
    const items = [...container.querySelectorAll('ol.timeline > li')]
    expect(items.map((li) => li.className)).toEqual(['', 'you', 'you', 'inv'])
  })
})

describe('Faq layout (artifact design)', () => {
  it('each panel is a .faq of details, each summary with an aria-hidden chevron', () => {
    const { getAllByRole } = render(<Faq />)
    const panels = getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(3)
    panels.forEach((panel, i) => {
      expect(panel).toHaveClass('faq')
      const summaries = [...panel.querySelectorAll('details > summary')]
      expect(summaries, faqGroups[i].id).toHaveLength(FAQ_GROUP_SIZES[i])
      for (const s of summaries) expect(s.querySelector('.chev[aria-hidden="true"]')).not.toBeNull()
    })
  })

  it('puts "Something else? Message us" in a p.more below the panels, not in the head', () => {
    const { container, getAllByRole, getByRole } = render(<Faq />)
    const more = container.querySelector('p.more') as HTMLElement
    expect(more).not.toBeNull()
    expect(more.textContent).toContain(faqHead.lead)
    expect(more).toContainElement(getByRole('link', { name: faqHead.leadLink }))
    const panels = getAllByRole('tabpanel', { hidden: true })
    const last = panels[panels.length - 1]
    expect(Boolean(last.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(container.querySelector('.shead')?.textContent).not.toContain(faqHead.lead)
  })
})

describe('AtAGlance layout (artifact design)', () => {
  it('shows the key figures in .keys and the three groups as .grp cards in .groups, each titled by an h3', () => {
    const { container } = render(<AtAGlance />)
    expect(container.querySelector('.keys')?.children).toHaveLength(atAGlance.keyFigures.length)
    const groups = [...container.querySelectorAll('.groups > .grp')]
    expect(groups).toHaveLength(3)
    atAGlance.groups.forEach((g, i) => {
      expect(within(groups[i] as HTMLElement).getByRole('heading', { level: 3, name: g.title })).toBeInTheDocument()
    })
  })
})
