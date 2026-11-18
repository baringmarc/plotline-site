// T8.6 TV board, design A "Court bands" (TASKS.md T8.6, "Picked (user, 2026-11-18)"; SPEC §6 2026-11-18 T8.6 row):
// the logo tile and the "plotline" wordmark always visible, the title as the TV's heading, each court a card with a
// coloured band (Court N and its last result) in a colour of its own, a "N wins in a row" chip beside a side on a
// streak (from 2), clear waiting states for doubles and singles, who's on a break, a slot kept for M6's join QR, and
// the footer with the format and play. Copy from `paddleStack.tv`.
//
// Structure the tests rely on (the plan's names):
// - `.stack-tv-logo` holding `<img src="/logo.svg" alt="">` and the text `tv.brand`;
// - the title as `<h1 className="stack-tv-title">` when set;
// - each court region (`${tv.court} ${n}`) has class `tone-${courtTone(n)}`; a `.stack-tv-band` inside it holds the
//   court heading and, when there is a last result, `.stack-tv-last` with `tv.lastGame(high, low)`;
// - `.stack-tv-streak` with `tv.streak(n)` beside a side whose streak is 2 or more;
// - an empty court shows `tv.waiting` in doubles, `tv.waitingSingles` in singles;
// - `.stack-tv-break` with `tv.onBreak` and the names of players on a time out, only when there are any;
// - `.stack-tv-qr`, an empty `aria-hidden` slot;
// - `.stack-tv-meta` in the footer: the format's label (`paddleStack.formats`) and the play's (`start.plays`).
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { courtTone } from './tvInfo'
import { TvBoard } from './TvBoard'
import type { Format, Game, Play, Player, PlayerStatus, Session, Team } from './types'

const { tv, formats, start } = paddleStack

// ---------- fixtures ----------

const NAMES: Record<string, string> = {
  a: 'Ana', b: 'Ben', c: 'Carla', d: 'Dino', e: 'Ella', f: 'Fred', g: 'Gina', h: 'Hugo', i: 'Ivy', j: 'Jun', k: 'Kim', l: 'Leo',
}
const p = (id: string, status: PlayerStatus): Player => ({ id, name: NAMES[id], status })
const scored = (id: string, court: number, teamA: Team, teamB: Team, scoreA: number, scoreB: number): Game => ({
  id, court, teamA, teamB, status: 'scored', scoreA, scoreB,
})
const on = (id: string, court: number, teamA: Team, teamB: Team): Game => ({ id, court, teamA, teamB, status: 'playing' })

/**
 * Doubles, 2 courts. Court 1: Ana & Ben won 11–7 and 11–9 and are on again (streak 2); last result 11–9.
 * Court 2: Gina & Hugo won 11–4 as team B, then a skipped game, now on again (streak 1); last result 11–4.
 * Ella and Fred wait; Kim is on a time out; Leo was removed.
 */
function doubles(opts: { title?: string; format?: Format; courts?: number; withBreak?: boolean } = {}): Session {
  return {
    title: opts.title ?? '',
    play: 'doubles',
    teams: 'open',
    format: opts.format ?? 'fair',
    courts: opts.courts ?? 2,
    players: [
      p('a', 'playing'), p('b', 'playing'), p('c', 'playing'), p('d', 'playing'),
      p('e', 'waiting'), p('f', 'waiting'), p('g', 'playing'), p('h', 'playing'),
      p('i', 'playing'), p('j', 'playing'),
      ...(opts.withBreak === false ? [] : [p('k', 'out')]),
      p('l', 'removed'),
    ],
    line: ['e', 'f'],
    games: [
      scored('g1', 1, ['a', 'b'], ['c', 'd'], 11, 7),
      scored('g2', 2, ['e', 'f'], ['g', 'h'], 4, 11),
      scored('g3', 1, ['a', 'b'], ['e', 'f'], 11, 9),
      { id: 'g4', court: 2, teamA: ['g', 'h'], teamB: ['c', 'd'], status: 'skipped' },
      on('g5', 1, ['a', 'b'], ['c', 'd']),
      on('g6', 2, ['g', 'h'], ['i', 'j']),
    ],
  }
}

