// T8.2 Acceptance (user, 2026-11-18, from the by-eye check), TASKS.md T8.2:
// (1) when entering a score, each box shows on screen which team it is for: the team's names as its visible label,
//     still announced as "Score for <team>" (`paddleStack.board.scoreFor`), so the first and second team can't be
//     mixed up;
// (2) on the board's court cards (`.stack-teams`) and the TV's (`TvBoard`, `.stack-tv-teams`), "vs" sits centred
//     between two lines that span the card's width (`———— vs ————`), drawn so it stays decorative for screen readers
//     and works in both themes.
//
// Contract the tests rely on (the plan's names):
// - `form.stack-score` on a board court card; each score input has an associated, visible `<label>` (not `.sr-only`)
//   whose text holds that team's names ("Ana & Carla"); the input's accessible name stays
//   `${board.scoreFor} ${team}`, team A first;
// - the "vs" text (`paddleStack.board.vs` / `paddleStack.tv.vs`) is in an element with class `stack-vs`, between the
//   two teams; the lines are drawn by CSS in `src/styles/global.css` (`.stack-vs` as a flex or grid row with
//   `::before`/`::after` or child lines), not by dash characters in the DOM.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import css from '../../styles/global.css?raw'
import { createSession, fillCourts } from './engine'
import { StackPage } from './StackPage'
import { saveStack } from './storage'
import { TvBoard } from './TvBoard'
import type { Session } from './types'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => false), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

const { board, tv } = paddleStack
const NAMES = ['Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Fred', 'Gina', 'Hugo', 'Ivy']

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

function session(courts = 2): Session {
  return fillCourts(createSession({ format: 'fair', courts, names: NAMES }))
}

/** "Ana & Carla" for each side of the game on court `n`, as the page writes a team. */
function teamsOn(s: Session, n: number): [string, string] {
  const game = s.games.find((g) => g.court === n && g.status === 'playing')!
  const nameOf = (id: string) => s.players.find((p) => p.id === id)!.name
  const team = (ids: [string, string]) => `${nameOf(ids[0])} & ${nameOf(ids[1])}`
  return [team(game.teamA), team(game.teamB)]
}

function renderBoard(s: Session) {
  saveStack({ session: s, ended: false })
  return render(
    <MemoryRouter initialEntries={['/paddle-stack']}>
      <StackPage />
    </MemoryRouter>,
  )
}

const court = (n: number) => screen.getByRole('region', { name: `${board.court} ${n}` })

async function openScore(n: number) {
  const user = userEvent.setup()
  await user.click(within(court(n)).getByRole('button', { name: board.enterScore }))
  const form = court(n).querySelector('form.stack-score')
  expect(form, `form.stack-score on court ${n}`).not.toBeNull()
  return form as HTMLFormElement
}

