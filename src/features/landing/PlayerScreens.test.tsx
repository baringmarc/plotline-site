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
  it.each(ALL)('draws the %s screen in a .mock.dark element hidden from screen readers', (mock) => {
    const container = screen(mock)
    const el = container.querySelector('.mock.dark') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(el.textContent?.trim()).not.toBe('')
    expect(container.querySelector('img')).toBeNull()
  })

  it('draws four different screens', () => {
    const texts = ALL.map((m) => screen(m).textContent?.trim())
    expect(new Set(texts).size).toBe(4)
  })

  it('the pick screen shows the sample court the later screens continue', () => {
    expect(screen('pick').textContent).toContain(playerSide.sample.court)
  })

  it('the pick screen is a drawn grid of hours with the picked hours, the total so far and a Continue button', () => {
    const text = screen('pick').textContent ?? ''
    for (const hour of playerSide.mocks.findHours) expect(text).toContain(hour)
    expect(text).toContain(playerSide.sample.when)
    expect(text).toContain(peso(playerSide.sample.courtPrice))
    expect(text).toContain(playerSide.mocks.continue)
  })

  it('the pay screen still shows the court price plus the booking fee', () => {
    const text = screen('pay').textContent
    expect(text).toContain(peso(pricing.bookingFee))
    expect(text).toContain(peso(playerSide.sample.courtPrice + pricing.bookingFee))
  })
})

describe('player screens styles (T2.4)', () => {
  it('global.css defines the dark app theme for drawn screens, .mock.dark', () => {
    expect(css).toMatch(/\.mock\.dark\b[^{]*\{/)
  })

  it('keeps the screenshots’ natural proportions (390 / 844) for drawn screens', () => {
    expect(css).toMatch(/\.mock\b[^{]*\{[^}]*aspect-ratio:\s*390\s*\/\s*844/)
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
