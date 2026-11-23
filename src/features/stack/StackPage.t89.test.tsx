// T8.9 on the organizer's board (TASKS.md T8.9: 'Board: "Pair with…" on a waiting player, a locked pair shown
// together with an Unlock; Add players no longer pairs names by order'; "Decided at the start of the build (user,
// 2026-11-23)": an all-pairs Round Robin gets Add a pair instead of Add players, and Round Robin has no Unlock; SPEC §6
// T8.9 build row: Unlock where a pair is listed (the line, the time-out list), not on the court card). Copy from
// `paddleStack.board` (src/config/paddleStack.ts, re-exported by site.ts).
//
// Structure the tests rely on (the plan's names):
// - Up next (region `board.upNext`): where the board offers locks (doubles, not Americano, Mexicano or Round Robin),
//   each solo waiting player has a `<select>` named `board.pairWith(name)`: first option `board.pairPlaceholder`
//   (value ''), then the other solo players waiting or out (value = player id). Picking one locks the pair;
// - a locked pair is one list item showing `${a} & ${b}` (the order they joined), with buttons named
//   `${board.timeOut} ${a} & ${b}`, `${board.remove} ${a} & ${b}` and `${board.unlock} ${a} & ${b}` (no Unlock in
//   Round Robin); the time-out list shows a pair the same way with `${board.backInLine} ${a} & ${b}` and Unlock;
// - an all-pairs Round Robin replaces Add players with an Add a pair form: inputs labelled `board.addPairFirst` and
//   `board.addPairSecond`, submit `board.addPairSubmit`, under `board.addPairLabel`. Elsewhere Add players
//   (`board.addLabel`) adds names one by one.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { addPlayers, createSession, fillCourts, lockPair, timeOut } from './engine'
import { StackPage } from './StackPage'
import { loadStack, saveStack } from './storage'
import type { Format, Play, Session } from './types'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => false), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

const { board } = paddleStack

// Node 25's own `localStorage` global has no methods in this test environment, so use an in-memory one.
class MemoryStorage {
  #items = new Map<string, string>()
  getItem(k: string) {
    return this.#items.get(k) ?? null
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
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const NAMES = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal']

function renderBoard(s: Session) {
  saveStack({ session: s, ended: false })
  return render(
    <MemoryRouter initialEntries={['/paddle-stack']}>
      <StackPage />
    </MemoryRouter>,
  )
}

const id = (s: Session, name: string) => s.players.find((p) => p.name === name)!.id
const saved = () => loadStack()!.session
const savedPlayer = (name: string) => saved().players.find((p) => p.name === name)!
const savedLine = () => {
  const s = saved()
  return s.line.map((x) => s.players.find((p) => p.id === x)!.name)
}
const upNext = () => screen.getByRole('region', { name: board.upNext })
const items = () => within(upNext()).queryAllByRole('listitem')
const court = (n: number) => screen.getByRole('region', { name: `${board.court} ${n}` })
const pairSelect = (name: string) => screen.queryByRole('combobox', { name: board.pairWith(name) })
const button = (name: string) => screen.queryByRole('button', { name })
const options = (select: HTMLElement) =>
  (within(select).getAllByRole('option') as HTMLOptionElement[]).map((o) => ({ value: o.value, text: o.textContent }))

/**
 * Fair rotation, one court: Ana, Ben, Cy and Dee play; Eli, Fay and Gus wait; Hal is on a time out.
 */
function base(): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES }))
  s = timeOut(s, id(s, 'Hal'))
  return s
}
/** `base()` with Eli and Gus locked: the line is Fay, then Eli & Gus. */
function locked(): Session {
  const s = base()
  return lockPair(s, id(s, 'Eli'), id(s, 'Gus'))
}

