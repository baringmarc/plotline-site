// T8.5 Start screen that fits everything (TASKS.md T8.5; SPEC §4 "Combinations"), brought to T8.9 (TASKS.md T8.9:
// the Teams option is removed; SPEC §4 "Pair locks": "The start screen locks pairs among the name chips"). Copy from
// `paddleStack` (src/config/paddleStack.ts, re-exported by site.ts).
//
// Structure the tests rely on (the plan's names):
// - `StartForm({ onStart })` in ./StartForm.tsx calls `onStart(session)` with the new session; StackPage renders it
//   when no session is saved (and still calls `fillCourts` on it);
// - order: title box (`start.titleLabel`), Singles/Doubles radios (group `start.playLabel`), courts `<select>`
//   (`start.courtsLabel`), the names box (`start.namesLabel`), the format radios (group `start.formatLabel`, one
//   radio per offered `formats[]`, each card's label holding its label, hint and badge). T8.9: no Teams fieldset;
// - Acceptance (user, 2026-11-18, from the by-eye check): six formats (Round Robin merged into "Americano (Round
//   Robin)", `round-robin` never offered); each card's badge sits on the name's line: inside the radio's label, a
//   heading row `.stack-format-head` holds the name `<b>` (the label) and, right after it, the badge `.stack-badge`;
//   the badge isn't inside the hint. The radio's accessible name is the label alone;
// - the selected format's `details` in an element with class `stack-format-details`;
// - under `start.playersLabel`, one chip per parsed name with a level `<select>` named `start.levelFor(name)`:
//   an empty option `start.noLevel` (selected by default), then `start.levels[].label`;
// - T8.9 pair locks: when `locksOffered(play, format)`, each unpaired chip has a `<select>` named
//   `start.pairWith(name)` whose options are the other unpaired names (value = the name), first option
//   `start.pairPlaceholder` with value ''. A locked pair shows as `role="group"` named `${a} & ${b}` (list order)
//   holding both chips, plus a button named `${start.unlock} ${a} & ${b}`. The pairs reach the session locked, each
//   pair at its further-back partner's spot; locks are ignored where they aren't offered;
// - formats hidden by the play choice are not rendered, and a hidden choice resets to an offered one;
// - Acceptance (user, 2026-11-18, second by-eye look): `.stack-formats` holds exactly two `.stack-formats-col`
//   children; the first holds the offered 'left' cards (`label.stack-format`: fair, americano, winners-split), the
//   second the offered 'right' ones (mexicano, winners-losers, skill-groups), each in config order; an empty column
//   stays rendered. All format radios share one `name`, sit in the one `start.formatLabel` group, and their DOM
//   order is config order.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { StackPage } from './StackPage'
import { StartForm } from './StartForm'
import { formatsFor } from './startOptions'
import { loadStack } from './storage'
import type { Format, Session } from './types'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => true), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

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
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const { start, formats, board } = paddleStack
type User = ReturnType<typeof userEvent.setup>

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const fmt = (id: Format) => formats.find((f) => f.id === id)!
const playLabel = (id: 'singles' | 'doubles') => start.plays.find((p) => p.id === id)!.label

function renderForm() {
  const onStart = vi.fn<(s: Session) => void>()
  const utils = render(
    <MemoryRouter>
      <StartForm onStart={onStart} />
    </MemoryRouter>,
  )
  return { onStart, ...utils }
}

/** The format radio group: a fieldset (role group) or a role="radiogroup", named `start.formatLabel`. */
const formatGroup = () =>
  screen.queryByRole('radiogroup', { name: start.formatLabel }) ?? screen.getByRole('group', { name: start.formatLabel })
const formatRadio = (id: Format) => within(formatGroup()).queryByRole('radio', { name: re(fmt(id).label) })
const formatRadios = () => within(formatGroup()).getAllByRole('radio')
const playRadio = (id: 'singles' | 'doubles') =>
  within(screen.getByRole('group', { name: start.playLabel })).getByRole('radio', { name: re(playLabel(id)) })
