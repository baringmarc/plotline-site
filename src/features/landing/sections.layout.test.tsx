import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { features, featuresAlso, highlights, highlightsAlso } from '../../config/site'
import { Features, Highlights } from './sections'

// The drawings are swapped for markers so these tests can see where each section places them.
// The drawings themselves are tested in Illustrations.test.tsx.
vi.mock('./Illustrations', () => ({
  TodayGrid: () => <div data-testid="today-grid" aria-hidden="true" />,
  VenueFrame: () => <div data-testid="venue-frame" aria-hidden="true" />,
}))

// ---- T2.3 "Your side" and "Your venue": two different layouts ------------------------------------

describe('Features, "Your side" (T2.3)', () => {
  it('lays out the 3 headline items beside the TodayGrid drawing, in a .side-split', () => {
    const { container, getByTestId } = render(<Features />)
    const split = container.querySelector('.side-split') as HTMLElement
    expect(split).not.toBeNull()
    expect(split).toContainElement(getByTestId('today-grid'))
    for (const f of features) {
      expect(within(split).getByRole('heading', { name: f.title })).toBeInTheDocument()
      expect(within(split).getByText(f.body)).toBeInTheDocument()
    }
  })

  it('keeps the 3 "also in your admin" chips', () => {
    const { getByText } = render(<Features />)
    for (const chip of featuresAlso) expect(getByText(chip)).toBeInTheDocument()
  })

  it('does not use the "Your venue" layout or its drawing', () => {
    const { container, queryByTestId } = render(<Features />)
    expect(container.querySelector('.venue-split')).toBeNull()
    expect(queryByTestId('venue-frame')).toBeNull()
  })
})

describe('Highlights, "Your venue" (T2.3)', () => {
  it('lays out the VenueFrame drawing beside a numbered list, in a .venue-split', () => {
    const { container, getByTestId } = render(<Highlights />)
    const split = container.querySelector('.venue-split') as HTMLElement
    expect(split).not.toBeNull()
    expect(split).toContainElement(getByTestId('venue-frame'))
    expect(split.querySelector('ol')).not.toBeNull()
  })

  it('the numbered list is an <ol> of the 4 highlights, in config order, each with its title and body', () => {
    const { container } = render(<Highlights />)
    const ol = container.querySelector('.venue-split ol') as HTMLElement
    const items = within(ol).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    highlights.forEach((h, i) => {
      expect(within(items[i]).getByRole('heading', { name: h.title })).toBeInTheDocument()
      expect(items[i].textContent).toContain(h.body)
    })
  })

  it('keeps the 3 "players also get" chips, outside the numbered list', () => {
    const { container, getByText } = render(<Highlights />)
    const ol = container.querySelector('.venue-split ol') as HTMLElement
    expect(ol).not.toBeNull()
    for (const chip of highlightsAlso) {
      const el = getByText(chip)
      expect(el).toBeInTheDocument()
      expect(ol).not.toContainElement(el)
    }
  })

  it('does not use the "Your side" layout or its drawing', () => {
    const { container, queryByTestId } = render(<Highlights />)
    expect(container.querySelector('.side-split')).toBeNull()
    expect(queryByTestId('today-grid')).toBeNull()
  })
})

describe('the two sections look different (T2.3)', () => {
  it('Your side has no numbered list for its headline items; Your venue does', () => {
    const side = render(<Features />)
    expect(side.container.querySelector('.side-split ol')).toBeNull()
    side.unmount()
    const venue = render(<Highlights />)
    expect(venue.container.querySelector('.venue-split ol')).not.toBeNull()
  })
})
