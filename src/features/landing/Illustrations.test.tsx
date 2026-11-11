import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import css from '../../styles/global.css?raw'
import { FeatureIcon, VenueFrame } from './Illustrations'
import source from './Illustrations.tsx?raw'

// ---- T2.3 "Your side" and "Your venue": the two drawings -----------------------------------------

const DRAWINGS = [
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

  it('uses no SVG <image>, and any <img> is a decorative demo-venue asset (alt="", from /demo/)', () => {
    const { container } = render(<Drawing />)
    expect(container.querySelector('image')).toBeNull()
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('')
      expect(img.getAttribute('src')).toMatch(/^\/demo\//)
      expect(hiddenOrLabelled(img)).toBe(true)
    }
  })

  it('has nothing focusable inside (a hidden drawing must not add tab stops)', () => {
    const { container } = render(<Drawing />)
    expect(container.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull()
  })
})

describe('VenueFrame (T2.3, artifact design 2026-11-02)', () => {
  it('is a realistic browser frame (.browser), hidden from screen readers at its root', () => {
    const { container } = render(<VenueFrame />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveClass('browser')
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws four numbered pins, 1 to 4, each with class "pin" (no .callout left)', () => {
    const { container } = render(<VenueFrame />)
    const pins = [...container.querySelectorAll('.pin')]
    expect(pins).toHaveLength(4)
    expect(pins.map((c) => c.textContent?.trim()).sort()).toEqual(['1', '2', '3', '4'])
    expect(container.querySelector('.callout')).toBeNull()
  })

  it('uses the demo venue’s real banner, three court photos and QR code, all decorative', () => {
    const { container } = render(<VenueFrame />)
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(srcs.sort()).toEqual(['/demo/banner.jpg', '/demo/court-1.jpg', '/demo/court-2.jpg', '/demo/court-3.jpg', '/demo/qr.svg'])
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('')
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

  it('imports no image files, and only points at the demo venue’s assets in /demo/', () => {
    expect(source).not.toMatch(/import[^\n]*\.(png|jpe?g|webp|avif|gif|svg)['"?]/i)
    const paths = source.match(/['"][^'"\s]*\.(png|jpe?g|webp|avif|gif|svg)['"?]/gi) ?? []
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) expect(p).toMatch(/^['"]\/demo\//)
  })
})

describe('FeatureIcon (artifact design 2026-11-02)', () => {
  it.each(['calendar', 'receipt', 'move'])('draws an aria-hidden SVG with shapes for "%s"', (name) => {
    const { container } = render(<FeatureIcon name={name} />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelector('path, rect, circle, line, polyline')).not.toBeNull()
  })

  it('draws a different icon for each feature', () => {
    const drawn = ['calendar', 'receipt', 'move'].map((n) => render(<FeatureIcon name={n} />).container.innerHTML)
    expect(new Set(drawn).size).toBe(3)
  })
})

describe('layout styles (T2.3)', () => {
  it('global.css styles the "Your venue" layout, .venue-split', () => {
    expect(css).toMatch(/\.venue-split\b[^{]*\{/)
  })
})