const namesBox = () => screen.getByRole('textbox', { name: start.namesLabel })
const levelSelect = (name: string) => screen.getByRole('combobox', { name: start.levelFor(name) })
const levelSelects = () => screen.queryAllByRole('combobox').filter((el) => (el.getAttribute('aria-label') ?? '').startsWith(start.levelFor('').trim()))
const pairSelect = (name: string) => screen.queryByRole('combobox', { name: start.pairWith(name) })
const pairGroup = (a: string, b: string) => screen.queryByRole('group', { name: `${a} & ${b}` })
const unlockButton = (a: string, b: string) => screen.queryByRole('button', { name: `${start.unlock} ${a} & ${b}` })
const details = (container: HTMLElement) => container.querySelectorAll('.stack-format-details')
const labelText = (el: HTMLElement) => [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? '').join(' ')
const checkedFormat = () => formatRadios().find((r) => (r as HTMLInputElement).checked)
const optionsOf = (select: HTMLElement) => (within(select).getAllByRole('option') as HTMLOptionElement[]).map((o) => ({ value: o.value, text: o.textContent }))

async function typeNames(user: User, text: string) {
  await user.click(namesBox())
  await user.paste(text)
}

async function submit(user: User) {
  await user.click(screen.getByRole('button', { name: start.submit }))
}

/** Locks `b` as `a`'s partner from `a`'s pair picker. */
async function pair(user: User, a: string, b: string) {
  const select = pairSelect(a)
  expect(select, `${a} has a pair picker`).not.toBeNull()
  await user.selectOptions(select!, b)
}

const FOUR = 'Andrew\nMaria\nJuan\nJose'
const byName = (s: Session, name: string) => s.players.find((p) => p.name === name)!
const lineNames = (s: Session) => s.line.map((x) => s.players.find((p) => p.id === x)!.name)

