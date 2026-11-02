import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import css from '../../styles/global.css?raw'
import { peso, playerSide, pricing, type ScreenMock } from '../../config/site'
import { PlayerScreen } from './PlayerScreens'

// T2.4: all four player screens are drawn, in the app's dark theme (find and pick merged into one step, 2026-11-02).
const ALL: ScreenMock[] = ['pick', 'pay', 'confirmed', 'link']

function screen(mock: ScreenMock) {
  return render(<PlayerScreen mock={mock} />).container
}

describe('PlayerScreen (T2.4)', () => {
  it.each(ALL)('draws the %s screen in a .scr element hidden from screen readers (no .mock left)', (mock) => {
    const container = screen(mock)
    const el = container.querySelector('.scr') as HTMLElement
    expect(el).not.toBeNull()
    expect(container.firstElementChild).toBe(el)
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el.textContent?.trim()).not.toBe('')
    expect(container.querySelector('.mock')).toBeNull()
  })

  it.each(['pick', 'confirmed', 'link'] as ScreenMock[])('the %s screen uses no images', (mock) => {
    expect(screen(mock).querySelector('img')).toBeNull()
  })

  it('the pay screen shows the venue’s GCash QR code: one decorative <img src="/demo/qr.svg">', () => {
    const imgs = [...screen('pay').querySelectorAll('img')]
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('src', '/demo/qr.svg')
    expect(imgs[0]).toHaveAttribute('alt', '')
    expect(imgs[0].closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('draws four different screens', () => {
    const texts = ALL.map((m) => screen(m).textContent?.trim())
    expect(new Set(texts).size).toBe(4)
  })

  it('the pick screen shows the sample court the later screens continue', () => {
    expect(screen('pick').textContent).toContain(playerSide.sample.court)
  })

  it('the pick screen is a drawn grid of hours with the picked hours, the total so far and a Continue button', () => {
    const container = screen('pick')
    const text = container.textContent ?? ''
    for (const hour of playerSide.mocks.findHours) expect(text).toContain(hour)
    expect(text).toContain(playerSide.mocks.hoursPicked)
    // two hours picked on the grid (the key's swatch is not in the grid)
    expect(container.querySelectorAll('.scr-grid .picked')).toHaveLength(playerSide.sample.hours)
    expect(text).toContain(peso(playerSide.sample.courtPrice))
    expect(text).toContain(playerSide.mocks.continue)
  })

  it('the confirmed screen shows the court, sample.day, sample.hoursLabel and the reference', () => {
    const text = screen('confirmed').textContent ?? ''
    expect(text).toContain(playerSide.sample.court)
    expect(text).toContain(playerSide.sample.day)
    expect(text).toContain(playerSide.sample.hoursLabel)
    expect(text).toContain(playerSide.sample.reference)
    expect(text).toContain(playerSide.mocks.confirmed)
  })

  it('the pay screen still shows the court price plus the booking fee', () => {
    const text = screen('pay').textContent
    expect(text).toContain(peso(pricing.bookingFee))
    expect(text).toContain(peso(playerSide.sample.courtPrice + pricing.bookingFee))
  })
})

describe('player screens styles (T2.4)', () => {
  it('global.css styles the drawn screens in the app’s dark theme, .scr (and no .mock.dark is left)', () => {
    expect(css).toMatch(/(^|\n)\.scr\s*\{[^}]*background:\s*var\(--app-screen\)/)
    expect(css).not.toMatch(/\.mock\.dark\b/)
  })

  it('keeps the phone’s natural proportions (390 / 844) on the .frame', () => {
    expect(css).toMatch(/(^|\n)\.frame\s*\{[^}]*aspect-ratio:\s*390\s*\/\s*844/)
  })

  it('shows four columns from 1000px and a swipe row below', () => {
    expect(css).toMatch(/@media \(min-width: 1000px\)\s*\{[^}]*\.walk\s*\{[^}]*repeat\(4,/)
    expect(css).not.toMatch(/\.walk\s*\{[^}]*repeat\(5,/)
    expect(css).toMatch(/\.walk\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('has no .flow rule left (Getting started moved onto .timeline)', () => {
    expect(css).not.toMatch(/\.flow\b/)
  })

  it('styles the open play strip, .openplay-strip', () => {
    expect(css).toMatch(/\.openplay-strip\b[^{]*\{/)
  })
})