/** Singles, 2 courts. Court 1: Ana beat Ben 11–5 and Carla 11–3, now plays Ben (streak 2). Court 2 is empty. */
function singles(title = ''): Session {
  return {
    title,
    play: 'singles',
    teams: 'open',
    format: 'fair',
    courts: 2,
    players: [p('a', 'playing'), p('b', 'playing'), p('c', 'waiting')],
    line: ['c'],
    games: [scored('g1', 1, ['a'], ['b'], 11, 5), scored('g2', 1, ['a'], ['c'], 11, 3), on('g3', 1, ['a'], ['b'])],
  }
}

function empty(courts: number, play: Play = 'doubles'): Session {
  return { title: '', play, teams: 'open', format: 'fair', courts, players: [p('a', 'waiting')], line: ['a'], games: [] }
}

function renderTv(s: Session) {
  return render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} />)
}

const court = (n: number) => screen.getByRole('region', { name: `${tv.court} ${n}` })
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()

// ---------- copy ----------

describe('T8.6 copy in paddleStack.tv', () => {
  it('the wordmark is "plotline"', () => {
    expect(tv.brand).toMatch(/^plotline$/i)
  })

  it('tv.lastGame(high, low) names both scores, the winner’s first', () => {
    const s = tv.lastGame(11, 9)
    expect(typeof s).toBe('string')
    expect(s).toContain('11')
    expect(s.indexOf('11')).toBeLessThan(s.lastIndexOf('9'))
    expect(tv.lastGame(15, 0)).toContain('0')
  })

  it('tv.streak(n) names the number of wins', () => {
    expect(tv.streak(2)).toContain('2')
    expect(tv.streak(5)).toContain('5')
    expect(tv.streak(2)).not.toBe(tv.streak(3))
  })

  it('tv.onBreak and tv.waitingSingles are set, and singles waiting differs from doubles', () => {
    expect(tv.onBreak.trim()).not.toBe('')
    expect(tv.waitingSingles.trim()).not.toBe('')
    expect(tv.waitingSingles).not.toBe(tv.waiting)
  })
})

// ---------- logo and title ----------

describe('T8.6 TV logo (always visible)', () => {
  it('shows the logo tile and the wordmark', () => {
    const { container } = renderTv(doubles())
    const logo = container.querySelector('.stack-tv-logo')
    expect(logo, '.stack-tv-logo').not.toBeNull()
    const img = logo!.querySelector('img')
    expect(img, 'logo tile').not.toBeNull()
    expect(img!.getAttribute('src')).toBe('/logo.svg')
    expect(img!.getAttribute('alt')).toBe('')
    expect(logo).toHaveTextContent(tv.brand)
  })

  it('the logo shows with a title, without one, and in singles', () => {
    for (const s of [doubles({ title: 'Sunday Open Play' }), doubles(), singles(), empty(1)]) {
      const { container, unmount } = renderTv(s)
      expect(container.querySelector('.stack-tv-logo img[src="/logo.svg"]'), `${s.play} "${s.title}"`).not.toBeNull()
      unmount()
    }
  })
})

describe('T8.6 TV title heads the board', () => {
  it('the title is the TV’s h1, with class stack-tv-title', () => {
    renderTv(doubles({ title: 'Sunday Open Play (ALL LEVELS)' }))
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(text(h1)).toBe('Sunday Open Play (ALL LEVELS)')
    expect(h1).toHaveClass('stack-tv-title')
  })

  it('singles shows the title too', () => {
    renderTv(singles('Singles Ladder'))
    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('Singles Ladder')
  })

  it('no h1 and no .stack-tv-title when there is no title', () => {
    const { container } = renderTv(doubles())
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(container.querySelector('.stack-tv-title')).toBeNull()
  })
})

// ---------- court colours and bands ----------