describe('StartForm: the format cards are a labelled radio group (T8.5)', () => {
  it('is a group named start.formatLabel with one radio per format offered in doubles, in config order', () => {
    renderForm()
    const labels = formatRadios().map((r) => labelText(r))
    const offered = formatsFor('doubles')
    expect(offered).toHaveLength(6)
    expect(labels).toHaveLength(offered.length)
    offered.forEach((id, i) => expect(labels[i], id).toMatch(re(fmt(id).label)))
  })

  it('every format card shows its label, hint and badge', () => {
    renderForm()
    for (const id of formatsFor('doubles')) {
      const radio = formatRadio(id)!
      expect(radio, id).toBeInTheDocument()
      const text = labelText(radio)
      expect(text, id).toContain(fmt(id).label)
      expect(text, id).toContain(fmt(id).hint)
      expect(text, id).toContain(fmt(id).badge)
    }
  })

  it('each badge is on the name’s line: .stack-format-head holds the name <b> then the .stack-badge, not the hint', () => {
    renderForm()
    for (const id of formatsFor('doubles')) {
      const f = fmt(id)
      const radio = formatRadio(id)!
      const label = (radio as HTMLInputElement).labels![0]
      const head = label.querySelector('.stack-format-head')
      expect(head, `${id} heading row`).not.toBeNull()
      const name = [...head!.querySelectorAll('b')].find((b) => b.textContent?.trim() === f.label)
      expect(name, `${id} name <b> in the heading row`).toBeDefined()
      const badge = name!.nextElementSibling
      expect(badge, `${id} badge right after the name`).not.toBeNull()
      expect(badge!.classList.contains('stack-badge'), `${id} sibling is .stack-badge`).toBe(true)
      expect(badge!.textContent?.trim(), id).toBe(f.badge)
      expect(badge!.parentElement, `${id} badge in the heading row`).toBe(head)
      expect(head!.textContent, `${id} heading row has no hint`).not.toContain(f.hint)
      expect(label.querySelectorAll('.stack-badge'), `${id} one badge`).toHaveLength(1)
    }
  })

  it('the radio’s accessible name is the label alone; the label text starts with it and holds badge and hint', () => {
    renderForm()
    for (const id of formatsFor('doubles')) {
      const f = fmt(id)
      const radio = within(formatGroup()).getByRole('radio', { name: f.label })
      expect(radio, id).toBe(formatRadio(id))
      const text = labelText(radio).trim()
      expect(text.startsWith(f.label), id).toBe(true)
      expect(text, id).toContain(f.badge)
      expect(text, id).toContain(f.hint)
    }
  })

  it('round-robin is not on the start screen; the Americano card is "Americano (Round Robin)"', () => {
    const { container } = renderForm()
    expect(container.querySelector('input[type="radio"][value="round-robin"]')).toBeNull()
    expect(within(formatGroup()).getByRole('radio', { name: 'Americano (Round Robin)' })).toHaveAttribute('value', 'americano')
  })

  it('radios are reachable by keyboard: arrow keys move the choice within the group', async () => {
    const user = userEvent.setup()
    renderForm()
    const radios = formatRadios() as HTMLInputElement[]
    expect(new Set(radios.map((r) => r.name)).size).toBe(1)
    expect(radios[0].name).not.toBe('')
    await user.click(radios[0])
    expect(radios[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(radios[1]).toBeChecked()
  })

  it('Fair rotation is chosen by default and its explanation shows under the grid', () => {
    const { container } = renderForm()
    expect(formatRadio('fair')).toBeChecked()
    const d = details(container)
    expect(d).toHaveLength(1)
    expect(d[0]).toHaveTextContent(fmt('fair').details)
  })

  it('every format’s explanation shows when it is chosen, and only that one', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    for (const id of formatsFor('doubles')) {
      await user.click(formatRadio(id)!)
      const d = details(container)
      expect(d, id).toHaveLength(1)
      expect(d[0], id).toHaveTextContent(fmt(id).details)
      for (const other of formats) if (other.id !== id) expect(d[0].textContent, `${id} not ${other.id}`).not.toContain(other.details)
    }
  })

  it('the explanation comes after the format grid', () => {
    const { container } = renderForm()
    const last = formatRadios().at(-1)!
    expect(last.compareDocumentPosition(details(container)[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

/** The two format columns, and the format ids of the cards in each (from each card's radio value). */
function columns(container: HTMLElement) {
  const grid = container.querySelector('.stack-formats')
  expect(grid, '.stack-formats').not.toBeNull()
  const cols = [...grid!.children] as HTMLElement[]
  const ids = (col: HTMLElement) =>
    [...col.querySelectorAll<HTMLLabelElement>('label.stack-format')].map((label) => {
      const input = (label.querySelector('input[type="radio"]') ??
        (label.htmlFor ? document.getElementById(label.htmlFor) : null)) as HTMLInputElement | null
      expect(input, 'each card has its radio').not.toBeNull()
      return input!.value
    })
  return { cols, left: cols[0] ? ids(cols[0]) : [], right: cols[1] ? ids(cols[1]) : [] }
}

describe('StartForm: the format cards sit in two columns (user, 2026-11-18, second by-eye look)', () => {
  it('.stack-formats holds exactly two .stack-formats-col children', () => {
    const { container } = renderForm()
    const { cols } = columns(container)
    expect(cols).toHaveLength(2)
    for (const c of cols) expect(c.classList.contains('stack-formats-col'), c.className).toBe(true)
  })

  it('doubles: left Fair rotation, Americano (Round Robin), Winners stay; right Mexicano, Winners vs Losers, Skill groups', () => {
    const { container } = renderForm()
    const { left, right } = columns(container)
    expect(left).toEqual(['fair', 'americano', 'winners-split'])
    expect(right).toEqual(['mexicano', 'winners-losers', 'skill-groups'])
  })

  it('the radios’ DOM order is the config order: the left column, then the right (one column on phones)', () => {
    renderForm()
    expect(formatRadios().map((r) => (r as HTMLInputElement).value)).toEqual([
      'fair',
      'americano',
      'winners-split',
      'mexicano',
      'winners-losers',
      'skill-groups',
    ])
  })

  it('all format radios, in both columns, share one name and sit in the one start.formatLabel group', () => {
    const { container } = renderForm()
    const all = [...container.querySelectorAll<HTMLInputElement>('.stack-formats input[type="radio"]')]
    expect(all).toHaveLength(6)
    expect(new Set(all.map((r) => r.name)).size).toBe(1)
    expect(all[0].name).not.toBe('')
    const inGroup = formatRadios()
    for (const r of all) expect(inGroup, r.value).toContain(r)
  })

  it('singles: Winners stay drops out of the left column; the right column keeps its three', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await user.click(playRadio('singles'))
    const { cols, left, right } = columns(container)
    expect(cols).toHaveLength(2)
    expect(left).toEqual(['fair', 'americano'])
    expect(right).toEqual(['mexicano', 'winners-losers', 'skill-groups'])
  })

  it('a locked pair hides no format (T8.9: no fixed-pairs mode): both columns keep all six', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Andrew', 'Maria')
    const { cols, left, right } = columns(container)
    expect(cols).toHaveLength(2)
    expect(left).toEqual(['fair', 'americano', 'winners-split'])
    expect(right).toEqual(['mexicano', 'winners-losers', 'skill-groups'])
  })
})

describe('StartForm: the order of the start card (T8.5; no Teams since T8.9)', () => {
  it('title, play, courts, players, then rotation', () => {
    renderForm()
    const order = [
      screen.getByRole('textbox', { name: start.titleLabel }),
      playRadio('singles'),
      screen.getByRole('combobox', { name: start.courtsLabel }),
      namesBox(),
      formatRadios()[0],
    ]
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `item ${i}`).toBeTruthy()
    }
  })

  it('courts is still a select, 1 to 12', () => {
    renderForm()
    const select = screen.getByRole('combobox', { name: start.courtsLabel })
    expect(select.tagName).toBe('SELECT')
    expect(within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)),
    )
  })
})

describe('StartForm: the title reaches the session (T8.5)', () => {
  it('the trimmed title, play, courts and format reach onStart, with no teams field', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(screen.getByRole('textbox', { name: start.titleLabel }))
    await user.paste('  Sunday Open Play  ')
    await user.selectOptions(screen.getByRole('combobox', { name: start.courtsLabel }), '3')
    await user.click(formatRadio('americano')!)
    await typeNames(user, FOUR)
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s.title).toBe('Sunday Open Play')
    expect(s.play).toBe('doubles')
    expect(s).not.toHaveProperty('teams')
    expect(s.courts).toBe(3)
    expect(s.format).toBe('americano')
    expect(s.players.map((p) => p.name)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('each of the six formats can be started in doubles', async () => {
    for (const id of formatsFor('doubles')) {
      const user = userEvent.setup()
      const { onStart, unmount } = renderForm()
      await user.click(formatRadio(id)!)
      await typeNames(user, FOUR)
      await submit(user)
      expect(onStart, id).toHaveBeenCalledTimes(1)
      expect(onStart.mock.calls[0][0].format, id).toBe(id)
      unmount()
    }
  })
})

describe('StartForm: no Teams option (T8.9)', () => {
  it('doubles and singles show no Teams fieldset: the only radios are the play and the format', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    for (const play of ['doubles', 'singles'] as const) {
      await user.click(playRadio(play))
      const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      const playRadios = within(screen.getByRole('group', { name: start.playLabel })).getAllByRole('radio')
      expect(radios.length, play).toBe(playRadios.length + formatRadios().length)
      expect(container.querySelector('input[type="radio"][value="fixed"]'), play).toBeNull()
      expect(container.querySelector('input[type="radio"][value="open"]'), play).toBeNull()
      expect(container.querySelector('fieldset.stack-teams'), play).toBeNull()
      expect(screen.queryByRole('group', { name: 'Teams' }), play).toBeNull()
    }
  })
})

describe('StartForm: singles hides the doubles-only choices (T8.5, T8.9)', () => {
  it('singles hides Winners stay & split and shows the singles formats in order', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(playRadio('singles'))
    expect(formatRadio('winners-split')).toBeNull()
    const offered = formatsFor('singles')
    const labels = formatRadios().map(labelText)
    expect(labels).toHaveLength(offered.length)
    offered.forEach((id, i) => expect(labels[i], id).toMatch(re(fmt(id).label)))
  })

  it('singles shows no pair pickers, and a pair locked in doubles is dropped: the singles session has no locks', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, 'Andrew\nMaria\nJuan')
    await pair(user, 'Andrew', 'Maria')
    await user.click(playRadio('singles'))
    for (const n of ['Andrew', 'Maria', 'Juan']) expect(pairSelect(n), n).toBeNull()
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s.play).toBe('singles')
    expect(s).not.toHaveProperty('teams')
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
  })

  it('Winners stay chosen, then singles: the choice resets to an offered format, and that one starts', async () => {
    const user = userEvent.setup()
    const { onStart, container } = renderForm()
    await user.click(formatRadio('winners-split')!)
    await user.click(playRadio('singles'))
    const checked = checkedFormat()
    expect(checked, 'one format is still checked').toBeDefined()
    expect(formatRadio('fair')).toBeChecked()
    expect(details(container)[0]).toHaveTextContent(fmt('fair').details)
    await typeNames(user, 'Andrew\nMaria')
    await submit(user)
    expect(onStart.mock.calls[0][0].format).toBe('fair')
  })

  it('a format offered in singles stays chosen when switching to singles (Mexicano)', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(formatRadio('mexicano')!)
    await user.click(playRadio('singles'))
    expect(formatRadio('mexicano')).toBeChecked()
  })
})