describe('Up next: "Pair with…" on a solo waiting player (T8.9)', () => {
  it('each solo waiting player has a picker: the placeholder first, then the other solo players waiting or out', () => {
    const s = base()
    renderBoard(s)
    for (const name of ['Eli', 'Fay', 'Gus']) {
      const select = pairSelect(name)
      expect(select, `${name} has a pair picker`).not.toBeNull()
      const opts = options(select!)
      expect(opts[0]).toEqual({ value: '', text: board.pairPlaceholder })
      const others = ['Eli', 'Fay', 'Gus', 'Hal'].filter((n) => n !== name)
      expect(opts.slice(1).map((o) => o.value).sort(), name).toEqual(others.map((n) => id(s, n)).sort())
      expect(opts.slice(1).map((o) => o.text).sort(), name).toEqual([...others].sort())
      expect((select as HTMLSelectElement).value).toBe('')
    }
    // Players on court can't be picked.
    for (const name of ['Ana', 'Ben', 'Cy', 'Dee']) expect(pairSelect(name), name).toBeNull()
  })

  it('picking a partner locks the pair: one list item "Eli & Gus" with Time out, Remove and Unlock', async () => {
    const user = userEvent.setup()
    const s = base()
    renderBoard(s)
    await user.selectOptions(pairSelect('Eli')!, id(s, 'Gus'))
    expect(savedPlayer('Eli').partner).toBe(id(s, 'Gus'))
    expect(savedPlayer('Gus').partner).toBe(id(s, 'Eli'))
    expect(savedLine()).toEqual(['Fay', 'Eli', 'Gus'])
    const list = items()
    expect(list).toHaveLength(2)
    expect(list[0]).toHaveTextContent('Fay')
    expect(list[1]).toHaveTextContent('Eli & Gus')
    for (const label of [board.timeOut, board.remove, board.unlock]) {
      expect(within(list[1]).getByRole('button', { name: `${label} Eli & Gus` })).toBeInTheDocument()
    }
    expect(pairSelect('Eli')).toBeNull()
    expect(pairSelect('Gus')).toBeNull()
    expect(options(pairSelect('Fay')!).map((o) => o.value)).toEqual(['', id(s, 'Hal')])
  })

  it('Unlock splits the pair where it stands: two solo items again, each with a picker', async () => {
    const user = userEvent.setup()
    renderBoard(locked())
    await user.click(button(`${board.unlock} Eli & Gus`)!)
    expect(savedPlayer('Eli').partner).toBeUndefined()
    expect(savedPlayer('Gus').partner).toBeUndefined()
    expect(savedLine()).toEqual(['Fay', 'Eli', 'Gus'])
    expect(items()).toHaveLength(3)
    expect(pairSelect('Eli')).not.toBeNull()
    expect(pairSelect('Gus')).not.toBeNull()
    expect(button(`${board.unlock} Eli & Gus`)).toBeNull()
  })

  it('Remove on a pair removes both partners', async () => {
    const user = userEvent.setup()
    renderBoard(locked())
    await user.click(button(`${board.remove} Eli & Gus`)!)
    expect(savedPlayer('Eli').status).toBe('removed')
    expect(savedPlayer('Gus').status).toBe('removed')
    expect(savedLine()).toEqual(['Fay'])
    expect(items()).toHaveLength(1)
  })

  it('picking a partner who is on a time out puts the pair on the time out', async () => {
    const user = userEvent.setup()
    const s = base()
    renderBoard(s)
    await user.selectOptions(pairSelect('Fay')!, id(s, 'Hal'))
    expect(savedPlayer('Fay').status).toBe('out')
    expect(savedPlayer('Hal').status).toBe('out')
    expect(savedPlayer('Fay').partner).toBe(id(s, 'Hal'))
    expect(savedLine()).toEqual(['Eli', 'Gus'])
    const back = button(`${board.backInLine} Fay & Hal`)
    expect(back, 'the time-out list shows the pair').not.toBeNull()
    expect(back!.closest('li')).toHaveTextContent('Fay & Hal')
  })
})