describe('T8.6 a colour per court', () => {
  it('each court region has its tone class', () => {
    renderTv(doubles())
    expect(court(1)).toHaveClass(`tone-${courtTone(1)}`)
    expect(court(2)).toHaveClass(`tone-${courtTone(2)}`)
    expect(court(1)).toHaveClass('tone-1')
    expect(court(2)).toHaveClass('tone-2')
  })

  it('tones cycle after six courts: court 7 has tone 1, court 8 tone 2', () => {
    renderTv(empty(8))
    for (let n = 1; n <= 8; n++) expect(court(n), `court ${n}`).toHaveClass(`tone-${courtTone(n)}`)
    expect(court(7)).toHaveClass('tone-1')
    expect(court(8)).toHaveClass('tone-2')
    expect(court(7)).not.toHaveClass('tone-7')
  })

  it('empty courts keep their tone', () => {
    renderTv(singles())
    expect(court(2)).toHaveClass('tone-2')
  })
})

describe('T8.6 court band with the last result', () => {
  it('the band holds the court heading', () => {
    renderTv(doubles())
    for (const n of [1, 2]) {
      const band = court(n).querySelector('.stack-tv-band')
      expect(band, `band on court ${n}`).not.toBeNull()
      expect(within(band as HTMLElement).getByRole('heading', { name: `${tv.court} ${n}` })).toBeInTheDocument()
    }
  })

  it('shows each court’s last result in the band, winner’s score first', () => {
    renderTv(doubles())
    const last1 = court(1).querySelector('.stack-tv-band .stack-tv-last')
    expect(text(last1)).toBe(tv.lastGame(11, 9))
    // Court 2: team B won 11–4; the later skipped game doesn't hide it.
    const last2 = court(2).querySelector('.stack-tv-band .stack-tv-last')
    expect(text(last2)).toBe(tv.lastGame(11, 4))
  })

  it('no last result on a court with no scored game', () => {
    renderTv(singles())
    expect(court(2).querySelector('.stack-tv-band'), 'band on an empty court').not.toBeNull()
    expect(court(2).querySelector('.stack-tv-last')).toBeNull()
    expect(text(court(1).querySelector('.stack-tv-last'))).toBe(tv.lastGame(11, 3))
  })

  it('an empty court still shows its last result', () => {
    const s = doubles()
    s.games = s.games.filter((g) => g.id !== 'g6') // court 2 is free after its games
    renderTv(s)
    expect(court(2)).toHaveTextContent(tv.waiting)
    expect(text(court(2).querySelector('.stack-tv-last'))).toBe(tv.lastGame(11, 4))
  })
})

// ---------- streaks ----------

describe('T8.6 win streak chips (from 2 wins in a row)', () => {
  it('shows "2 wins in a row" on the court whose side won twice', () => {
    renderTv(doubles())
    const chips = court(1).querySelectorAll('.stack-tv-streak')
    expect(chips).toHaveLength(1)
    expect(text(chips[0])).toBe(tv.streak(2))
  })

  it('no chip for a side with one win, nor on any other court', () => {
    const { container } = renderTv(doubles())
    expect(court(2).querySelector('.stack-tv-streak')).toBeNull()
    expect(container.querySelectorAll('.stack-tv-streak')).toHaveLength(1)
  })

  it('counts a longer streak', () => {
    const s = doubles()
    s.games.splice(4, 0, scored('g4b', 1, ['c', 'd'], ['a', 'b'], 3, 11)) // a third win for Ana & Ben, as team B
    renderTv(s)
    expect(text(court(1).querySelector('.stack-tv-streak'))).toBe(tv.streak(3))
  })

  it('singles: a player on a streak gets the chip', () => {
    renderTv(singles())
    const chips = court(1).querySelectorAll('.stack-tv-streak')
    expect(chips).toHaveLength(1)
    expect(text(chips[0])).toBe(tv.streak(2))
  })

  it('no chips when no game is on court', () => {
    const { container } = renderTv(empty(2))
    expect(container.querySelector('.stack-tv-streak')).toBeNull()
  })
})

// ---------- waiting states ----------