describe('StartForm: a chip per name with an optional level (T8.5)', () => {
  it('shows the players heading and one level picker per parsed name (numbering and repeats ignored)', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, '1. Andrew\n2. Maria\n3. andrew\n4. Juan')
    expect(screen.getByText(start.playersLabel)).toBeInTheDocument()
    expect(levelSelect('Andrew')).toBeInTheDocument()
    expect(levelSelect('Maria')).toBeInTheDocument()
    expect(levelSelect('Juan')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: start.levelFor('andrew') })).toBeNull()
    expect(levelSelects()).toHaveLength(3)
  })

  it('each level picker offers no level (selected) then the three levels', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, 'Andrew')
    const select = levelSelect('Andrew') as HTMLSelectElement
    const options = within(select).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => o.textContent)).toEqual([start.noLevel, ...start.levels.map((l) => l.label)])
    expect(options.slice(1).map((o) => o.value)).toEqual(start.levels.map((l) => String(l.value)))
    expect(options[0]).toHaveProperty('selected', true)
  })

  it('levels reach the session; players left at no level have none', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, FOUR)
    await user.selectOptions(levelSelect('Andrew'), start.levels[2].label)
    await user.selectOptions(levelSelect('Juan'), start.levels[0].label)
    await submit(user)
    const s = onStart.mock.calls[0][0]
    expect(byName(s, 'Andrew').level).toBe(3)
    expect(byName(s, 'Juan').level).toBe(1)
    expect(byName(s, 'Maria').level).toBeUndefined()
    expect(byName(s, 'Jose').level).toBeUndefined()
  })

  it('a level set back to no level is dropped', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, FOUR)
    await user.selectOptions(levelSelect('Maria'), start.levels[1].label)
    await user.selectOptions(levelSelect('Maria'), start.noLevel)
    await submit(user)
    expect(byName(onStart.mock.calls[0][0], 'Maria').level).toBeUndefined()
  })

  it('levels work in singles too', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(playRadio('singles'))
    await typeNames(user, 'Andrew\nMaria')
    await user.selectOptions(levelSelect('Maria'), start.levels[1].label)
    await submit(user)
    expect(byName(onStart.mock.calls[0][0], 'Maria').level).toBe(2)
  })
})