describe('the time-out list shows a pair together (T8.9)', () => {
  it('Time out on a pair takes both out; the list shows "Eli & Gus" with Back in line and Unlock', async () => {
    const user = userEvent.setup()
    renderBoard(locked())
    await user.click(button(`${board.timeOut} Eli & Gus`)!)
    expect(savedPlayer('Eli').status).toBe('out')
    expect(savedPlayer('Gus').status).toBe('out')
    expect(savedLine()).toEqual(['Fay'])
    const back = button(`${board.backInLine} Eli & Gus`)
    expect(back).not.toBeNull()
    const li = back!.closest('li')!
    expect(li).toHaveTextContent('Eli & Gus')
    expect(within(li).getByRole('button', { name: `${board.unlock} Eli & Gus` })).toBeInTheDocument()
    expect(button(`${board.backInLine} Hal`)).not.toBeNull()
    await user.click(back!)
    expect(savedPlayer('Eli').status).toBe('waiting')
    expect(savedPlayer('Gus').status).toBe('waiting')
    expect(savedLine()).toEqual(['Fay', 'Eli', 'Gus'])
    expect(items()[1]).toHaveTextContent('Eli & Gus')
  })

  it('Unlock in the time-out list leaves both on the time out, as two players', async () => {
    const user = userEvent.setup()
    let s = locked()
    s = timeOut(s, id(s, 'Eli'))
    renderBoard(s)
    await user.click(button(`${board.unlock} Eli & Gus`)!)
    expect(savedPlayer('Eli').partner).toBeUndefined()
    expect(savedPlayer('Eli').status).toBe('out')
    expect(savedPlayer('Gus').status).toBe('out')
    expect(button(`${board.backInLine} Eli`)).not.toBeNull()
    expect(button(`${board.backInLine} Gus`)).not.toBeNull()
  })
})