/** The text of the visible `<label>`s tied to an input (by `for` or by wrapping), skipping `.sr-only` ones. */
function visibleLabelText(input: HTMLInputElement): string {
  const labels = [...(input.labels ?? [])]
  const shown = labels.filter((l) => !l.closest('.sr-only') && !l.classList.contains('sr-only'))
  return shown.map((l) => l.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim()
}

describe('T8.2 (1): each score box shows which team it is for', () => {
  it('each score input has a visible <label> with its own team’s names, team A first', async () => {
    const s = session()
    renderBoard(s)
    const [teamA, teamB] = teamsOn(s, 1)
    const form = await openScore(1)
    const inputs = [...form.querySelectorAll<HTMLInputElement>('input')]
    expect(inputs).toHaveLength(2)

    const first = visibleLabelText(inputs[0])
    const second = visibleLabelText(inputs[1])
    expect(first, 'first box’s visible label').toContain(teamA)
    expect(first, 'first box’s label names only its own team').not.toContain(teamB)
    expect(second, 'second box’s visible label').toContain(teamB)
    expect(second, 'second box’s label names only its own team').not.toContain(teamA)
  })

  it('the labels are on screen inside the score form, not hidden from view', async () => {
    const s = session()
    renderBoard(s)
    const form = await openScore(1)
    for (const input of form.querySelectorAll<HTMLInputElement>('input')) {
      const labels = [...(input.labels ?? [])].filter((l) => !l.closest('.sr-only'))
      expect(labels.length, 'a visible label for each box').toBeGreaterThanOrEqual(1)
      for (const l of labels) {
        expect(form.contains(l), 'label inside form.stack-score').toBe(true)
        expect(l).toBeVisible()
      }
    }
  })

  it('still announces each box as "Score for <team>" (board.scoreFor), team A first', async () => {
    const s = session()
    renderBoard(s)
    const [teamA, teamB] = teamsOn(s, 1)
    const form = await openScore(1)
    const boxes = within(form).getAllByRole('textbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toHaveAccessibleName(`${board.scoreFor} ${teamA}`)
    expect(boxes[1]).toHaveAccessibleName(`${board.scoreFor} ${teamB}`)
  })

  it('labels follow the court: court 2’s boxes name court 2’s teams', async () => {
    const s = session(2)
    renderBoard(s)
    const [teamA, teamB] = teamsOn(s, 2)
    const form = await openScore(2)
    const inputs = [...form.querySelectorAll<HTMLInputElement>('input')]
    expect(visibleLabelText(inputs[0])).toContain(teamA)
    expect(visibleLabelText(inputs[1])).toContain(teamB)
    expect(within(form).getByRole('textbox', { name: `${board.scoreFor} ${teamA}` })).toBe(inputs[0])
    expect(within(form).getByRole('textbox', { name: `${board.scoreFor} ${teamB}` })).toBe(inputs[1])
  })
})

/** Checks a teams block: one `.stack-vs` holding exactly the copy, between team A and team B, with no dashes in text. */
function expectVsBetween(teams: Element, vs: string, teamA: string, teamB: string) {
  const dividers = teams.querySelectorAll('.stack-vs')
  expect(dividers, '.stack-vs inside the teams block').toHaveLength(1)
  const divider = dividers[0]
  expect(divider.textContent?.trim(), 'the divider’s text is only the vs copy').toBe(vs)

  const a = within(teams as HTMLElement).getByText(teamA)
  const b = within(teams as HTMLElement).getByText(teamB)
  expect(a.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING, 'vs after team A').toBeTruthy()
  expect(divider.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING, 'team B after vs').toBeTruthy()

  // The lines are decorative: drawn by CSS, so no dash or box-drawing characters reach screen readers.
  expect(teams.textContent ?? '', 'no drawn-line characters in the text').not.toMatch(/[—–―─━]|-{2,}|_{2,}/)
}

describe('T8.2 (2): "vs" between two lines on the court cards', () => {
  it('board court card: "vs" (board.vs) is in .stack-vs between the two teams, lines not in the text', () => {
    const s = session(2)
    renderBoard(s)
    for (const n of [1, 2]) {
      const teams = court(n).querySelector('.stack-teams')
      expect(teams, `.stack-teams on court ${n}`).not.toBeNull()
      const [teamA, teamB] = teamsOn(s, n)
      expectVsBetween(teams!, board.vs, teamA, teamB)
    }
  })

  it('board court card keeps .stack-vs while the score form is open', async () => {
    const s = session(1)
    renderBoard(s)
    await openScore(1)
    expect(court(1).querySelectorAll('.stack-teams .stack-vs')).toHaveLength(1)
  })

  it('TV court card: "vs" (tv.vs) is in .stack-vs between the two teams, lines not in the text', () => {
    const s = session(2)
    render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} />)
    for (const n of [1, 2]) {
      const card = screen.getByRole('region', { name: `${tv.court} ${n}` })
      const teams = card.querySelector('.stack-tv-teams')
      expect(teams, `.stack-tv-teams on TV court ${n}`).not.toBeNull()
      const [teamA, teamB] = teamsOn(s, n)
      expectVsBetween(teams!, tv.vs, teamA, teamB)
    }
  })

  it('an empty court has no vs divider (board and TV)', () => {
    // 5 players on 2 courts: court 2 waits.
    const s = fillCourts(createSession({ format: 'fair', courts: 2, names: NAMES.slice(0, 5) }))
    const { unmount } = renderBoard(s)
    expect(court(2).querySelector('.stack-vs')).toBeNull()
    unmount()
    render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} />)
    expect(screen.getByRole('region', { name: `${tv.court} 2` }).querySelector('.stack-vs')).toBeNull()
  })
})