describe('T8.6 empty courts, doubles and singles', () => {
  it('an empty doubles court shows tv.waiting', () => {
    renderTv(empty(2))
    expect(court(1)).toHaveTextContent(tv.waiting)
    expect(court(1)).not.toHaveTextContent(tv.waitingSingles)
  })

  it('an empty singles court shows tv.waitingSingles, not the doubles wording', () => {
    renderTv(singles())
    expect(court(2)).toHaveTextContent(tv.waitingSingles)
    expect(court(2)).not.toHaveTextContent(tv.waiting)
    expect(court(1)).not.toHaveTextContent(tv.waitingSingles)
  })

  it('a singles court with a game shows both names, no "&"', () => {
    renderTv(singles())
    expect(court(1)).toHaveTextContent('Ana')
    expect(court(1)).toHaveTextContent('Ben')
    expect(court(1).textContent).not.toContain('&')
  })
})

// ---------- break, QR slot, footer ----------

describe('T8.6 who’s on a break', () => {
  it('lists the players on a time out under tv.onBreak', () => {
    const { container } = renderTv(doubles())
    const brk = container.querySelector('.stack-tv-break')
    expect(brk, '.stack-tv-break').not.toBeNull()
    expect(brk).toHaveTextContent(tv.onBreak)
    expect(brk).toHaveTextContent('Kim')
  })

  it('leaves out removed, waiting and playing players', () => {
    const { container } = renderTv(doubles())
    const brk = container.querySelector('.stack-tv-break')!
    for (const name of ['Leo', 'Ella', 'Fred', 'Ana', 'Gina']) expect(brk, name).not.toHaveTextContent(name)
  })

  it('lists every player on a time out', () => {
    const s = doubles()
    s.players = s.players.map((pl) => (pl.id === 'e' ? { ...pl, status: 'out' } : pl))
    s.line = ['f']
    const { container } = renderTv(s)
    const brk = container.querySelector('.stack-tv-break')!
    expect(brk).toHaveTextContent('Kim')
    expect(brk).toHaveTextContent('Ella')
  })

  it('is not shown when nobody is on a break', () => {
    const { container } = renderTv(doubles({ withBreak: false }))
    expect(container.querySelector('.stack-tv-break')).toBeNull()
    expect(document.body).not.toHaveTextContent(tv.onBreak)
  })
})

describe('T8.6 space kept for M6’s join QR', () => {
  it('has an empty .stack-tv-qr slot hidden from screen readers', () => {
    const { container } = renderTv(doubles())
    const qr = container.querySelector('.stack-tv-qr')
    expect(qr, '.stack-tv-qr').not.toBeNull()
    expect(qr!.getAttribute('aria-hidden')).toBe('true')
    expect(text(qr)).toBe('')
  })
})

describe('T8.6 footer with the format and play', () => {
  const label = (f: Format) => formats.find((x) => x.id === f)!.label
  const playLabel = (pl: Play) => start.plays.find((x) => x.id === pl)!.label

  it('shows the format’s name and Doubles in the footer', () => {
    const { container } = renderTv(doubles())
    const meta = container.querySelector('footer .stack-tv-meta')
    expect(meta, 'footer .stack-tv-meta').not.toBeNull()
    expect(meta).toHaveTextContent(label('fair'))
    expect(meta).toHaveTextContent(playLabel('doubles'))
    expect(meta).not.toHaveTextContent(playLabel('singles'))
  })

  it('follows the session’s format', () => {
    const { container } = renderTv(doubles({ format: 'winners-losers' }))
    const meta = container.querySelector('footer .stack-tv-meta')
    expect(meta).toHaveTextContent(label('winners-losers'))
    expect(meta).not.toHaveTextContent(label('fair'))
  })

  it('shows Singles for a singles session', () => {
    const { container } = renderTv(singles())
    const meta = container.querySelector('footer .stack-tv-meta')
    expect(meta).toHaveTextContent(playLabel('singles'))
    expect(meta).not.toHaveTextContent(playLabel('doubles'))
  })

  it('the exit button is still the only control', () => {
    renderTv(doubles())
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([tv.exit])
  })
})