describe('StartForm: pairs are locked among the name chips (T8.9)', () => {
  it('in doubles, each chip has a pair picker: a placeholder (value "") first, then the other names (value = the name)', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    for (const n of ['Andrew', 'Maria', 'Juan', 'Jose']) {
      const select = pairSelect(n)
      expect(select, `${n} has a pair picker`).not.toBeNull()
      const options = optionsOf(select!)
      expect(options[0]).toEqual({ value: '', text: start.pairPlaceholder })
      const others = ['Andrew', 'Maria', 'Juan', 'Jose'].filter((x) => x !== n)
      expect(options.slice(1).map((o) => o.value).sort(), n).toEqual([...others].sort())
      expect(options.slice(1).map((o) => o.text).sort(), n).toEqual([...others].sort())
      expect((select as HTMLSelectElement).value, n).toBe('')
    }
  })

  it('shows start.pairsHint where locks are offered', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    expect(screen.getByText(start.pairsHint)).toBeInTheDocument()
  })

  it('picking a partner shows the pair as a group named "A & B" (list order) holding both chips, with an Unlock button', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Juan', 'Andrew')
    const group = pairGroup('Andrew', 'Juan')
    expect(group, 'the pair group').not.toBeNull()
    expect(within(group!).getByRole('combobox', { name: start.levelFor('Andrew') })).toBeInTheDocument()
    expect(within(group!).getByRole('combobox', { name: start.levelFor('Juan') })).toBeInTheDocument()
    expect(group).not.toHaveTextContent('Maria')
    expect(unlockButton('Andrew', 'Juan')).not.toBeNull()
    expect(pairGroup('Juan', 'Andrew')).toBeNull()
  })

  it('a paired name has no pair picker and leaves the others’ pickers', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Andrew', 'Maria')
    expect(pairSelect('Andrew')).toBeNull()
    expect(pairSelect('Maria')).toBeNull()
    expect(optionsOf(pairSelect('Juan')!)).toEqual([
      { value: '', text: start.pairPlaceholder },
      { value: 'Jose', text: 'Jose' },
    ])
    expect(optionsOf(pairSelect('Jose')!).map((o) => o.value)).toEqual(['', 'Juan'])
  })

  it('Unlock splits the pair: the group goes and both chips get their pickers back', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Andrew', 'Maria')
    await user.click(unlockButton('Andrew', 'Maria')!)
    expect(pairGroup('Andrew', 'Maria')).toBeNull()
    expect(unlockButton('Andrew', 'Maria')).toBeNull()
    expect(pairSelect('Andrew')).not.toBeNull()
    expect(pairSelect('Maria')).not.toBeNull()
    await submit(user)
    expect(onStart.mock.calls[0][0].players.every((p) => p.partner === undefined)).toBe(true)
  })

  it('the pairs reach the session locked, each at its further-back partner’s spot, with their levels', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Andrew', 'Juan')
    await user.selectOptions(levelSelect('Jose'), start.levels[2].label)
    await user.selectOptions(levelSelect('Juan'), start.levels[0].label)
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s).not.toHaveProperty('teams')
    expect(s.play).toBe('doubles')
    const [andrew, maria, juan, jose] = ['Andrew', 'Maria', 'Juan', 'Jose'].map((n) => byName(s, n))
    expect(s.players.map((p) => p.name)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
    expect(andrew.partner).toBe(juan.id)
    expect(juan.partner).toBe(andrew.id)
    expect(maria.partner).toBeUndefined()
    expect(jose.partner).toBeUndefined()
    expect(lineNames(s)).toEqual(['Maria', 'Andrew', 'Juan', 'Jose'])
    expect(jose.level).toBe(3)
    expect(juan.level).toBe(1)
    expect(andrew.level).toBeUndefined()
  })

  it('an odd number of names starts fine with a pair locked (no even-number rule any more)', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, `${FOUR}\nAna`)
    await pair(user, 'Maria', 'Ana')
    await submit(user)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s.players).toHaveLength(5)
    expect(byName(s, 'Maria').partner).toBe(byName(s, 'Ana').id)
  })

  it('doubles still needs 4 players, pairs included', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, 'Andrew\nMaria\nJuan')
    await pair(user, 'Andrew', 'Maria')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(start.needFour)
    expect(onStart).not.toHaveBeenCalled()
  })

  it.each<Format>(['fair', 'winners-split', 'winners-losers', 'skill-groups'])('%s offers pair pickers in doubles', async (id) => {
    const user = userEvent.setup()
    renderForm()
    await user.click(formatRadio(id)!)
    await typeNames(user, FOUR)
    expect(pairSelect('Andrew'), id).not.toBeNull()
  })

  it.each<Format>(['americano', 'mexicano'])('%s offers no pair pickers (partners rotate), and a pair locked earlier is ignored', async (id) => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await typeNames(user, FOUR)
    await pair(user, 'Andrew', 'Maria')
    await user.click(formatRadio(id)!)
    for (const n of ['Andrew', 'Maria', 'Juan', 'Jose']) expect(pairSelect(n), n).toBeNull()
    await submit(user)
    const s = onStart.mock.calls[0][0]
    expect(s.format).toBe(id)
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
    expect(lineNames(s)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('no pair groups or Unlock buttons before any pair is locked', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    expect(screen.queryAllByRole('button', { name: re(start.unlock) })).toHaveLength(0)
    expect(screen.queryByRole('group', { name: / & / })).toBeNull()
  })
})

