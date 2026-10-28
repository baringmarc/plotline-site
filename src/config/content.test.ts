// Placeholder rules (T1.9): values still to be provided are marked PLACEHOLDER in site.ts and never point
// at someone else's page, and the page never lists a venue that doesn't use Plotline.
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
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

  it('gives link previews an absolute share image', () => {
    expect(html).toMatch(/property="og:image" content="https:\/\/[^"]+\/og\.jpg"/)
  })
})
