import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** Milliseconds to wait after it scrolls into view, to stagger a row of cards. */
  delay?: number
}

/** Whether to fade in at all: needs IntersectionObserver, and is off when the visitor turns motion off. */
function canAnimate(): boolean {
  if (typeof IntersectionObserver === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Fades its children in the first time they scroll into view.
 * Content is only hidden while an observer is watching it, so nothing can get stuck invisible.
 */
export function Reveal({ children, className, delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [waiting, setWaiting] = useState(canAnimate)

  useEffect(() => {
    const el = ref.current
    if (!waiting || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWaiting(false)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [waiting])

  const classes = ['reveal', waiting && 'wait', className].filter(Boolean).join(' ')
  return (
    <div ref={ref} className={classes} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}
