// T8.3 on the Stack page (TASKS.md T8.3 and its plan gate, user 2026-11-18: "the start form gets a title box and a
// Singles/Doubles choice now (Winners stay hidden in singles), while levels and fixed pairs stay engine-only until
// T8.5"; SPEC §4 "Paddle Stack rules"). Copy from `paddleStack` (src/config/paddleStack.ts, re-exported by site.ts).
//
// Structure the tests rely on (the plan's names):
// - start form: a text box labelled `start.titleLabel` (maxLength 60, placeholder `start.titlePlaceholder`); a
//   radio group (fieldset, legend `start.playLabel`) with one radio per `start.plays[].label`, doubles checked by
//   default; in singles the `winners-split` format radio is not shown, and if it was chosen the choice resets to
//   Fair rotation; singles needs 2 players (`start.needTwo`), doubles 4 (`start.needFour`);
// - the trimmed title reaches the session (`session.title`), and the board shows it as a heading with class
//   `stack-title` when set;
// - a singles court shows one name a side (no "&"), its score boxes are named `${board.scoreFor} <name>`;
// - with call-outs on, a filled singles court is called "Court 1: A, versus B.".
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { StackPage } from './StackPage'
import { loadStack, saveStack, saveVoicePref } from './storage'
import { announce, canSpeak, requestWakeLock } from './voice'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return {
    ...actual,
    canSpeak: vi.fn(() => true),
    announce: vi.fn(() => true),
    requestWakeLock: vi.fn(() => Promise.resolve(() => {})),
  }
})

const { start, board, standings, tv } = paddleStack
const SIX = '1. Andrew\n2. Maria\n3. Juan\n4. Jose\n5. Ana\n6. Ben'

type User = ReturnType<typeof userEvent.setup>

class MemoryStorage {
  #items = new Map<string, string>()
  getItem(k: string) {
    return this.#items.has(k) ? this.#items.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  vi.mocked(canSpeak).mockReset().mockReturnValue(true)
  vi.mocked(announce).mockReset().mockReturnValue(true)
  vi.mocked(requestWakeLock).mockReset().mockResolvedValue(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/paddle-stack']}>
      <StackPage />
    </MemoryRouter>,
  )
}

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const formatLabel = (id: string) => paddleStack.formats.find((f) => f.id === id)!.label
const playLabel = (id: 'singles' | 'doubles') => start.plays.find((p) => p.id === id)!.label
const formatRadio = (id: string) => screen.queryByRole('radio', { name: re(formatLabel(id)) })
const playGroup = () => screen.getByRole('group', { name: start.playLabel })
const playRadio = (id: 'singles' | 'doubles') => within(playGroup()).getByRole('radio', { name: re(playLabel(id)) })
const titleBox = () => screen.getByRole('textbox', { name: start.titleLabel })
const court = (n: number) => screen.getByRole('region', { name: `${board.court} ${n}` })

async function fillStart(user: User, opts: { title?: string; play?: 'singles' | 'doubles'; format?: string; names?: string } = {}) {
  await user.selectOptions(screen.getByLabelText(start.courtsLabel), '1')
  if (opts.play) await user.click(playRadio(opts.play))
  if (opts.format) await user.click(formatRadio(opts.format)!)
  if (opts.title !== undefined) {
    await user.click(titleBox())
    await user.paste(opts.title)
  }
  const box = screen.getByRole('textbox', { name: start.namesLabel })
  await user.click(box)
  await user.paste(opts.names ?? SIX)
  await user.click(screen.getByRole('button', { name: start.submit }))
}

describe('start form: title box (T8.3)', () => {
  it('has a title text box from config, capped at 60 characters', () => {
    renderPage()
    const box = titleBox()
    expect(box).toHaveAttribute('maxLength', '60')
    expect(box).toHaveAttribute('placeholder', start.titlePlaceholder)
    expect(box).toHaveValue('')
    expect(start.titleLabel.length).toBeGreaterThan(0)
  })

  it('the trimmed title reaches the session', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { title: '  Sunday Open Play (ALL LEVELS)  ' })
    expect(loadStack()!.session.title).toBe('Sunday Open Play (ALL LEVELS)')
  })

  it('no title gives a session with an empty title', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user)
    expect(loadStack()!.session.title).toBe('')
  })
})

