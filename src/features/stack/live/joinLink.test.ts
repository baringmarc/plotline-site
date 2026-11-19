// T6.6 Join QR on the TV board (TASKS.md T6.6): the players' link for a live stack, in full (for the QR) and short
// (for the TV to show as text). Same path as the Go live panel's link: `/paddle-stack/live/<code>` (SPEC "Organizer").
import { describe, expect, it } from 'vitest'
import { joinUrl, shortJoinLink } from './joinLink'

describe('joinUrl (T6.6)', () => {
  it('is this site’s origin plus /paddle-stack/live/<code>', () => {
    expect(joinUrl('PAGECODE')).toBe(`${window.location.origin}/paddle-stack/live/PAGECODE`)
  })

  it('is a full URL with the protocol, so a phone camera opens it', () => {
    const url = new URL(joinUrl('AB12CD'))
    expect(url.protocol).toBe(window.location.protocol)
    expect(url.host).toBe(window.location.host)
    expect(url.pathname).toBe('/paddle-stack/live/AB12CD')
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
  })

  it('keeps the code as given', () => {
    expect(joinUrl('x7Yz')).toBe(`${window.location.origin}/paddle-stack/live/x7Yz`)
  })
})

describe('shortJoinLink (T6.6)', () => {
  it('is the host plus /paddle-stack/live/<code>, without the protocol', () => {
    expect(shortJoinLink('PAGECODE')).toBe(`${window.location.host}/paddle-stack/live/PAGECODE`)
  })

  it('has no protocol and no trailing slash', () => {
    const short = shortJoinLink('AB12CD')
    expect(short).not.toMatch(/^[a-z]+:\/\//i)
    expect(short.startsWith(window.location.host)).toBe(true)
    expect(short).not.toContain('//')
    expect(short.endsWith('/')).toBe(false)
  })

  it('is joinUrl with the protocol taken off', () => {
    expect(shortJoinLink('AB12CD')).toBe(joinUrl('AB12CD').replace(/^[a-z]+:\/\//i, ''))
  })
})
