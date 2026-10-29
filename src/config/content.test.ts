// Placeholder rules (T1.9): values still to be provided are marked PLACEHOLDER in site.ts and never point
// at someone else's page, and the page never lists a venue that doesn't use Plotline.
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import legalSource from './legal.ts?raw'
import source from './site.ts?raw'
import { messageLink, site, venues } from './site'

describe('site content', () => {
  it('has no sample or example values left', () => {
    for (const text of [source, html]) expect(text).not.toMatch(/example\.com|your-page|Sample /)
  })

  it('lists only real venues: for now the demo venue, linked to the demo', () => {
    expect(venues).toEqual([expect.objectContaining({ name: 'Claudex Courts', url: site.demoUrl })])
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

  it('leaves PLACEHOLDER markers only on bookCallUrl, the venue list, the draft notice and the email service name', () => {
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
    expect(inSite).toHaveLength(2)
    expect(inSite.some((l) => l.startsWith('bookCallUrl:'))).toBe(true)
    expect(inSite.some((l) => l.startsWith('export const venues'))).toBe(true)

    const inLegal = marked(legalSource)
    expect(inLegal).toHaveLength(2)
    expect(inLegal.some((l) => l.startsWith('export const legalDraftNotice'))).toBe(true)
    expect(inLegal.some((l) => /email/i.test(l) && /to be named/.test(l))).toBe(true)
  })

  it('gives link previews an absolute share image', () => {
    expect(html).toMatch(/property="og:image" content="https:\/\/[^"]+\/og\.jpg"/)
  })
})