describe('start form: Singles or Doubles (T8.3)', () => {
  it('is a radio group with a radio per config entry, doubles checked by default', () => {
    renderPage()
    expect(start.plays.map((p) => p.id)).toEqual(['singles', 'doubles'])
    const radios = within(playGroup()).getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(playRadio('doubles')).toBeChecked()
    expect(playRadio('singles')).not.toBeChecked()
  })

  it('doubles offers all three formats', () => {
    renderPage()
    for (const id of ['fair', 'winners-split', 'americano']) expect(formatRadio(id), id).toBeInTheDocument()
  })

  it('singles hides Winners stay & split and keeps Fair rotation and Americano', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(playRadio('singles'))
    expect(playRadio('singles')).toBeChecked()
    expect(formatRadio('winners-split')).not.toBeInTheDocument()
    expect(formatRadio('fair')).toBeInTheDocument()
    expect(formatRadio('americano')).toBeInTheDocument()
  })

  it('if Winners stay was chosen, switching to singles resets the choice to Fair rotation', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(formatRadio('winners-split')!)
    expect(formatRadio('winners-split')).toBeChecked()
    await user.click(playRadio('singles'))
    expect(formatRadio('fair')).toBeChecked()
    expect(formatRadio('americano')).not.toBeChecked()
  })

  it('Americano stays chosen when switching to singles', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(formatRadio('americano')!)
    await user.click(playRadio('singles'))
    expect(formatRadio('americano')).toBeChecked()
  })

  it('switching back to doubles shows Winners stay again', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(playRadio('singles'))
    await user.click(playRadio('doubles'))
    expect(formatRadio('winners-split')).toBeInTheDocument()
  })

  it('the choice reaches the session: singles, open queue', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles', format: 'americano' })
    const s = loadStack()!.session
    expect(s.play).toBe('singles')
    expect(s.teams).toBe('open')
    expect(s.format).toBe('americano')
  })

  it('the default reaches the session as doubles', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user)
    expect(loadStack()!.session.play).toBe('doubles')
  })

  it('singles starts with 2 players', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles', names: 'Andrew\nMaria' })
    expect(screen.queryByText(start.needTwo)).not.toBeInTheDocument()
    expect(court(1)).toHaveTextContent('Andrew')
    expect(court(1)).toHaveTextContent('Maria')
  })

  it('singles with 1 player shows start.needTwo and doesn’t start', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles', names: 'Andrew' })
    expect(screen.getByRole('alert')).toHaveTextContent(start.needTwo)
    expect(loadStack()).toBeNull()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
  })

  it('doubles with 3 players still shows start.needFour', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { names: 'Andrew\nMaria\nJuan' })
    expect(screen.getByRole('alert')).toHaveTextContent(start.needFour)
    expect(loadStack()).toBeNull()
  })

  it('singles with 3 players starts (3 is enough for singles)', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles', names: 'Andrew\nMaria\nJuan' })
    expect(loadStack()).not.toBeNull()
  })
})

describe('the board shows the title (T8.3)', () => {
  it('shows the title as a heading with class stack-title', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { title: 'Sunday Open Play (ALL LEVELS)' })
    const heading = screen.getByRole('heading', { name: 'Sunday Open Play (ALL LEVELS)' })
    expect(heading).toHaveClass('stack-title')
  })

  it('shows no title heading when the session has none', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await fillStart(user)
    expect(container.querySelector('.stack-title')).toBeNull()
  })

  it('a saved session’s title shows after a reload', () => {
    saveStack({ session: fillCourts(createSession({ format: 'fair', courts: 1, title: 'Friday Night', names: ['A', 'B', 'C', 'D'] })), ended: false })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Friday Night' })).toHaveClass('stack-title')
  })

  it('TV mode shows the title too (class stack-tv-title)', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await fillStart(user, { title: 'Sunday Open Play' })
    await user.click(screen.getByRole('button', { name: tv.open }))
    const el = container.querySelector('.stack-tv-title')
    expect(el).not.toBeNull()
    expect(el).toHaveTextContent('Sunday Open Play')
  })
})

describe('a singles board (T8.3: one name a side)', () => {
  it('each court shows one name a side, with no "&"', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles' })
    const teams = court(1).querySelector('.stack-teams')!
    expect(teams).toHaveTextContent('Andrew')
    expect(teams).toHaveTextContent('Maria')
    expect(teams).toHaveTextContent(board.vs)
    expect(teams.textContent).not.toContain('&')
    expect(court(1)).not.toHaveTextContent('Juan')
  })

  it('the score boxes are named and labelled by one player each', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles' })
    await user.click(within(court(1)).getByRole('button', { name: board.enterScore }))
    const a = within(court(1)).getByRole('textbox', { name: `${board.scoreFor} Andrew` })
    const b = within(court(1)).getByRole('textbox', { name: `${board.scoreFor} Maria` })
    const labelText = (el: HTMLElement) => [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? '').join(' ')
    expect(labelText(a)).toContain('Andrew')
    expect(labelText(a)).not.toContain('&')
    expect(labelText(b)).toContain('Maria')
  })

  it('a scored singles game rotates the next two on and counts in the standings', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles' })
    await user.click(within(court(1)).getByRole('button', { name: board.enterScore }))
    await user.type(within(court(1)).getByRole('textbox', { name: `${board.scoreFor} Andrew` }), '11')
    await user.type(within(court(1)).getByRole('textbox', { name: `${board.scoreFor} Maria` }), '6')
    await user.click(within(court(1)).getByRole('button', { name: board.saveScore }))
    expect(court(1)).toHaveTextContent('Juan')
    expect(court(1)).toHaveTextContent('Jose')
    const table = screen.getByRole('table', { name: standings.title })
    const andrew = within(table).getAllByRole('row').find((r) => r.textContent?.includes('Andrew'))!
    expect(andrew.querySelectorAll('td')[2]).toHaveTextContent('1')
  })

  it('call-outs name one player a side: "Court 1: Andrew, versus Maria."', async () => {
    saveVoicePref(true)
    const user = userEvent.setup()
    renderPage()
    await fillStart(user, { play: 'singles' })
    expect(announce).toHaveBeenCalledWith('Court 1: Andrew, versus Maria.')
  })
})
