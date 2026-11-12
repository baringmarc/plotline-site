// T5.4 TV board (TASKS.md T5.4; SPEC §3 `/paddle-stack` row): the same session for a big screen facing the courts:
// large court cards, the next four, a "Next up on Court N" banner (the user's call,
// 2026-11-12), and a small footer. Copy from `paddleStack.tv`.
//
// Accessible structure the tests rely on (the plan's names):
// - `TvBoard({ session, nowOn, onExit })`;
// - each court a region named `${tv.court} ${n}` showing the four names, or `tv.waiting` when empty;
// - "Up next" a region named `tv.upNext` with one listitem per shown player (the next four, in line order),
//   or `tv.lineEmpty` when nobody waits;
// - the banner text `${tv.nowOn} ${nowOn}` only when `nowOn` is set;
// - footer text `tv.footer`; a button named `tv.exit`; Escape also calls `onExit`.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts, removePlayer, timeOut } from './engine'
import { TvBoard } from './TvBoard'
import type { Session } from './types'

const { tv } = paddleStack
const NAMES = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Fred', 'Gina', 'Hugo', 'Ivy', 'Jun']

function session(courts: number, names: string[] = NAMES): Session {
  return fillCourts(createSession({ format: 'fair', courts, names }))
}

function renderTv(s: Session, nowOn: number | null = null, onExit = vi.fn()) {
  render(<TvBoard session={s} nowOn={nowOn} onExit={onExit} />)
  return onExit
}

const court = (n: number) => screen.getByRole('region', { name: `${tv.court} ${n}` })
const upNext = () => screen.getByRole('region', { name: tv.upNext })
const shownLine = () =>
  within(upNext())
    .queryAllByRole('listitem')
    .map((li) => li.textContent?.trim() ?? '')

describe('TvBoard courts (T5.4 large court cards)', () => {
  it('shows a card per court with both teams of the game on it', () => {
    renderTv(session(2))
    // Fair rotation: positions 1 & 3 against 2 & 4.
    const c1 = court(1)
    for (const name of ['Andrew', 'Maria', 'Juan', 'Jose']) expect(c1, name).toHaveTextContent(name)
    expect(c1).toHaveTextContent(tv.vs)
    const c2 = court(2)
    for (const name of ['Ana', 'Ben', 'Carla', 'Dino']) expect(c2, name).toHaveTextContent(name)
    expect(c1).not.toHaveTextContent('Ana')
  })

  it('shows tv.waiting on a court with no game', () => {
    // 6 players, 2 courts: court 2 has no game.
    renderTv(session(2, NAMES.slice(0, 6)))
    expect(court(2)).toHaveTextContent(tv.waiting)
    expect(court(1)).not.toHaveTextContent(tv.waiting)
  })

  it('has no score or line controls: the TV only shows the session', () => {
    renderTv(session(2))
    const buttons = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(buttons).toEqual([tv.exit])
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('TvBoard up next (T5.4 the next four)', () => {
  it('shows only the next four waiting players, in line order', () => {
    // 14 players on 2 courts: Ella, Fred, Gina, Hugo, Ivy, Jun wait.
    renderTv(session(2))
    const items = shownLine()
    expect(items).toHaveLength(4)
    ;['Ella', 'Fred', 'Gina', 'Hugo'].forEach((name, i) => expect(items[i], `position ${i + 1}`).toContain(name))
    expect(upNext()).not.toHaveTextContent('Ivy')
    expect(upNext()).not.toHaveTextContent('Jun')
  })

  it('shows fewer when fewer wait', () => {
    renderTv(session(2, NAMES.slice(0, 10)))
    const items = shownLine()
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Ella')
    expect(items[1]).toContain('Fred')
  })

  it('leaves out players on a time out and removed players', () => {
    let s = session(2)
    const id = (name: string) => s.players.find((p) => p.name === name)!.id
    s = timeOut(s, id('Ella'))
    s = removePlayer(s, id('Fred'))
    renderTv(s)
    const items = shownLine()
    expect(items).toHaveLength(4)
    ;['Gina', 'Hugo', 'Ivy', 'Jun'].forEach((name, i) => expect(items[i], `position ${i + 1}`).toContain(name))
    expect(upNext()).not.toHaveTextContent('Ella')
    expect(upNext()).not.toHaveTextContent('Fred')
  })

  it('shows tv.lineEmpty when nobody is waiting', () => {
    renderTv(session(1, NAMES.slice(0, 4)))
    expect(shownLine()).toHaveLength(0)
    expect(upNext()).toHaveTextContent(tv.lineEmpty)
  })
})

describe('TvBoard banner (T5.4 "Next up on Court N")', () => {
  it('the banner keeps the task wording, "Next up on Court N" (user, 2026-11-12)', () => {
    expect(tv.nowOn).toBe('Next up on Court')
    renderTv(session(2), 2)
    expect(document.body).toHaveTextContent('Next up on Court 2')
  })

  it('shows the banner for the court in nowOn', () => {
    renderTv(session(2), 2)
    expect(document.body).toHaveTextContent(`${tv.nowOn} 2`)
    expect(document.body).not.toHaveTextContent(`${tv.nowOn} 1`)
  })

  it('shows no banner when nowOn is null', () => {
    renderTv(session(2), null)
    expect(document.body).not.toHaveTextContent(tv.nowOn)
  })
})

describe('TvBoard footer and exit (T5.4)', () => {
  it('shows the small footer from config', () => {
    renderTv(session(1))
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
  })

  it('the exit button calls onExit', async () => {
    const user = userEvent.setup()
    const onExit = renderTv(session(1))
    await user.click(screen.getByRole('button', { name: tv.exit }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Escape calls onExit', async () => {
    const user = userEvent.setup()
    const onExit = renderTv(session(1))
    await user.keyboard('{Escape}')
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('other keys do not exit', async () => {
    const user = userEvent.setup()
    const onExit = renderTv(session(1))
    await user.keyboard('a{ArrowDown}{Tab}')
    expect(onExit).not.toHaveBeenCalled()
  })

  it('stops listening for Escape once unmounted', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()
    const { unmount } = render(<TvBoard session={session(1)} nowOn={null} onExit={onExit} />)
    unmount()
    await user.keyboard('{Escape}')
    expect(onExit).not.toHaveBeenCalled()
  })
})
