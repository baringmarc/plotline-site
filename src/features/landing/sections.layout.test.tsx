import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { highlights, highlightsAlso, highlightsHead } from '../../config/site'
import { Highlights } from './sections'

// The drawings are swapped for markers so these tests can see where each section places them.
// The drawings themselves are tested in Illustrations.test.tsx.
vi.mock('./Illustrations', () => ({
  VenueFrame: () => <div data-testid="venue-frame" aria-hidden="true" />,
  FeatureIcon: ({ name }: { name: string }) => <svg data-testid={`icon-${name}`} aria-hidden="true" />,
}))

// ---- T2.3 "Your venue" layout ("Your side" became the tabbed AdminTour in T4.1: AdminTour.test.tsx) ----

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

  it('puts the section head (label, h2, lead) full width above the .venue-split; the VenueFrame and the list with its chips side by side inside it', () => {
    const { container, getByRole, getByTestId, getByText } = render(<Highlights />)
    const split = container.querySelector('.venue-split') as HTMLElement
    expect(split).not.toBeNull()

    // The head sits outside the split, and comes before it in the document.
    const head = getByRole('heading', { level: 2, name: highlightsHead.title })
    const label = getByText(highlightsHead.label)
    const lead = getByText(highlightsHead.lead)
    for (const el of [head, label, lead]) {
      expect(split).not.toContainElement(el)
      expect(el.compareDocumentPosition(split) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    // Inside the split: first the frame, then the column with the numbered list and the chips.
    const [first, second] = [...split.children] as HTMLElement[]
    expect(first).toBe(getByTestId('venue-frame'))
    expect(second).toBeDefined()
    expect(second.querySelector('ol.venue-list')).not.toBeNull()
    for (const chip of highlightsAlso) expect(second).toContainElement(getByText(chip))
    expect(second).not.toContainElement(getByTestId('venue-frame'))
  })

  it('does not use the old "Your side" layout', () => {
    const { container } = render(<Highlights />)
    expect(container.querySelector('.side-split')).toBeNull()
  })
})
