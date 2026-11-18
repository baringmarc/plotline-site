// T8.6 on the organizer's board (TASKS.md T8.6, "Picked (user, 2026-11-18)": a colour per court and win streaks;
// SPEC §6 2026-11-18 T8.6 row: a streak is shown from 2 wins in a row as the same side).
//
// Structure the tests rely on (the plan's names):
// - each board court card (`section.stack-court`, region `${board.court} ${n}`) has class `tone-${courtTone(n)}`;
// - `.stack-court-streak` with `tv.streak(n)` beside a side whose streak is 2 or more;
// - the colour tokens `--court-1` … `--court-6` in `src/styles/global.css`, used by the `.tone-1` … `.tone-6` classes.
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import css from '../../styles/global.css?raw'
import { StackPage } from './StackPage'
import { saveStack } from './storage'
import { courtTone } from './tvInfo'
import type { Game, Player, PlayerStatus, Session, Team } from './types'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => false), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

const { board, tv } = paddleStack

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

const NAMES: Record<string, string> = { a: 'Ana', b: 'Ben', c: 'Carla', d: 'Dino', e: 'Ella', f: 'Fred', g: 'Gina', h: 'Hugo', i: 'Ivy', j: 'Jun' }
const p = (id: string, status: PlayerStatus): Player => ({ id, name: NAMES[id], status })
const scored = (id: string, court: number, teamA: Team, teamB: Team, scoreA: number, scoreB: number): Game => ({
  id, court, teamA, teamB, status: 'scored', scoreA, scoreB,
})
const on = (id: string, court: number, teamA: Team, teamB: Team): Game => ({ id, court, teamA, teamB, status: 'playing' })

/** Court 1: Ana & Ben won twice in a row and are on again (streak 2). Court 2: Gina & Hugo won once (no chip). */
function streakSession(): Session {
  return {
    title: '',
    play: 'doubles',
    teams: 'open',
    format: 'fair',
    courts: 2,
    players: [
      p('a', 'playing'), p('b', 'playing'), p('c', 'playing'), p('d', 'playing'),
      p('e', 'waiting'), p('f', 'waiting'), p('g', 'playing'), p('h', 'playing'), p('i', 'playing'), p('j', 'playing'),
    ],
    line: ['e', 'f'],
    games: [
      scored('g1', 1, ['a', 'b'], ['c', 'd'], 11, 7),
      scored('g2', 2, ['e', 'f'], ['g', 'h'], 4, 11),
      scored('g3', 1, ['c', 'd'], ['a', 'b'], 9, 11),
      on('g4', 1, ['a', 'b'], ['c', 'd']),
      on('g5', 2, ['g', 'h'], ['i', 'j']),
    ],
  }
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
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('T8.6 board: a colour per court', () => {
  it('each court card has its tone class', () => {
    renderBoard(streakSession())
    expect(court(1)).toHaveClass('stack-court', `tone-${courtTone(1)}`)
    expect(court(2)).toHaveClass('stack-court', `tone-${courtTone(2)}`)
    expect(court(1)).toHaveClass('tone-1')
    expect(court(2)).toHaveClass('tone-2')
  })

  it('tones cycle after six courts, empty courts included', () => {
    const s: Session = { ...streakSession(), courts: 8 }
    renderBoard(s)
    expect(court(3)).toHaveClass('tone-3')
    expect(court(6)).toHaveClass('tone-6')
    expect(court(7)).toHaveClass('tone-1')
    expect(court(8)).toHaveClass('tone-2')
  })
})

describe('T8.6 board: win streaks', () => {
  it('shows tv.streak(2) on the court whose side won twice in a row', () => {
    renderBoard(streakSession())
    const chips = court(1).querySelectorAll('.stack-court-streak')
    expect(chips).toHaveLength(1)
    expect(text(chips[0])).toBe(tv.streak(2))
  })

  it('no chip for a side with a single win', () => {
    renderBoard(streakSession())
    expect(court(2).querySelector('.stack-court-streak')).toBeNull()
    expect(document.querySelectorAll('.stack-court-streak')).toHaveLength(1)
  })

  it('no chip after the side loses', () => {
    const s = streakSession()
    s.games = [...s.games.slice(0, 3), scored('g3b', 1, ['a', 'b'], ['c', 'd'], 5, 11), ...s.games.slice(3)]
    renderBoard(s)
    expect(document.querySelector('.stack-court-streak')).toBeNull()
  })
})

describe('T8.6 colour tokens in global.css', () => {
  it('defines --court-1 … --court-6', () => {
    for (let n = 1; n <= 6; n++) expect(css, `--court-${n}`).toMatch(new RegExp(`--court-${n}\\s*:`))
    expect(css).not.toMatch(/--court-7\s*:/)
  })

  it('has a .tone-N rule for each of the six tones, using its token', () => {
    for (let n = 1; n <= 6; n++) {
      expect(css, `.tone-${n}`).toMatch(new RegExp(`\\.tone-${n}\\b`))
      expect(css, `var(--court-${n})`).toContain(`var(--court-${n})`)
    }
  })
})
