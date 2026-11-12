// T5.3 Stack page for the organizer (`/paddle-stack`). Rules come from the T5.2 engine (SPEC §4 "Paddle Stack
// rules"); all copy comes from `paddleStack` in src/config/site.ts.
// Accessible structure the tests rely on (see the test-writer report):
// - h1 `paddleStack.title`;
// - start screen: control labelled `start.courtsLabel` (number input or select), the format as radios or a
//   select labelled `start.formatLabel` with the `formats[].label` names, a textbox labelled `start.namesLabel`,
//   submit button `start.submit`;
// - board: each court a region named "Court N" (`board.court` + number); its score inputs are named
//   "Score for <team names>" (starting with `board.scoreFor`), team A first; "Up next" is a region named
//   `board.upNext` with one listitem per waiting player, each with "Time out" and "Remove" buttons;
// - standings a table named `standings.title` (final: `ended.title`).
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { StackPage } from './StackPage'
import { STACK_STORAGE_KEY, loadStack, saveStack } from './storage'

const { start, board, standings, end, ended, venueCta } = paddleStack
const SIX = '1. Andrew\n2. Maria\n3. Juan\n4. Jose\n5. Ana\n6. Ben'

type User = ReturnType<typeof userEvent.setup>

function renderPage() {
  return render(
    <MemoryRouter>
      <StackPage />
    </MemoryRouter>,
  )
}

const re = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
const formatLabel = (id: string) => paddleStack.formats.find((f) => f.id === id)!.label

async function chooseCourts(user: User, n: number) {
  const control = screen.getByLabelText(start.courtsLabel)
  if (control.tagName === 'SELECT') {
    await user.selectOptions(control, String(n))
  } else {
    fireEvent.change(control, { target: { value: String(n) } })
  }
}

async function chooseFormat(user: User, id: string) {
  const radio = screen.queryByRole('radio', { name: re(formatLabel(id)) })
  if (radio) {
    await user.click(radio)
    return
  }
  const select = screen.getByRole('combobox', { name: start.formatLabel })
  await user.selectOptions(select, screen.getByRole('option', { name: re(formatLabel(id)) }))
}

async function startStack(user: User, opts: { courts?: number; format?: string; names?: string } = {}) {
  await chooseCourts(user, opts.courts ?? 1)
  await chooseFormat(user, opts.format ?? 'fair')
  const box = screen.getByRole('textbox', { name: start.namesLabel })
  await user.clear(box)
  await user.click(box)
  await user.paste(opts.names ?? SIX)
  await user.click(screen.getByRole('button', { name: start.submit }))
}

const court = (n: number) => screen.getByRole('region', { name: `${board.court} ${n}` })
const upNext = () => screen.getByRole('region', { name: board.upNext })
const lineNames = () =>
  within(upNext())
    .queryAllByRole('listitem')
    .map((li) => li.textContent ?? '')

function expectOnCourt(n: number, names: string[]) {
  const c = court(n)
  for (const name of names) expect(c, `${name} on court ${n}`).toHaveTextContent(name)
}

function expectLine(names: string[]) {
  const items = lineNames()
  expect(items).toHaveLength(names.length)
  names.forEach((name, i) => expect(items[i], `line position ${i + 1}`).toContain(name))
}

async function enterScore(user: User, n: number, a: number, b: number) {
  const c = court(n)
  await user.click(within(c).getByRole('button', { name: board.enterScore }))
  const inputs = within(c).getAllByLabelText(re(board.scoreFor))
  expect(inputs).toHaveLength(2)
  await user.clear(inputs[0])
  await user.type(inputs[0], String(a))
  await user.clear(inputs[1])
  await user.type(inputs[1], String(b))
  await user.click(within(c).getByRole('button', { name: board.saveScore }))
}

async function standingsTable(user: User, name = standings.title) {
  let table = screen.queryByRole('table', { name })
  if (!table) {
    const toggle =
      screen.queryByRole('tab', { name: standings.title }) ?? screen.queryByRole('button', { name: standings.title })
    if (toggle) await user.click(toggle)
    table = screen.getByRole('table', { name })
  }
  return table
}

/** Reads a standings row as { column header → cell text }. */
function rowFor(table: HTMLElement, player: string): Record<string, string> {
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((h) => h.textContent?.trim() ?? '')
  const row = within(table)
    .getAllByRole('row')
    .find((r) => r.querySelector('td, th:not([scope="col"])') && (r.textContent ?? '').includes(player))
  expect(row, `standings row for ${player}`).toBeDefined()
  const cells = Array.from(row!.querySelectorAll('td, th'))
  return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.textContent?.trim() ?? '']))
}

