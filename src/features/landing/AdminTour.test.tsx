// T4.1 Admin tour: the tabbed "Your side" section (`AdminTour`, still <section class="white" id="features">).
// Same tab pattern as the FAQ (T2.5). Plan ids: tab `admin-tab-<id>`, panel `admin-panel-<id>`; frames `.admin-frame`,
// phone shot in `.admin-phone`. The video is T4.2 and not tested here.
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import css from '../../styles/global.css?raw'
import * as illustrations from './Illustrations'
import * as sectionsModule from './sections'
import { adminTour, adminTourHead } from '../../config/site'
import { AdminTour } from './sections'



function expectSelected(container: HTMLElement, tabs: HTMLElement[], index: number) {
  tabs.forEach((tab, i) => {
    const panel = container.querySelector<HTMLElement>(`[id="${tab.getAttribute('aria-controls')}"]`)
    expect(panel, adminTour[i].id).not.toBeNull()
    expect(tab, adminTour[i].id).toHaveAttribute('aria-selected', String(i === index))
    expect(tab, adminTour[i].id).toHaveAttribute('tabindex', i === index ? '0' : '-1')
    expect(panel!.hasAttribute('hidden'), `${adminTour[i].id} panel hidden`).toBe(i !== index)
  })
}

describe('AdminTour section (T4.1)', () => {
  it('replaces Features: no Features export, no TodayGrid drawing; FeatureIcon and VenueFrame stay', () => {
    expect(sectionsModule).not.toHaveProperty('Features')
    expect(illustrations).not.toHaveProperty('TodayGrid')
    expect(illustrations).toHaveProperty('FeatureIcon')
    expect(illustrations).toHaveProperty('VenueFrame')
  })

  it('is one <section class="white" id="features"> with the head: label, h2 title and lead', () => {
    const { container, getByRole, getByText } = render(<AdminTour />)
    const sections = container.querySelectorAll('section')
    expect(sections).toHaveLength(1)
    expect(sections[0]).toHaveAttribute('id', 'features')
    expect(sections[0]).toHaveClass('white')
    expect(getByRole('heading', { level: 2, name: adminTourHead.title })).toBeInTheDocument()
    expect(getByText(adminTourHead.label)).toBeInTheDocument()
    expect(getByText(adminTourHead.lead)).toBeInTheDocument()
  })

  it('has a tablist labelled by the section title, with seven tabs in order, named by label', () => {
    const { getByRole } = render(<AdminTour />)
    const tablist = getByRole('tablist', { name: adminTourHead.title })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      'Dashboard',
      'Bookings',
      'Schedule',
      'Open Play',
      'Courts',
      'Reports',
      'Settings',
    ])
    for (const t of tabs) expect(t.tagName).toBe('BUTTON')
  })

  it('uses the ids admin-tab-<id> and admin-panel-<id>, each tab controlling its panel, labelled by that tab', () => {
    const { container, getAllByRole } = render(<AdminTour />)
    const tabs = getAllByRole('tab')
    tabs.forEach((tab, i) => {
      const id = adminTour[i].id
      expect(tab.id).toBe(`admin-tab-${id}`)
      expect(tab).toHaveAttribute('aria-controls', `admin-panel-${id}`)
      const panel = container.querySelector(`[id="admin-panel-${id}"]`)
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', `admin-tab-${id}`)
    })
  })

  it('shows one panel (Dashboard first) and keeps the other six in the DOM with the hidden attribute', () => {
    const { container, getAllByRole } = render(<AdminTour />)
    const panels = getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(7)
    expect(panels.filter((p) => p.hasAttribute('hidden'))).toHaveLength(6)
    expect(getAllByRole('tabpanel')).toHaveLength(1)
    expectSelected(container, getAllByRole('tab'), 0)
    expect(getAllByRole('tabpanel')[0]).toHaveAttribute('id', 'admin-panel-dashboard')
  })

  it('selects a tab on click, moving the roving tabindex and the visible panel', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole, getByRole } = render(<AdminTour />)
    await user.click(getByRole('tab', { name: 'Courts' }))
    expectSelected(container, getAllByRole('tab'), 4)
    await user.click(getByRole('tab', { name: 'Dashboard' }))
    expectSelected(container, getAllByRole('tab'), 0)
  })

  it('ArrowRight moves to the next tab and focuses it; at the last tab it wraps to the first', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<AdminTour />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expectSelected(container, tabs, 1)
    expect(tabs[1]).toHaveFocus()
    await user.click(tabs[6])
    await user.keyboard('{ArrowRight}')
    expectSelected(container, tabs, 0)
    expect(tabs[0]).toHaveFocus()
  })

  it('ArrowLeft moves to the previous tab; at the first tab it wraps to the last', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<AdminTour />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    await user.keyboard('{ArrowLeft}')
    expectSelected(container, tabs, 6)
    expect(tabs[6]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expectSelected(container, tabs, 5)
    expect(tabs[5]).toHaveFocus()
  })

  it('Home selects the first tab and End the last', async () => {
    const user = userEvent.setup()
    const { container, getAllByRole } = render(<AdminTour />)
    const tabs = getAllByRole('tab')
    await user.click(tabs[3])
    await user.keyboard('{End}')
    expectSelected(container, tabs, 6)
    expect(tabs[6]).toHaveFocus()
    await user.keyboard('{Home}')
    expectSelected(container, tabs, 0)
    expect(tabs[0]).toHaveFocus()
  })

  it('puts in each panel its title as an h3 and its callouts as <li> in a <ul>, in config order', () => {
    const { container } = render(<AdminTour />)
    for (const t of adminTour) {
      const panel = container.querySelector<HTMLElement>(`[id="admin-panel-${t.id}"]`)!
      const h3 = panel.querySelector('h3')
      expect(h3?.textContent, t.id).toBe(t.title)
      const items = [...panel.querySelectorAll('ul > li')].map((li) => li.textContent?.trim())
      expect(items, t.id).toEqual(t.callouts)
    }
  })
})

