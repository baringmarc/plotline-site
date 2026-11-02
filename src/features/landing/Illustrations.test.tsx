import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import css from '../../styles/global.css?raw'
import { TodayGrid, VenueFrame } from './Illustrations'
import source from './Illustrations.tsx?raw'

// ---- T2.3 "Your side" and "Your venue": the two drawings -----------------------------------------

const DRAWINGS = [
  ['TodayGrid', TodayGrid],
  ['VenueFrame', VenueFrame],
] as const

/** True if the element is hidden from assistive tech, or is an image with a non-empty text alternative. */
function hiddenOrLabelled(el: Element): boolean {
  if (el.closest('[aria-hidden="true"]')) return true
  const img = el.closest('[role="img"]')
  if (img && (img.getAttribute('aria-label')?.trim() || img.getAttribute('aria-labelledby')?.trim())) return true
  if (el.tagName.toLowerCase() === 'svg' && el.querySelector(':scope > title')?.textContent?.trim()) return true
  return false
}

describe.each(DRAWINGS)('%s (T2.3)', (_, Drawing) => {
  it('is decorative (aria-hidden="true") or has a text alternative, at its root', () => {
    const { container } = render(<Drawing />)
    const root = container.firstElementChild
    expect(root).not.toBeNull()
    expect(hiddenOrLabelled(root!)).toBe(true)
  })

  it('every inline SVG inside is aria-hidden or labelled', () => {
    const { container } = render(<Drawing />)
    for (const svg of container.querySelectorAll('svg')) expect(hiddenOrLabelled(svg)).toBe(true)
  })

  it('uses no image assets: no <img>, no SVG <image>', () => {
    const { container } = render(<Drawing />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('image')).toBeNull()
  })

  it('has nothing focusable inside (a hidden drawing must not add tab stops)', () => {
    const { container } = render(<Drawing />)
    expect(container.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull()
  })
})

describe('TodayGrid (T2.3)', () => {
  it('draws a "Today" grid', () => {
    const { container } = render(<TodayGrid />)
    expect(container.textContent).toMatch(/\btoday\b/i)
  })

  it('includes a payment-proof card', () => {
    const { container } = render(<TodayGrid />)
    expect(container.textContent).toMatch(/proof/i)
  })
})

describe('VenueFrame (T2.3)', () => {
  it('draws four numbered callouts, 1 to 4, each with class "callout"', () => {
    const { container } = render(<VenueFrame />)
    const callouts = [...container.querySelectorAll('.callout')]
    expect(callouts).toHaveLength(4)
    expect(callouts.map((c) => c.textContent?.trim())).toEqual(['1', '2', '3', '4'])
  })

  it('is a browser frame showing the venue’s own plotline.fit address', () => {
    const { container } = render(<VenueFrame />)
    expect(container.textContent).toMatch(/\.plotline\.fit/)
  })
})

describe('Illustrations source (T2.3)', () => {
  it('draws with the site’s colour tokens: no hard-coded hex, rgb() or hsl() colours (works in both themes)', () => {
    expect(source).not.toMatch(/#[0-9a-f]{3}(?:[0-9a-f]{3}(?:[0-9a-f]{2})?)?\b/i)
    expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/i)
  })

  it('imports no image files', () => {
    expect(source).not.toMatch(/\.(png|jpe?g|webp|avif|gif|svg)['"?]/i)
  })
})

describe('layout styles (T2.3)', () => {
  it('global.css styles the two different layouts, .side-split and .venue-split', () => {
    expect(css).toMatch(/\.side-split\b[^{]*\{/)
    expect(css).toMatch(/\.venue-split\b[^{]*\{/)
  })
})