// Node 25's own (file-less) `localStorage` global shadows jsdom's in this test environment and has no methods,
// so each test gets a fresh in-memory Storage on both `globalThis` and `window`. Spies go on the instance.
class MemoryStorage {
  #items = new Map<string, string>()
  get length() {
    return this.#items.size
  }
  key(i: number) {
    return [...this.#items.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.#items.has(k) ? this.#items.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
  clear() {
    this.#items.clear()
  }
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('StackPage start screen (T5.3)', () => {
  it('shows the title, lead, courts, the three formats and the paste box from config', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: paddleStack.title })).toBeInTheDocument()
    expect(screen.getByText(paddleStack.lead)).toBeInTheDocument()
    expect(screen.getByLabelText(start.courtsLabel)).toBeInTheDocument()
    for (const f of paddleStack.formats) {
      const asRadio = screen.queryByRole('radio', { name: re(f.label) })
      const asOption = screen.queryByRole('option', { name: re(f.label) })
      expect(asRadio ?? asOption, f.id).not.toBeNull()
    }
    expect(screen.getByRole('textbox', { name: start.namesLabel })).toBeInTheDocument()
    expect(screen.getByText(start.namesHint)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
  })

  it('offers 1 to 12 courts', async () => {
    renderPage()
    const control = screen.getByLabelText(start.courtsLabel)
    if (control.tagName === 'SELECT') {
      const values = within(control).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
      expect(values).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)))
    } else {
      expect(control).toHaveAttribute('min', '1')
      expect(control).toHaveAttribute('max', '12')
    }
  })

  it('refuses to start with fewer than 4 players (after numbering and duplicates are ignored)', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { names: '1. Andrew\n2. Maria\n3. andrew\n4. Juan' })
    expect(screen.getByText(start.needFour)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: `${board.court} 1` })).not.toBeInTheDocument()
    expect(loadStack()).toBeNull()
  })

  it('parses a pasted Reclub/Messenger list: numbering and duplicates ignored', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { names: '1. Andrew\n2. Maria\n3. Juan\n4. Jose\n5. ana\n6. Ana, Ben\n7. maria' })
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    expectLine(['ana', 'Ben'])
    expect(court(1)).not.toHaveTextContent('1.')
  })
})

