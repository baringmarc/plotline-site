// T8.5 Start screen that fits everything (TASKS.md T8.5; SPEC §4 "Combinations", "Fixed pairs"). Copy from
// `paddleStack` (src/config/paddleStack.ts, re-exported by site.ts).
//
// Structure the tests rely on (the plan's names):
// - `StartForm({ onStart })` in ./StartForm.tsx calls `onStart(session)` with the new session; StackPage renders it
//   when no session is saved (and still calls `fillCourts` on it);
// - order: title box (`start.titleLabel`), Singles/Doubles radios (group `start.playLabel`), courts `<select>`
//   (`start.courtsLabel`), the names box (`start.namesLabel`), the teams radios (group `start.teamsLabel`, one radio
//   per `start.teams[].label`, open by default, shown only in doubles), the format radios (group
//   `start.formatLabel`, one radio per offered `formats[]`, each card's label holding its label, hint and badge);
// - Acceptance (user, 2026-11-18, from the by-eye check): six formats (Round Robin merged into "Americano (Round
//   Robin)", `round-robin` never offered); each card's badge sits on the name's line: inside the radio's label, a
//   heading row `.stack-format-head` holds the name `<b>` (the label) and, right after it, the badge `.stack-badge`;
//   the badge isn't inside the hint. The radio's accessible name is the label alone;
// - the selected format's `details` in an element with class `stack-format-details`;
// - under `start.playersLabel`, one chip per parsed name with a level `<select>` named `start.levelFor(name)`:
//   an empty option `start.noLevel` (selected by default), then `start.levels[].label`;
// - with fixed pairs: names paired in list order, each pair a group named `start.pairLabel(n)` (1-based), with
//   `start.pairsHint` shown; an odd number of names shows `start.needEven` as an alert and doesn't start;
// - formats hidden by the play/teams choice are not rendered, and a hidden choice resets to an offered one;
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

const { start, formats } = paddleStack
type User = ReturnType<typeof userEvent.setup>

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const fmt = (id: Format) => formats.find((f) => f.id === id)!
const playLabel = (id: 'singles' | 'doubles') => start.plays.find((p) => p.id === id)!.label
const teamsLabel = (id: 'open' | 'fixed') => start.teams.find((t) => t.id === id)!.label

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
const teamsGroup = () => screen.queryByRole('group', { name: start.teamsLabel }) ?? screen.queryByRole('radiogroup', { name: start.teamsLabel })
const teamsRadio = (id: 'open' | 'fixed') => within(teamsGroup()!).getByRole('radio', { name: re(teamsLabel(id)) })
const namesBox = () => screen.getByRole('textbox', { name: start.namesLabel })
const levelSelect = (name: string) => screen.getByRole('combobox', { name: start.levelFor(name) })
const details = (container: HTMLElement) => container.querySelectorAll('.stack-format-details')
const labelText = (el: HTMLElement) => [...((el as HTMLInputElement).labels ?? [])].map((l) => l.textContent ?? '').join(' ')
const checkedFormat = () => formatRadios().find((r) => (r as HTMLInputElement).checked)

async function typeNames(user: User, text: string) {
  await user.click(namesBox())
  await user.paste(text)
}

async function submit(user: User) {
  await user.click(screen.getByRole('button', { name: start.submit }))
}

const FOUR = 'Andrew\nMaria\nJuan\nJose'
const byName = (s: Session, name: string) => s.players.find((p) => p.name === name)!