describe('StackPage renders StartForm (T8.5, T8.9)', () => {
  it('levels and a locked pair typed on the start screen reach the saved session and the board', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/paddle-stack']}>
        <StackPage />
      </MemoryRouter>,
    )
    expect(document.querySelector('form.stack-start')).not.toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: start.courtsLabel }), '1')
    await typeNames(user, `${FOUR}\nAna\nBen`)
    await pair(user, 'Maria', 'Ana')
    await user.selectOptions(levelSelect('Ana'), start.levels[0].label)
    await submit(user)
    const s = loadStack()!.session
    expect(s).not.toHaveProperty('teams')
    expect(byName(s, 'Ana').partner).toBe(byName(s, 'Maria').id)
    expect(byName(s, 'Maria').partner).toBe(byName(s, 'Ana').id)
    expect(byName(s, 'Ana').level).toBe(1)
    // fillCourts ran: the pair stood at Ana's spot, so the four solos took court 1 and the pair waits.
    expect(s.games).toHaveLength(1)
    const court = screen.getByRole('region', { name: `${board.court} 1` })
    for (const n of ['Andrew', 'Juan', 'Jose', 'Ben']) expect(court).toHaveTextContent(n)
    expect(lineNames(s)).toEqual(['Maria', 'Ana'])
    const upNext = screen.getByRole('region', { name: board.upNext })
    const items = within(upNext).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Maria & Ana')
  })
})