describe('AdminTour images (T4.1)', () => {
  it('draws every shot as an <img> with its src, alt, width and height, inside a .admin-frame', () => {
    const { container } = render(<AdminTour />)
    for (const t of adminTour) {
      const panel = container.querySelector<HTMLElement>(`[id="admin-panel-${t.id}"]`)!
      const frames = [...panel.querySelectorAll('.admin-frame img')]
      expect(frames.map((i) => i.getAttribute('src')), t.id).toEqual(t.shots.map((s) => s.src))
      t.shots.forEach((s, i) => {
        expect(frames[i], s.src).toHaveAttribute('alt', s.alt)
        expect(frames[i], s.src).toHaveAttribute('width', String(s.width))
        expect(frames[i], s.src).toHaveAttribute('height', String(s.height))
        expect(frames[i].closest('.admin-phone'), s.src).toBeNull()
      })
    }
  })

  it('shows the phone shot of Dashboard and Bookings in an .admin-phone, and no other tab has one', () => {
    const { container } = render(<AdminTour />)
    for (const t of adminTour) {
      const panel = container.querySelector<HTMLElement>(`[id="admin-panel-${t.id}"]`)!
      const phones = panel.querySelectorAll('.admin-phone img')
      if (!t.phone) {
        expect(phones, t.id).toHaveLength(0)
        continue
      }
      expect(phones, t.id).toHaveLength(1)
      expect(phones[0]).toHaveAttribute('src', t.phone.src)
      expect(phones[0]).toHaveAttribute('alt', t.phone.alt)
      expect(phones[0]).toHaveAttribute('width', '720')
      expect(phones[0]).toHaveAttribute('height', '1520')
    }
    expect(container.querySelectorAll('.admin-phone')).toHaveLength(2)
  })

  it('has ten images in all, every one with alt text of more than 10 characters and a size', () => {
    const { container } = render(<AdminTour />)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs).toHaveLength(10)
    for (const img of imgs) {
      expect(img.getAttribute('alt')?.trim().length, img.src).toBeGreaterThan(10)
      expect(Number(img.getAttribute('width')), img.src).toBeGreaterThan(0)
      expect(Number(img.getAttribute('height')), img.src).toBeGreaterThan(0)
    }
  })

  it('loads the first image of the first tab eagerly and every other image lazily; all decode async', () => {
    const { container } = render(<AdminTour />)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs[0]).toHaveAttribute('src', adminTour[0].shots[0].src)
    expect(imgs[0]).toHaveAttribute('loading', 'eager')
    for (const img of imgs.slice(1)) expect(img, img.getAttribute('src')!).toHaveAttribute('loading', 'lazy')
    for (const img of imgs) expect(img, img.getAttribute('src')!).toHaveAttribute('decoding', 'async')
  })

  it('first load: every image inside a hidden panel is lazy, so the six hidden panels fetch nothing', () => {
    const { container } = render(<AdminTour />)
    const hiddenImgs = [...container.querySelectorAll('[role="tabpanel"][hidden] img')]
    const expected = adminTour.slice(1).reduce((n, t) => n + t.shots.length + (t.phone ? 1 : 0), 0)
    expect(hiddenImgs).toHaveLength(expected)
    for (const img of hiddenImgs) expect(img, img.getAttribute('src')!).toHaveAttribute('loading', 'lazy')
  })
})

describe('AdminTour styles (T4.1; loose: the 360px look is checked by eye)', () => {
  /** The declarations of every rule whose selector list contains `selector` (exactly, comma-separated). */
  function declarations(selector: string): string {
    const out: string[] = []
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (m[1].split(',').some((s) => s.trim() === selector)) out.push(m[2])
    }
    return out.join(';')
  }
  const norm = (s: string) => s.replace(/\s+/g, '')

  it('styles .admin-tabs so the tabs never widen the page: they wrap, or scroll on their own', () => {
    const d = norm(declarations('.admin-tabs'))
    expect(d).not.toBe('')
    expect(/flex-wrap:wrap/.test(d) || /overflow-x:(auto|scroll)/.test(d)).toBe(true)
  })

  it.each(['.admin-frame img', '.admin-phone img'])('keeps %s inside its column: max-width 100% and height auto', (sel) => {
    const d = norm(declarations(sel))
    expect(d, sel).toMatch(/max-width:100%/)
    expect(d, sel).toMatch(/height:auto/)
  })
})