describe('where the board offers locks (T8.9)', () => {
  it('the court card offers no Unlock: a pair on court is unlocked from the line or not at all', () => {
    const s = fillCourts(addPlayers(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee']] }), ['Eli', 'Fay']))
    renderBoard(s)
    expect(within(court(1)).queryAllByRole('button', { name: re(board.unlock) })).toHaveLength(0)
    expect(options(pairSelect('Eli')!).map((o) => o.value)).toEqual(['', id(s, 'Fay')])
  })

  it.each<[string, Play, Format]>([
    ['singles', 'singles', 'fair'],
    ['Americano', 'doubles', 'americano'],
    ['Mexicano', 'doubles', 'mexicano'],
    ['a no-pairs Round Robin', 'doubles', 'round-robin'],
  ])('%s: no pair pickers in Up next', (_label, play, format) => {
    const s = fillCourts(createSession({ format, play, courts: 1, names: NAMES.slice(0, 6) }))
    expect(s.line.length, 'two players wait').toBeGreaterThanOrEqual(2)
    renderBoard(s)
    for (const p of s.players) expect(pairSelect(p.name), p.name).toBeNull()
    expect(screen.queryAllByRole('button', { name: re(board.unlock) })).toHaveLength(0)
  })

  it.each<Format>(['winners-split', 'skill-groups', 'winners-losers'])('doubles %s: pair pickers in Up next', (format) => {
    const s = fillCourts(createSession({ format, courts: 1, names: NAMES.slice(0, 6) }))
    renderBoard(s)
    for (const x of s.line) {
      const name = s.players.find((p) => p.id === x)!.name
      expect(pairSelect(name), name).not.toBeNull()
    }
  })
})

describe('Add players and Add a pair (T8.9; user, 2026-11-23)', () => {
  it('Add players adds names one by one, with no pairing by order, even when the session has locked pairs', async () => {
    const user = userEvent.setup()
    renderBoard(fillCourts(createSession({ format: 'fair', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee'], ['Eli', 'Fay']] })))
    await user.click(screen.getByRole('textbox', { name: board.addLabel }))
    await user.paste('Zed, Yan')
    await user.click(screen.getByRole('button', { name: board.addSubmit }))
    expect(savedPlayer('Zed').partner).toBeUndefined()
    expect(savedPlayer('Yan').partner).toBeUndefined()
    expect(savedLine()).toEqual(['Eli', 'Fay', 'Zed', 'Yan'])
    const list = items()
    expect(list).toHaveLength(3)
    expect(list[0]).toHaveTextContent('Eli & Fay')
    expect(pairSelect('Zed')).not.toBeNull()
    expect(pairSelect('Yan')).not.toBeNull()
  })

  /** An all-pairs Round Robin, one court: one pair on each side of the court, one pair waiting. */
  const allPairsRoundRobin = () =>
    fillCourts(createSession({ format: 'round-robin', courts: 1, pairs: [['Ana', 'Ben'], ['Cy', 'Dee'], ['Eli', 'Fay']] }))

  it('an all-pairs Round Robin lists the waiting pair with Time out and Remove, and no Unlock or picker', () => {
    const s = allPairsRoundRobin()
    const [a, b] = s.line.map((x) => s.players.find((p) => p.id === x)!.name)
    renderBoard(s)
    const list = items()
    expect(list).toHaveLength(1)
    expect(list[0]).toHaveTextContent(`${a} & ${b}`)
    expect(within(list[0]).getByRole('button', { name: `${board.timeOut} ${a} & ${b}` })).toBeInTheDocument()
    expect(within(list[0]).getByRole('button', { name: `${board.remove} ${a} & ${b}` })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: re(board.unlock) })).toHaveLength(0)
    for (const p of s.players) expect(pairSelect(p.name), p.name).toBeNull()
  })

  it('an all-pairs Round Robin has Add a pair instead of Add players: two name boxes and a submit, under its label', () => {
    renderBoard(allPairsRoundRobin())
    expect(screen.queryByRole('textbox', { name: board.addLabel })).toBeNull()
    const label = screen.getByText(board.addPairLabel)
    const first = screen.getByRole('textbox', { name: board.addPairFirst })
    const second = screen.getByRole('textbox', { name: board.addPairSecond })
    const submit = screen.getByRole('button', { name: board.addPairSubmit })
    expect(label.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(second.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Add a pair: the two names join the back of the line, locked, shown as one pair', async () => {
    const user = userEvent.setup()
    const s = allPairsRoundRobin()
    const before = s.line.map((x) => s.players.find((p) => p.id === x)!.name)
    renderBoard(s)
    await user.type(screen.getByRole('textbox', { name: board.addPairFirst }), 'Gus')
    await user.type(screen.getByRole('textbox', { name: board.addPairSecond }), 'Hal')
    await user.click(screen.getByRole('button', { name: board.addPairSubmit }))
    expect(savedPlayer('Gus').partner).toBe(savedPlayer('Hal').id)
    expect(savedPlayer('Hal').partner).toBe(savedPlayer('Gus').id)
    expect(savedLine()).toEqual([...before, 'Gus', 'Hal'])
    const list = items()
    expect(list).toHaveLength(2)
    expect(list[1]).toHaveTextContent('Gus & Hal')
  })

  it('a no-pairs Round Robin keeps Add players and has no Add a pair', async () => {
    const user = userEvent.setup()
    renderBoard(fillCourts(createSession({ format: 'round-robin', courts: 1, names: NAMES.slice(0, 6) })))
    expect(screen.queryByRole('textbox', { name: board.addPairFirst })).toBeNull()
    expect(screen.queryByRole('textbox', { name: board.addPairSecond })).toBeNull()
    await user.click(screen.getByRole('textbox', { name: board.addLabel }))
    await user.paste('Zed')
    await user.click(screen.getByRole('button', { name: board.addSubmit }))
    expect(savedPlayer('Zed').partner).toBeUndefined()
    expect(savedLine().at(-1)).toBe('Zed')
  })

  it('outside Round Robin there is no Add a pair form', () => {
    renderBoard(locked())
    expect(screen.queryByRole('textbox', { name: board.addPairFirst })).toBeNull()
    expect(screen.getByRole('textbox', { name: board.addLabel })).toBeInTheDocument()
  })
})
