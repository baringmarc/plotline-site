import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  /** Names the slider for screen readers, e.g. "Venues". */
  label: string
  children: ReactNode
  /** Two rows filled top to bottom, then across: for long lists of small cards. */
  twoRows?: boolean
}

/**
 * A horizontal card row using native scrolling with scroll-snap, so swiping works on phones.
 * The arrows move by as many columns as fit on screen, and each end greys out its arrow.
 */
export function Slider({ label, children, twoRows = false }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const updateEdges = useCallback(() => {
    const t = track.current
    if (!t) return
    setAtStart(t.scrollLeft < 8)
    setAtEnd(t.scrollLeft + t.clientWidth >= t.scrollWidth - 8)
  }, [])

  useEffect(() => {
    const t = track.current
    if (!t) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateEdges)
    }
    updateEdges()
    t.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      cancelAnimationFrame(frame)
      t.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateEdges)
    }
  }, [updateEdges, children])

  const slide = (dir: -1 | 1) => {
    const t = track.current
    if (!t) return
    const trackLeft = t.getBoundingClientRect().left
    // Where each column starts. Cards stacked in two rows share a column, so count each once.
    const lefts: number[] = []
    for (const card of Array.from(t.children)) {
      const x = Math.round(card.getBoundingClientRect().left - trackLeft + t.scrollLeft)
      if (!lefts.some((l) => Math.abs(l - x) < 4)) lefts.push(x)
    }
    lefts.sort((a, b) => a - b)
    if (lefts.length === 0) return
    const first = Math.max(0, lefts.findIndex((l) => l >= t.scrollLeft - 8))
    const colWidth = lefts.length > 1 ? lefts[1] - lefts[0] : t.clientWidth
    const perScreen = Math.max(1, Math.floor((t.clientWidth + 8) / colWidth))
    const to = Math.min(lefts.length - 1, Math.max(0, first + dir * perScreen))
    const target = Math.max(0, lefts[to] - 4)
    t.scrollTo({ left: target, behavior: 'smooth' })
    // Some browsers stall a smooth scroll on a snapping row; finish the move if it has not arrived.
    window.setTimeout(() => {
      if (Math.abs(t.scrollLeft - target) > 6) {
        t.style.scrollBehavior = 'auto'
        t.scrollLeft = target
        t.style.scrollBehavior = ''
        updateEdges()
      }
    }, 700)
  }

  return (
    <div className="slider" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={track} className={twoRows ? 'track rows2' : 'track'}>
        {children}
      </div>
      <div className="varrows">
        <button type="button" className="varrow" aria-label={`Previous ${label.toLowerCase()}`} disabled={atStart} onClick={() => slide(-1)}>
          ‹
        </button>
        <button type="button" className="varrow" aria-label={`More ${label.toLowerCase()}`} disabled={atEnd} onClick={() => slide(1)}>
          ›
        </button>
      </div>
    </div>
  )
}