describe('T8.2 (2): global.css draws the vs lines', () => {
  /** Every `selector { body }` rule, with media queries opened up, split into one entry per selector. */
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) =>
    m[1]
      .split(',')
      .map((sel) => sel.trim())
      .filter(Boolean)
      .map((selector) => ({ selector, body: m[2] })),
  )
  const VS = /\.stack-vs(?![\w-])/
  const vsRules = rules.filter((r) => VS.test(r.selector) || /\.stack-vs-[\w-]+/.test(r.selector))
  /** Rules for the divider itself (`.stack-vs`, optionally scoped, no pseudo-element or descendant after it). */
  const boxRules = vsRules.filter((r) => /\.stack-vs$/.test(r.selector))
  /** Rules for the lines: `.stack-vs::before/::after`, a child of `.stack-vs`, or a `.stack-vs-*` line element. */
  const lineRules = vsRules.filter((r) => !/\.stack-vs$/.test(r.selector))
  const prop = (body: string, name: string) =>
    [...body.matchAll(new RegExp(`(?:^|[;\\s{])${name}\\s*:\\s*([^;]+)`, 'g'))].map((m) => m[1].trim())
  const all = (list: typeof rules, name: string) => list.flatMap((r) => prop(r.body, name))

  it('styles .stack-vs as a centred row (flex or grid)', () => {
    expect(boxRules.length, '.stack-vs rules').toBeGreaterThanOrEqual(1)
    const display = all(boxRules, 'display')
    expect(display.some((d) => /^(flex|grid)\b/.test(d)), `display of .stack-vs: ${display.join(', ')}`).toBe(true)
    expect(all(boxRules, 'align-items'), 'align-items: center').toContain('center')
    expect(all(boxRules, 'flex-direction').some((d) => /column/.test(d)), 'not a column').toBe(false)
  })

  it('draws a line on each side of "vs"', () => {
    const pseudo = lineRules.filter((r) => /::?(before|after)$/.test(r.selector))
    if (pseudo.length > 0) {
      expect(pseudo.some((r) => /::?before$/.test(r.selector)), '.stack-vs::before').toBe(true)
      expect(pseudo.some((r) => /::?after$/.test(r.selector)), '.stack-vs::after').toBe(true)
      expect(all(pseudo, 'content').some((c) => /^(''|"")$/.test(c)), "content: '' (nothing to announce)").toBe(true)
    } else {
      expect(lineRules.length, 'rules for the line elements inside .stack-vs').toBeGreaterThanOrEqual(1)
    }
    const drawn = [...all(lineRules, 'border-top'), ...all(lineRules, 'border-bottom'), ...all(lineRules, 'border-block-start'),
      ...all(lineRules, 'border-block-end'), ...all(lineRules, 'background'), ...all(lineRules, 'background-color'),
      ...all(lineRules, 'border-top-color'), ...all(lineRules, 'border-color'), ...all(lineRules, 'border')]
    expect(drawn.length, 'a border or background draws the line').toBeGreaterThanOrEqual(1)
    expect(drawn.some((v) => /var\(\s*--|currentcolor/i.test(v)), `line colour from a theme variable: ${drawn.join(' | ')}`).toBe(true)
  })

  it('the lines grow to fill the card’s width', () => {
    const isGrid = all(boxRules, 'display').some((d) => /^grid\b/.test(d))
    if (isGrid) {
      const cols = all(boxRules, 'grid-template-columns').join(' ')
      expect((cols.match(/\b1fr\b|minmax\([^)]*1fr\)/g) ?? []).length, `grid columns: ${cols}`).toBeGreaterThanOrEqual(2)
    } else {
      const grows = [...all(lineRules, 'flex'), ...all(lineRules, 'flex-grow')]
      expect(grows.some((v) => /^[1-9]/.test(v)), `flex grow on the lines: ${grows.join(', ')}`).toBe(true)
    }
    // The divider itself spans the card: not inline, not shrink-wrapped by align-self, width full if set.
    expect(all(boxRules, 'display').some((d) => /^inline/.test(d)), 'not inline-flex/inline-grid').toBe(false)
    expect(all(boxRules, 'align-self').some((v) => !/^(stretch|auto|normal)$/.test(v)), 'align-self keeps it full width').toBe(false)
    for (const w of all(boxRules, 'width')) expect(w, '.stack-vs width').toBe('100%')
    // The teams blocks (column flex) must not shrink-wrap their children.
    const teamsRules = rules.filter((r) => /\.stack-(tv-)?teams$/.test(r.selector))
    expect(teamsRules.length, '.stack-teams and .stack-tv-teams rules').toBeGreaterThanOrEqual(2)
    const align = all(teamsRules, 'align-items')
    expect(align.some((v) => !/^(stretch|normal)$/.test(v)), `teams align-items: ${align.join(', ')}`).toBe(false)
  })

  it('uses no fixed colours, so the lines and word follow light and dark themes', () => {
    expect(vsRules.length).toBeGreaterThanOrEqual(1)
    for (const r of vsRules) {
      expect(r.body, `${r.selector} has no hex/rgb/hsl colour`).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i)
    }
  })
})
