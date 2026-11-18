// T8.3 TV board (TASKS.md T8.3: "the board, TV, call-outs and share image show singles courts correctly (one name a
// side) and the title"). Copy from `paddleStack.tv`.
//
// Structure the tests rely on (the plan's names):
// - `TvBoard({ session, nowOn, onExit })`; the title in an element with class `stack-tv-title` when the session
//   has one, nothing when it's empty;
// - a singles court (region `${tv.court} ${n}`) shows one name a side, with no "&";
// - Up next (region `tv.upNext`) shows the next 2 in singles, the next 4 in doubles.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { TvBoard } from './TvBoard'
import type { Session } from './types'

const { tv } = paddleStack
const NAMES = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Fred']

function renderTv(s: Session) {
  return render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} />)
}

const court = (n: number) => screen.getByRole('region', { name: `${tv.court} ${n}` })
const shownLine = () =>
  within(screen.getByRole('region', { name: tv.upNext }))
    .queryAllByRole('listitem')
    .map((li) => li.textContent?.trim() ?? '')

describe('TvBoard title (T8.3)', () => {
  it('shows the session title in .stack-tv-title', () => {
    const { container } = renderTv(fillCourts(createSession({ format: 'fair', courts: 1, title: 'Sunday Open Play (ALL LEVELS)', names: NAMES })))
    const el = container.querySelector('.stack-tv-title')
    expect(el).not.toBeNull()
    expect(el!.textContent?.trim()).toBe('Sunday Open Play (ALL LEVELS)')
  })

  it('shows no title element when the session has none', () => {
    const { container } = renderTv(fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES })))
    expect(container.querySelector('.stack-tv-title')).toBeNull()
  })
})

describe('TvBoard singles (T8.3)', () => {
  const singles = (courts: number, names = NAMES) => fillCourts(createSession({ format: 'fair', courts, play: 'singles', names }))

  it('each court shows one name a side, with no "&"', () => {
    renderTv(singles(2))
    const c1 = court(1)
    expect(c1).toHaveTextContent('Andrew')
    expect(c1).toHaveTextContent('Maria')
    expect(c1).toHaveTextContent(tv.vs)
    expect(c1.textContent).not.toContain('&')
    const c2 = court(2)
    expect(c2).toHaveTextContent('Juan')
    expect(c2).toHaveTextContent('Jose')
    expect(c1).not.toHaveTextContent('Juan')
  })

  it('Up next shows only the next 2, in line order', () => {
    // 10 players on 2 singles courts: Ana, Ben, Carla, Dino, Ella, Fred wait.
    renderTv(singles(2))
    const items = shownLine()
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Ana')
    expect(items[1]).toContain('Ben')
  })

  it('Up next shows fewer when fewer wait', () => {
    renderTv(singles(1, NAMES.slice(0, 3)))
    expect(shownLine()).toEqual(['Juan'])
  })

  it('doubles still shows the next 4', () => {
    renderTv(fillCourts(createSession({ format: 'fair', courts: 1, play: 'doubles', names: NAMES })))
    expect(shownLine()).toHaveLength(4)
  })
})
