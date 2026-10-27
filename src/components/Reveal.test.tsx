import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Reveal } from './Reveal'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

/** A stand-in IntersectionObserver whose callback the test fires by hand. */
function stubObserver() {
  const observer = { callback: null as Callback | null, disconnect: vi.fn() }
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: Callback) {
        observer.callback = cb
      }
      observe() {}
      disconnect = observer.disconnect
    },
  )
  return observer
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Reveal', () => {
  it('shows its content straight away without IntersectionObserver', () => {
    render(<Reveal>Hello</Reveal>)
    expect(screen.getByText('Hello')).not.toHaveClass('wait')
  })

  it('shows its content straight away when the visitor turns motion off', () => {
    stubObserver()
    stubReducedMotion(true)
    render(<Reveal>Hello</Reveal>)
    expect(screen.getByText('Hello')).not.toHaveClass('wait')
  })

  it('waits until it scrolls into view, then stops watching', () => {
    const observer = stubObserver()
    stubReducedMotion(false)
    render(<Reveal delay={80}>Hello</Reveal>)
    const el = screen.getByText('Hello')
    expect(el).toHaveClass('reveal', 'wait')
    expect(el).toHaveStyle({ transitionDelay: '80ms' })

    act(() => observer.callback?.([{ isIntersecting: false }]))
    expect(el).toHaveClass('wait')

    act(() => observer.callback?.([{ isIntersecting: true }]))
    expect(el).not.toHaveClass('wait')
    expect(observer.disconnect).toHaveBeenCalled()
  })
})