describe('StartForm: the format cards are a labelled radio group (T8.5)', () => {
  it('is a group named start.formatLabel with one radio per format offered in open doubles, in config order', () => {
    renderForm()
    const labels = formatRadios().map((r) => labelText(r))
    const offered = formatsFor('doubles', 'open')
    expect(offered).toHaveLength(6)
    expect(labels).toHaveLength(offered.length)
    offered.forEach((id, i) => expect(labels[i], id).toMatch(re(fmt(id).label)))
  })

  it('every format card shows its label, hint and badge', () => {
    renderForm()
    for (const id of formatsFor('doubles', 'open')) {
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
    for (const id of formatsFor('doubles', 'open')) {
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
    for (const id of formatsFor('doubles', 'open')) {
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
    for (const id of formatsFor('doubles', 'open')) {
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

  it('open doubles: left Fair rotation, Americano (Round Robin), Winners stay; right Mexicano, Winners vs Losers, Skill groups', () => {
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

  it('fixed pairs: Americano drops out of the left, Mexicano out of the right; the others keep their column', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await user.click(teamsRadio('fixed'))
    const { cols, left, right } = columns(container)
    expect(cols).toHaveLength(2)
    expect(left).toEqual(['fair', 'winners-split'])
    expect(right).toEqual(['winners-losers', 'skill-groups'])
  })
})

describe('StartForm: the order of the start card (T8.5)', () => {
  it('title, play, courts, players, teams, then rotation', () => {
    renderForm()
    const order = [
      screen.getByRole('textbox', { name: start.titleLabel }),
      playRadio('singles'),
      screen.getByRole('combobox', { name: start.courtsLabel }),
      namesBox(),
      teamsRadio('open'),
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
  it('the trimmed title, play, courts and format reach onStart', async () => {
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
    expect(s.teams).toBe('open')
    expect(s.courts).toBe(3)
    expect(s.format).toBe('americano')
    expect(s.players.map((p) => p.name)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('each of the six formats can be started in open doubles', async () => {
    for (const id of formatsFor('doubles', 'open')) {
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

describe('StartForm: singles hides the doubles-only choices (T8.5)', () => {
  it('doubles shows the teams group with open queue checked by default', () => {
    renderForm()
    expect(teamsGroup()).not.toBeNull()
    expect(within(teamsGroup()!).getAllByRole('radio')).toHaveLength(2)
    expect(teamsRadio('open')).toBeChecked()
    expect(teamsRadio('fixed')).not.toBeChecked()
    for (const t of start.teams) expect(labelText(teamsRadio(t.id))).toContain(t.hint)
  })

  it('singles hides the teams group and Winners stay & split, and shows the singles formats in order', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(playRadio('singles'))
    expect(teamsGroup()).toBeNull()
    expect(formatRadio('winners-split')).toBeNull()
    const offered = formatsFor('singles', 'open')
    const labels = formatRadios().map(labelText)
    expect(labels).toHaveLength(offered.length)
    offered.forEach((id, i) => expect(labels[i], id).toMatch(re(fmt(id).label)))
  })

  it('a singles session always has an open queue, even if fixed pairs was picked first', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(teamsRadio('fixed'))
    await user.click(playRadio('singles'))
    await typeNames(user, 'Andrew\nMaria\nJuan')
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s.play).toBe('singles')
    expect(s.teams).toBe('open')
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

describe('StartForm: fixed pairs hides Americano and Mexicano (T8.5)', () => {
  it('fixed pairs shows only the fixed-pairs formats, in order', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(teamsRadio('fixed'))
    expect(formatRadio('americano')).toBeNull()
    expect(formatRadio('mexicano')).toBeNull()
    const offered = formatsFor('doubles', 'fixed')
    const labels = formatRadios().map(labelText)
    expect(labels).toHaveLength(offered.length)
    offered.forEach((id, i) => expect(labels[i], id).toMatch(re(fmt(id).label)))
  })

  it('Americano chosen, then fixed pairs: the choice resets to an offered format', async () => {
    const user = userEvent.setup()
    const { onStart, container } = renderForm()
    await user.click(formatRadio('americano')!)
    await user.click(teamsRadio('fixed'))
    const checked = checkedFormat()
    expect(checked, 'one format is still checked').toBeDefined()
    const chosen = formatsFor('doubles', 'fixed').find((id) => labelText(checked!).startsWith(fmt(id).label))!
    expect(chosen).toBeDefined()
    expect(details(container)[0]).toHaveTextContent(fmt(chosen).details)
    await typeNames(user, FOUR)
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart.mock.calls[0][0].format).toBe(chosen)
    expect(onStart.mock.calls[0][0].teams).toBe('fixed')
  })

  it('back to the open queue shows Americano and Mexicano again', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(teamsRadio('fixed'))
    await user.click(teamsRadio('open'))
    expect(formatRadio('americano')).toBeInTheDocument()
    expect(formatRadio('mexicano')).toBeInTheDocument()
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
    expect(screen.getAllByRole('combobox', { name: /./ }).filter((el) => el !== screen.getByRole('combobox', { name: start.courtsLabel }))).toHaveLength(3)
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

describe('StartForm: fixed pairs reach the session (T8.5)', () => {
  it('pairs names in list order, each pair a labelled group, with the pairs hint', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(teamsRadio('fixed'))
    await typeNames(user, FOUR)
    expect(screen.getByText(start.pairsHint)).toBeInTheDocument()
    const p1 = screen.getByRole('group', { name: start.pairLabel(1) })
    const p2 = screen.getByRole('group', { name: start.pairLabel(2) })
    expect(p1).toHaveTextContent('Andrew')
    expect(p1).toHaveTextContent('Maria')
    expect(p1).not.toHaveTextContent('Juan')
    expect(p2).toHaveTextContent('Juan')
    expect(p2).toHaveTextContent('Jose')
    expect(screen.queryByRole('group', { name: start.pairLabel(3) })).toBeNull()
  })

  it('no pair groups or pairs hint in an open queue', async () => {
    const user = userEvent.setup()
    renderForm()
    await typeNames(user, FOUR)
    expect(screen.queryByRole('group', { name: start.pairLabel(1) })).toBeNull()
    expect(screen.queryByText(start.pairsHint)).toBeNull()
  })

  it('the session has fixed teams and partners as paired, with their levels', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(teamsRadio('fixed'))
    await typeNames(user, FOUR)
    await user.selectOptions(levelSelect('Jose'), start.levels[2].label)
    await submit(user)
    expect(onStart).toHaveBeenCalledTimes(1)
    const s = onStart.mock.calls[0][0]
    expect(s.teams).toBe('fixed')
    expect(s.play).toBe('doubles')
    const [andrew, maria, juan, jose] = ['Andrew', 'Maria', 'Juan', 'Jose'].map((n) => byName(s, n))
    expect(andrew.partner).toBe(maria.id)
    expect(maria.partner).toBe(andrew.id)
    expect(juan.partner).toBe(jose.id)
    expect(jose.partner).toBe(juan.id)
    expect(jose.level).toBe(3)
    expect(andrew.level).toBeUndefined()
  })

  it('an odd number of names shows start.needEven and doesn’t start', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(teamsRadio('fixed'))
    await typeNames(user, `${FOUR}\nAna`)
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(start.needEven)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('fixed pairs still needs 4 players (2 pairs)', async () => {
    const user = userEvent.setup()
    const { onStart } = renderForm()
    await user.click(teamsRadio('fixed'))
    await typeNames(user, 'Andrew\nMaria')
    await submit(user)
    expect(screen.getByRole('alert')).toHaveTextContent(start.needFour)
    expect(onStart).not.toHaveBeenCalled()
  })
})

describe('StackPage renders StartForm (T8.5)', () => {
  it('levels and pairs typed on the start screen reach the saved session and the board', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/paddle-stack']}>
        <StackPage />
      </MemoryRouter>,
    )
    expect(document.querySelector('form.stack-start')).not.toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: start.courtsLabel }), '1')
    await user.click(teamsRadio('fixed'))
    await typeNames(user, `${FOUR}\nAna\nBen`)
    await user.selectOptions(levelSelect('Ana'), start.levels[0].label)
    await submit(user)
    const s = loadStack()!.session
    expect(s.teams).toBe('fixed')
    expect(byName(s, 'Ana').partner).toBe(byName(s, 'Ben').id)
    expect(byName(s, 'Ana').level).toBe(1)
    // fillCourts ran: pair 1 against pair 2 on court 1.
    expect(s.games).toHaveLength(1)
    const court = screen.getByRole('region', { name: `${paddleStack.board.court} 1` })
    for (const n of ['Andrew', 'Maria', 'Juan', 'Jose']) expect(court).toHaveTextContent(n)
  })
})
