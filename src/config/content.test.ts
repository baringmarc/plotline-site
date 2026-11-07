// Placeholder rules (T1.9): values still to be provided are marked PLACEHOLDER in site.ts and never point
// at someone else's page, and the page never lists a venue that doesn't use Plotline.
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import legalSource from './legal.ts?raw'
import source from './site.ts?raw'
import * as content from './site'
import { demoVenue, faqGroups, hero, messageLink, shortVersion, site } from './site'

describe('site content', () => {
  it('has no sample or example values left', () => {
    for (const text of [source, html]) expect(text).not.toMatch(/example\.com|your-page|Sample /)
  })

  it('keeps only the demo venue in config, linked to the demo; real venues come from the live feed (T3.1)', () => {
    expect(demoVenue).toEqual(expect.objectContaining({ name: 'Claudex Courts', url: site.demoUrl }))
    expect(content).not.toHaveProperty('venues')
  })

  it('sends "Message us" to email until the Messenger link is set', () => {
    expect(messageLink).toBe(site.messengerUrl || `mailto:${site.supportEmail}`)
  })

  it('has the real support email, Messenger and Facebook links (SPEC §6, 2026-10-29)', () => {
    expect(site.supportEmail).toBe('plotline.admin1@gmail.com')
    expect(site.messengerUrl).toBe('https://m.me/61595759948011')
    expect(site.facebookUrl).toBe('https://www.facebook.com/profile.php?id=61595759948011')
    expect(messageLink).toBe('https://m.me/61595759948011')
  })

  it('keeps the book-a-call link empty (the user\'s call)', () => {
    expect(site.bookCallUrl).toBe('')
  })

  it('leaves a PLACEHOLDER marker only on bookCallUrl (the venue list is live since T3.1)', () => {
    /** The first code line after each `PLACEHOLDER:` marker: the value it marks. */
    const marked = (text: string) => {
      const lines = text.split('\n')
      return lines.flatMap((line, i) => {
        if (!line.includes('PLACEHOLDER:')) return []
        const rest = lines.slice(i + 1)
        const code = line.trim().startsWith('//') || line.includes('*/') ? rest[0] : rest[rest.findIndex((l) => l.includes('*/')) + 1]
        return [code.trim()]
      })
    }
    const inSite = marked(source)
    expect(inSite).toHaveLength(1)
    expect(inSite.some((l) => l.startsWith('bookCallUrl:'))).toBe(true)
    expect(inSite.some((l) => /export const (venues|demoVenue)/.test(l))).toBe(false)

    const inLegal = marked(legalSource)
    expect(inLegal).toHaveLength(0)
  })

  it('gives link previews an absolute share image', () => {
    expect(html).toMatch(/property="og:image" content="https:\/\/[^"]+\/og\.jpg"/)
  })

  it('drops the hero stat tiles and the short version\'s cost card (T2.1)', () => {
    expect(hero).not.toHaveProperty('stats')
    expect(shortVersion).not.toHaveProperty('cost')
    expect(shortVersion.get.points).toHaveLength(8)
  })

  it('replaces the flat FAQ list with three groups of 5, 4 and 5 questions (T2.1, grown 2026-11-02)', () => {
    expect(content).not.toHaveProperty('faqs')
    expect(faqGroups.map((g) => g.id)).toEqual(['players', 'money', 'setup'])
    expect(faqGroups.map((g) => g.items.length)).toEqual([5, 4, 5])
  })

  it('types no peso amount into the copy: every amount is built from pricing (T2.1)', () => {
    // amounts come from `peso(...)` / `${fee}`; a literal "₱" followed by a digit in site.ts would bypass pricing
    expect(source).not.toMatch(/₱\s?\d/)
  })
})