describe('StackPage board (T5.3)', () => {
  it('start → board: courts are filled automatically, the rest wait in "Up next"', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { courts: 1 })
    expect(screen.queryByRole('button', { name: start.submit })).not.toBeInTheDocument()
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    expect(court(1)).toHaveTextContent(board.vs)
    expect(within(court(1)).getByRole('button', { name: board.enterScore })).toBeInTheDocument()
    expect(within(court(1)).getByRole('button', { name: board.skipScore })).toBeInTheDocument()
    expectLine(['Ana', 'Ben'])
  })

  it('fills every court it can and shows a waiting court when there are not 4 players left', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { courts: 2, names: SIX })
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    expect(court(2)).toHaveTextContent(board.waiting)
    expect(within(court(2)).queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
    expectLine(['Ana', 'Ben'])
  })

  it('score → rotate (Fair rotation): all four go to the back and the court refills from the line', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    // Fair rotation: line positions 1 & 3 (Andrew & Juan) against 2 & 4 (Maria & Jose); team A is first.
    await user.click(within(court(1)).getByRole('button', { name: board.enterScore }))
    const inputs = within(court(1)).getAllByLabelText(re(board.scoreFor)) as HTMLInputElement[]
    const label = (el: HTMLInputElement) => el.getAttribute('aria-label') ?? el.labels?.[0]?.textContent ?? ''
    expect(label(inputs[0])).toMatch(/Andrew.*Juan/)
    expect(label(inputs[1])).toMatch(/Maria.*Jose/)
    await user.click(within(court(1)).getByRole('button', { name: board.cancel }))

    await enterScore(user, 1, 11, 5)
    expectOnCourt(1, ['Ana', 'Ben', 'Andrew', 'Maria'])
    expect(court(1)).not.toHaveTextContent('Juan')
    expectLine(['Juan', 'Jose'])
  })

  it('the score shows in the standings: winners 1–0, losers 0–1, ordered by wins', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await enterScore(user, 1, 11, 5)
    const table = await standingsTable(user)
    for (const h of [standings.player, standings.wins, standings.losses]) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
    expect(rowFor(table, 'Andrew')[standings.wins]).toBe('1')
    expect(rowFor(table, 'Andrew')[standings.losses]).toBe('0')
    expect(rowFor(table, 'Juan')[standings.wins]).toBe('1')
    expect(rowFor(table, 'Maria')[standings.wins]).toBe('0')
    expect(rowFor(table, 'Maria')[standings.losses]).toBe('1')
    expect(rowFor(table, 'Andrew')[standings.diff]).toContain('6')
    const rows = within(table).getAllByRole('row').map((r) => r.textContent ?? '')
    const at = (n: string) => rows.findIndex((t) => t.includes(n))
    expect(at('Andrew')).toBeLessThan(at('Maria'))
    expect(at('Juan')).toBeLessThan(at('Jose'))
  })

  it('shows "No scores yet." in the standings before any score', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    const toggle =
      screen.queryByRole('tab', { name: standings.title }) ?? screen.queryByRole('button', { name: standings.title })
    if (toggle) await user.click(toggle)
    expect(screen.getByText(standings.empty)).toBeInTheDocument()
  })

  it('refuses a tie with the config message and keeps the game on court', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await enterScore(user, 1, 9, 9)
    expect(screen.getByText(board.tie)).toBeInTheDocument()
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    expect(loadStack()?.session.games.filter((g) => g.status === 'scored')).toHaveLength(0)
  })

  it('refuses a score above 99 with the config message', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await enterScore(user, 1, 100, 5)
    expect(screen.getByText(board.badScore)).toBeInTheDocument()
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('skip score rotates without recording a result', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(within(court(1)).getByRole('button', { name: board.skipScore }))
    expectOnCourt(1, ['Ana', 'Ben', 'Andrew', 'Maria'])
    expectLine(['Juan', 'Jose'])
    const toggle =
      screen.queryByRole('tab', { name: standings.title }) ?? screen.queryByRole('button', { name: standings.title })
    if (toggle) await user.click(toggle)
    expect(screen.getByText(standings.empty)).toBeInTheDocument()
  })

  it('uses the chosen format: Winners stay, split up keeps the winners on court with new partners', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { format: 'winners-split' })
    await enterScore(user, 1, 11, 4)
    // Andrew & Juan won: Andrew + Ana against Juan + Ben; the losers go to the back.
    expectOnCourt(1, ['Andrew', 'Juan', 'Ana', 'Ben'])
    expectLine(['Maria', 'Jose'])
    expect(loadStack()?.session.format).toBe('winners-split')
  })

  it('time out takes a waiting player out of the line; back in line puts them at the back', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { names: `${SIX}\n7. Cara` })
    expectLine(['Ana', 'Ben', 'Cara'])
    const ana = within(upNext()).getAllByRole('listitem')[0]
    await user.click(within(ana).getByRole('button', { name: re(board.timeOut) }))
    expectLine(['Ben', 'Cara'])
    expect(screen.getByText(board.onBreak)).toBeInTheDocument()
    const back = screen.getByRole('button', { name: re(board.backInLine) })
    expect(back.closest('li') ?? back.parentElement).toHaveTextContent('Ana')
    expect(loadStack()?.session.players.find((p) => p.name === 'Ana')?.status).toBe('out')

    await user.click(back)
    expectLine(['Ben', 'Cara', 'Ana'])
    expect(screen.queryByRole('button', { name: re(board.backInLine) })).not.toBeInTheDocument()
  })

  it('a player on a time out is skipped when the court refills', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { names: `${SIX}\n7. Cara` })
    const ana = within(upNext()).getAllByRole('listitem')[0]
    await user.click(within(ana).getByRole('button', { name: re(board.timeOut) }))
    await enterScore(user, 1, 11, 7)
    expectOnCourt(1, ['Ben', 'Cara', 'Andrew', 'Maria'])
    expect(court(1)).not.toHaveTextContent('Ana')
  })

  it('remove takes a waiting player out of the line and the standings', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    const ben = within(upNext()).getAllByRole('listitem')[1]
    expect(ben).toHaveTextContent('Ben')
    await user.click(within(ben).getByRole('button', { name: re(board.remove) }))
    expectLine(['Ana'])
    expect(loadStack()?.session.players.find((p) => p.name === 'Ben')?.status).toBe('removed')
  })

  it('adds players during the session at the back of the line, ignoring duplicates', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    const box = screen.getByRole('textbox', { name: board.addLabel })
    await user.click(box)
    await user.paste('7. Cara, ana')
    await user.click(screen.getByRole('button', { name: board.addSubmit }))
    expectLine(['Ana', 'Ben', 'Cara'])
  })

  it('shows "Nobody is waiting." when the line is empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user, { names: 'Andrew\nMaria\nJuan\nJose' })
    expect(screen.getByText(board.lineEmpty)).toBeInTheDocument()
  })
})

