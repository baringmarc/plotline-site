import { describe, expect, it } from 'vitest'
import { privacy, type LegalSection } from './legal'

// T6.7: the Privacy notice covers live Paddle Stacks (court-booking-system PLATFORM.md §4 "Live stacks", "Privacy").
const email = 'support@example.test'
const page = privacy(email)

const text = (s: LegalSection) => [s.title, ...(s.paragraphs ?? []), ...(s.list ?? [])].join(' ')
const liveSections = page.sections.filter((s) => /live/i.test(s.title) && /stack/i.test(s.title))
const liveText = liveSections.map(text).join(' ')
// Apostrophes in legal.ts are typographic (’); accept either.
const apos = "['’]"

describe('privacy(): live Paddle Stacks (T6.7)', () => {
  it('has one section about live stacks', () => {
    expect(liveSections).toHaveLength(1)
    const s = liveSections[0]
    expect((s.paragraphs?.length ?? 0) + (s.list?.length ?? 0)).toBeGreaterThan(0)
  })

  it('says player names in a live stack are stored on Plotline’s servers in Singapore', () => {
    expect(liveText).toMatch(/player names/i)
    expect(liveText).toMatch(new RegExp(`Plotline${apos}s servers in Singapore`))
  })

  it('says they are kept until up to 3 days after the stack’s last change', () => {
    expect(liveText).toMatch(/up to 3 days after its last change/i)
  })

  it('names Paddle Stack and Go live in that section', () => {
    expect(liveText).toMatch(/Paddle Stack/)
    expect(liveText).toMatch(/Go live/)
  })

  it('widens the intro to cover Paddle Stack’s Go live', () => {
    expect(page.intro).toMatch(/Paddle Stack/)
    expect(page.intro).toMatch(/Go live/)
  })

  it('keeps the intro’s existing coverage: the site, both forms, the Act, the controller and the email', () => {
    expect(page.intro).toContain('plotline.fit')
    expect(page.intro).toMatch(/contact form/)
    expect(page.intro).toMatch(/review form/)
    expect(page.intro).toContain('Data Privacy Act of 2012')
    expect(page.intro).toContain('Plotline')
    expect(page.intro).toContain(email)
  })

  it('keeps the existing sections, in order', () => {
    const titles = page.sections.map((s) => s.title)
    const existing = ['What we collect', 'Why', 'Who sees it', 'How long we keep it', 'Your rights', 'Cookies']
    expect(titles.filter((t) => existing.includes(t))).toEqual(existing)
  })

  it('still says the site uses no analytics or advertising cookies', () => {
    const cookies = page.sections.find((s) => s.title === 'Cookies')
    expect(cookies && text(cookies)).toMatch(/no analytics or advertising cookies/)
  })
})
