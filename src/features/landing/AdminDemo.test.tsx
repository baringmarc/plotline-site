// T4.2 Demo video in the tour: the "Watch the demo" block (`AdminDemo` in sections.tsx), rendered inside `AdminTour`
// (section #features), outside the tab panels. Poster: set straight away without IntersectionObserver (jsdom),
// otherwise once the block nears the viewport (the Reveal.tsx pattern).
import { act, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import css from '../../styles/global.css?raw'
import { adminDemo } from '../../config/site'
import * as sectionsModule from './sections'
import { AdminTour } from './sections'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

/** A stand-in IntersectionObserver whose callback the test fires by hand. */
function stubObserver() {
  const observer = { callback: null as Callback | null, observe: vi.fn(), disconnect: vi.fn() }
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: Callback) {
        observer.callback = cb
      }
      observe = observer.observe
      unobserve() {}
      disconnect = observer.disconnect
      takeRecords() {
        return []
      }
    },
  )
  return observer
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const video = (container: HTMLElement) => {
  const all = container.querySelectorAll('video')
  expect(all).toHaveLength(1)
  return all[0]
}

describe('AdminDemo block (T4.2)', () => {
  it('is exported from sections as AdminDemo', () => {
    expect(sectionsModule).toHaveProperty('AdminDemo')
  })

  it('renders inside AdminTour’s #features section, with the "Watch the demo" heading and the one-line caption', () => {
    const { container, getByRole, getByText } = render(<AdminTour />)
    const section = container.querySelector('section#features')!
    expect(section).not.toBeNull()
    expect(section.contains(video(container))).toBe(true)
    const heading = getByRole('heading', { level: 3, name: adminDemo.title })
    expect(section.contains(heading)).toBe(true)
    expect(section.contains(getByText(adminDemo.caption))).toBe(true)
  })

  it('sits outside the tab panels, so it shows whichever tab is active', async () => {
    const user = userEvent.setup()
    const { container, getByRole } = render(<AdminTour />)
    expect(video(container).closest('[role="tabpanel"]')).toBeNull()
    expect(video(container).closest('[hidden]')).toBeNull()
    await user.click(getByRole('tab', { name: 'Settings' }))
    expect(video(container).closest('[hidden]')).toBeNull()
    expect(getByRole('heading', { level: 3, name: adminDemo.title })).toBeVisible()
  })

  it('has controls, no autoplay and preload="none"', () => {
    const { container } = render(<AdminTour />)
    const v = video(container)
    expect(v).toHaveAttribute('controls')
    expect(v).not.toHaveAttribute('autoplay')
    expect(v.autoplay).toBe(false)
    expect(v).toHaveAttribute('preload', 'none')
    expect(v).not.toHaveAttribute('loop')
  })

  it('declares width 1280 and height 720 so the box keeps its aspect ratio before anything loads', () => {
    const { container } = render(<AdminTour />)
    const v = video(container)
    expect(v).toHaveAttribute('width', String(adminDemo.width))
    expect(v).toHaveAttribute('height', String(adminDemo.height))
    expect(v).toHaveAttribute('width', '1280')
    expect(v).toHaveAttribute('height', '720')
  })

  it('has the sources as <source> children in config order (WebM first, then MP4), each with its type', () => {
    const { container } = render(<AdminTour />)
    const v = video(container)
    expect(v).not.toHaveAttribute('src')
    const sources = [...v.querySelectorAll('source')].map((s) => ({ src: s.getAttribute('src'), type: s.getAttribute('type') }))
    expect(sources).toEqual(adminDemo.sources)
    expect(sources.map((s) => s.type)).toEqual(['video/webm', 'video/mp4'])
  })

  it('has a captions <track> from the WebVTT file, with srclang and label, not on by default (captions are burned in)', () => {
    const { container } = render(<AdminTour />)
    const tracks = video(container).querySelectorAll('track')
    expect(tracks).toHaveLength(1)
    const t = tracks[0]
    expect(t).toHaveAttribute('kind', 'captions')
    expect(t).toHaveAttribute('src', adminDemo.captions.src)
    expect(t).toHaveAttribute('src', '/admin-tour/admin-demo.vtt')
    expect(t).toHaveAttribute('srclang', adminDemo.captions.srclang)
    expect(t).toHaveAttribute('label', adminDemo.captions.label)
    expect(t).not.toHaveAttribute('default')
  })

  it('without IntersectionObserver (jsdom), sets the poster straight away', () => {
    expect(typeof IntersectionObserver).toBe('undefined')
    const { container } = render(<AdminTour />)
    expect(video(container)).toHaveAttribute('poster', adminDemo.poster)
    expect(video(container)).toHaveAttribute('poster', '/admin-tour/admin-demo-poster.jpg')
  })

  it('first load: with IntersectionObserver, no poster until the block nears the viewport, then the poster and the observer stops', () => {
    const observer = stubObserver()
    const { container } = render(<AdminTour />)
    const v = video(container)
    expect(v).not.toHaveAttribute('poster')
    expect(observer.observe).toHaveBeenCalled()

    act(() => observer.callback?.([{ isIntersecting: false }]))
    expect(v).not.toHaveAttribute('poster')

    act(() => observer.callback?.([{ isIntersecting: true }]))
    expect(v).toHaveAttribute('poster', adminDemo.poster)
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('first load: the block adds no <img> to the tour (still ten) and nothing that fetches the video before play', () => {
    const { container } = render(<AdminTour />)
    expect(container.querySelectorAll('img')).toHaveLength(10)
    const v = video(container)
    expect(v).toHaveAttribute('preload', 'none')
    expect(v).not.toHaveAttribute('autoplay')
    expect(container.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('the caption is in the block, next to the video (same .admin-demo container)', () => {
    const { container, getByText } = render(<AdminTour />)
    const block = video(container).closest('.admin-demo')
    expect(block).not.toBeNull()
    expect(within(block as HTMLElement).getByText(adminDemo.caption)).toBe(getByText(adminDemo.caption))
  })
})

describe('AdminDemo styles (T4.2; loose: the look is checked by eye)', () => {
  function declarations(selector: string): string {
    const out: string[] = []
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (m[1].split(',').some((s) => s.trim() === selector)) out.push(m[2])
    }
    return out.join(';')
  }
  const norm = (s: string) => s.replace(/\s+/g, '')

  it('keeps .admin-demo video inside its column with a fixed 16:9 box: max-width 100%, height auto or aspect-ratio 16/9', () => {
    const d = norm(declarations('.admin-demo video'))
    expect(d).toMatch(/max-width:100%|width:100%/)
    expect(/height:auto/.test(d) || /aspect-ratio:16\/9/.test(d)).toBe(true)
  })
})