describe('StackPage storage (T5.3)', () => {
  it('saves to localStorage after starting and after every change', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expect(localStorage.getItem(STACK_STORAGE_KEY)).not.toBeNull()
    expect(loadStack()?.ended).toBe(false)
    expect(loadStack()?.session.games).toHaveLength(1)
    await enterScore(user, 1, 11, 5)
    const saved = loadStack()!.session
    expect(saved.games[0]).toMatchObject({ status: 'scored', scoreA: 11, scoreB: 5 })
    expect(saved.games).toHaveLength(2)
  })

  it('resumes after a remount (refresh or closed tab) from storage', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await startStack(user)
    await enterScore(user, 1, 11, 5)
    first.unmount()

    renderPage()
    expect(screen.queryByRole('button', { name: start.submit })).not.toBeInTheDocument()
    expectOnCourt(1, ['Ana', 'Ben', 'Andrew', 'Maria'])
    expectLine(['Juan', 'Jose'])
    const table = await standingsTable(user)
    expect(rowFor(table, 'Andrew')[standings.wins]).toBe('1')
  })

  it('opens a session saved earlier straight on the board', () => {
    const session = fillCourts(createSession({ format: 'fair', courts: 2, names: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'] }))
    saveStack({ session, ended: false })
    renderPage()
    expectOnCourt(1, ['A1', 'B1', 'C1', 'D1'])
    expectOnCourt(2, ['E1', 'F1', 'G1', 'H1'])
    expectLine(['I1'])
  })

  it('ignores an unreadable saved value and shows the start screen', () => {
    localStorage.setItem(STACK_STORAGE_KEY, '{broken')
    renderPage()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
  })

  it('storage throwing: a one-line note shows and the tool still works for the visit', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expect(screen.getAllByText(paddleStack.storageNote)).toHaveLength(1)
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    await enterScore(user, 1, 11, 5)
    expectOnCourt(1, ['Ana', 'Ben', 'Andrew', 'Maria'])
    expectLine(['Juan', 'Jose'])
    expect(screen.getAllByText(paddleStack.storageNote)).toHaveLength(1)
  })

  it('shows no storage note when storage works', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expect(screen.queryByText(paddleStack.storageNote)).not.toBeInTheDocument()
  })

  it('"Start over" clears the saved session and returns to the start screen', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: paddleStack.restart }))
    if (confirm.mock.calls.length > 0) {
      expect(confirm).toHaveBeenCalledWith(paddleStack.restartConfirm)
    } else {
      const dialog = screen.getByText(paddleStack.restartConfirm).closest('[role="dialog"], [role="alertdialog"], form, div')!
      const buttons = within(dialog as HTMLElement).getAllByRole('button')
      const yes = buttons.find((b) => b.textContent?.trim() !== end.no && b.textContent?.trim() !== board.cancel)!
      await user.click(yes)
    }
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    expect(localStorage.getItem(STACK_STORAGE_KEY)).toBeNull()
  })
})

describe('StackPage end session (T5.3)', () => {
  it('asks for confirmation; "Keep playing" leaves the board as it was', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: end.button }))
    expect(screen.getByText(end.confirm)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: end.no }))
    expect(screen.queryByText(end.confirm)).not.toBeInTheDocument()
    expectOnCourt(1, ['Andrew', 'Maria', 'Juan', 'Jose'])
    expect(loadStack()?.ended).toBe(false)
  })

  it('"Yes, end it" shows the final standings, removes the board and is saved', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await enterScore(user, 1, 11, 5)
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))

    expect(screen.getByRole('heading', { name: ended.title })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: ended.title })
    expect(rowFor(table, 'Andrew')[standings.wins]).toBe('1')
    expect(rowFor(table, 'Maria')[standings.losses]).toBe('1')
    expect(screen.queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: board.upNext })).not.toBeInTheDocument()
    expect(loadStack()?.ended).toBe(true)
  })

  it('the final standings survive a remount', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await startStack(user)
    await enterScore(user, 1, 11, 5)
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))
    first.unmount()

    renderPage()
    expect(screen.getByRole('table', { name: ended.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: board.enterScore })).not.toBeInTheDocument()
  })

  it('"Start a new session" goes back to the start screen and clears storage', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))
    await user.click(screen.getByRole('button', { name: ended.again }))
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    expect(localStorage.getItem(STACK_STORAGE_KEY)).toBeNull()
  })
})

describe('StackPage venue block (T5.3)', () => {
  function expectVenueBlock() {
    expect(screen.getByText(venueCta.title)).toBeInTheDocument()
    expect(screen.getByText(venueCta.body)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: venueCta.link })
    expect(link).toHaveAttribute('href', venueCta.href)
    expect(venueCta.href).toBe('/#contact')
  }

  it('shows "Run a venue?" linking to /#contact on the start screen', () => {
    renderPage()
    expectVenueBlock()
  })

  it('keeps the venue block under the board', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    expectVenueBlock()
  })

  it('keeps the venue block under the final standings', async () => {
    const user = userEvent.setup()
    renderPage()
    await startStack(user)
    await user.click(screen.getByRole('button', { name: end.button }))
    await user.click(screen.getByRole('button', { name: end.yes }))
    expectVenueBlock()
  })
})
