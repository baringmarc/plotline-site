// T8.7 Share cards: the layout data (TASKS.md T8.7 Acceptance: "tests cover each card's layout data (long names cut,
// no title, a player with no scored games, streak maths)"). Plan gate, SPEC §6 "T8.7 plan gate" (2026-11-18):
// story 1080×1920 and post 1080×1350; the group card shows the rows that fit its size, then "+N more"; the best win
// streak is the longest run of wins over the player's scored games in order (skipped and cancelled games don't break it).
//
// Contract the tests rely on (the plan's names; fields picked here, see the report):
// - `CARD_SIZES = { story: { width: 1080, height: 1920 }, post: { width: 1080, height: 1350 } }`, `CardSize`;
// - `MAX_CARD_NAME`: names longer than this many characters (code points) are cut to at most that many, ending "…";
// - `bestStreak(session, playerId)`;
// - `playerCardData(session, playerId, { date })` → `PlayerCardData | null` (null for an unknown or removed player):
//   `{ name, place, of, wins, losses, games, record, winRate, streak, diff, title, date, footer }` where `of` is the
//   number of players in the standings, `record` "W–L" (en dash), `winRate` a whole percent (rounded) or null with no
//   scored games, `diff` signed with "+" / "−" (U+2212) / "0", `title` the trimmed session title or '' when there is
//   none, `date` the en-PH short date like the T5.5 image, `footer` `share.footer`;
// - `groupCardData(session, { date, size })` → `{ title, date, rows: { place, name, record, diff }[], more, footer }`:
//   the first standings rows that fit, `more` the rest (0 when all fit); `title` falls back to `share.defaultTitle`;
// - `groupRowsFit(size)`: how many rows each size holds.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { paddleStack } from '../../../config/site'
import { standings } from '../engine'
import type { Game, Player, Session } from '../types'
import { CARD_SIZES, MAX_CARD_NAME, bestStreak, groupCardData, groupRowsFit, playerCardData, type CardSize } from './cardData'

const { share } = paddleStack
const MINUS = '−'
const EN_DASH = '–'
const NOON_UTC = new Date('2026-11-12T12:00:00Z') // Thu 12 Nov 2026 from UTC−12 to UTC+11
const THU_12_NOV = /^Thu, (12 Nov|Nov 12,) 2026$/

// ---------- hand-built sessions ----------

const player = (id: string, name = id, status: Player['status'] = 'waiting'): Player => ({ id, name, status })

let gameNo = 0
/** A game between two sides; `a` and `b` are the scores (A wins when a > b). */
function scored(teamA: string[], teamB: string[], a: number, b: number): Game {
  return { id: `g${++gameNo}`, court: 1, teamA: teamA as Game['teamA'], teamB: teamB as Game['teamB'], status: 'scored', scoreA: a, scoreB: b }
}
function ended(teamA: string[], teamB: string[], status: 'skipped' | 'cancelled' | 'playing'): Game {
  return { id: `g${++gameNo}`, court: 1, teamA: teamA as Game['teamA'], teamB: teamB as Game['teamB'], status }
}

function session(players: Player[], games: Game[] = [], title = ''): Session {
  return {
    title,
    play: 'singles',
    format: 'fair',
    courts: 1,
    players,
    line: players.filter((p) => p.status === 'waiting').map((p) => p.id),
    games,
  }
}

/** Singles results for `p1` against `p2`, in order: 'W' a win, 'L' a loss, 'S' skipped, 'C' cancelled. */
function run(results: string, extra: Player[] = []): Session {
  const games = Array.from(results).map((r) => {
    if (r === 'W') return scored(['p1'], ['p2'], 11, 7)
    if (r === 'L') return scored(['p1'], ['p2'], 6, 11)
    return ended(['p1'], ['p2'], r === 'S' ? 'skipped' : 'cancelled')
  })
  return session([player('p1', 'Andrew'), player('p2', 'Maria'), ...extra], games)
}

/** `n` players; player i (1-based) beats every player after them once, so places are 1..n with no ties. */
function ladder(n: number, title = ''): Session {
  const players = Array.from({ length: n }, (_, i) => player(`p${i + 1}`, `Player ${i + 1}`))
  const games: Game[] = []
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) games.push(scored([`p${i}`], [`p${j}`], 11, 5))
  return session(players, games, title)
}

// ---------- sizes ----------

describe('CARD_SIZES (plan gate: story and post)', () => {
  it('story is 1080×1920 and post is 1080×1350', () => {
    expect(CARD_SIZES).toEqual({ story: { width: 1080, height: 1920 }, post: { width: 1080, height: 1350 } })
  })

  it('MAX_CARD_NAME is a whole number of characters a 1080-wide card can carry', () => {
    expect(Number.isInteger(MAX_CARD_NAME)).toBe(true)
    expect(MAX_CARD_NAME).toBeGreaterThanOrEqual(12)
    expect(MAX_CARD_NAME).toBeLessThanOrEqual(40)
  })

  it('MAX_CARD_NAME is 24 (SPEC §2: the name is cut to 24 characters with "…")', () => {
    expect(MAX_CARD_NAME).toBe(24)
  })
})

// ---------- streak maths ----------

describe('bestStreak: the longest run of wins over the player’s scored games, in order', () => {
  it('is 0 for a player with no games', () => {
    expect(bestStreak(session([player('p1'), player('p2')]), 'p1')).toBe(0)
  })

  it('is 0 for a player who only lost', () => {
    expect(bestStreak(run('LLL'), 'p1')).toBe(0)
  })

  it('is 1 for a single win', () => {
    expect(bestStreak(run('W'), 'p1')).toBe(1)
    expect(bestStreak(run('LWL'), 'p1')).toBe(1)
  })

  it('takes the longest run, not the latest or the total: W W L W W W L W → 3', () => {
    expect(bestStreak(run('WWLWWWLW'), 'p1')).toBe(3)
  })

  it('counts a run at the start as well as one at the end', () => {
    expect(bestStreak(run('WWWWLW'), 'p1')).toBe(4)
    expect(bestStreak(run('LWLWWW'), 'p1')).toBe(3)
  })

  it('is the opponent’s streak from the other side of the same games', () => {
    // p2 wins every game p1 loses.
    expect(bestStreak(run('WWLWWWLW'), 'p2')).toBe(1)
    expect(bestStreak(run('LLLWL'), 'p2')).toBe(3)
  })

  it('does not break a run on a skipped game (W S W → 2)', () => {
    expect(bestStreak(run('WSW'), 'p1')).toBe(2)
    expect(bestStreak(run('WSSSWW'), 'p1')).toBe(3)
  })

  it('does not break a run on a cancelled game (W C W → 2)', () => {
    expect(bestStreak(run('WCW'), 'p1')).toBe(2)
    expect(bestStreak(run('WCSCW'), 'p1')).toBe(2)
  })

  it('does not count a skipped or cancelled game as a win', () => {
    expect(bestStreak(run('SSCC'), 'p1')).toBe(0)
    expect(bestStreak(run('WSCL'), 'p1')).toBe(1)
  })

  it('ignores a game still being played', () => {
    const s = run('WW')
    s.games.push(ended(['p1'], ['p2'], 'playing'))
    expect(bestStreak(s, 'p1')).toBe(2)
  })

  it('only looks at the player’s own games: other courts’ games in between don’t break it', () => {
    const s = session([player('p1'), player('p2'), player('p3'), player('p4')], [
      scored(['p1'], ['p2'], 11, 3),
      scored(['p3'], ['p4'], 11, 9),
      scored(['p4'], ['p3'], 11, 9),
      scored(['p2'], ['p1'], 4, 11),
      scored(['p3'], ['p4'], 11, 2),
      scored(['p1'], ['p3'], 11, 8),
    ])
    expect(bestStreak(s, 'p1')).toBe(3)
    expect(bestStreak(s, 'p3')).toBe(1)
  })

  it('counts wins on either side of the net and with a partner in doubles', () => {
    const players = ['a', 'b', 'c', 'd', 'e'].map((id) => player(id))
    const s: Session = {
      ...session(players, [
        scored(['a', 'b'], ['c', 'd'], 11, 6), // a wins (team A)
        scored(['c', 'e'], ['a', 'd'], 9, 11), // a wins (team B)
        scored(['a', 'c'], ['b', 'e'], 11, 10), // a wins
        scored(['b', 'c'], ['a', 'e'], 11, 4), // a loses
      ]),
      play: 'doubles',
    }
    expect(bestStreak(s, 'a')).toBe(3)
    expect(bestStreak(s, 'c')).toBe(2) // L, L, W (with a), W (with b)
    expect(bestStreak(s, 'e')).toBe(0)
  })

  it('is 0 for an unknown player', () => {
    expect(bestStreak(run('WWW'), 'nobody')).toBe(0)
  })
})

// ---------- player card ----------

describe('playerCardData: the player card’s layout data', () => {
  it('carries name, place of N, W–L, games, win %, best streak, signed point difference, title, date and footer', () => {
    const s = { ...run('WWLW', [player('p3', 'Juan')]), title: 'Saturday open play' }
    const data = playerCardData(s, 'p1', { date: NOON_UTC })
    expect(data).toEqual({
      name: 'Andrew',
      place: 1,
      of: 3,
      wins: 3,
      losses: 1,
      games: 4,
      record: `3${EN_DASH}1`,
      winRate: 75,
      streak: 2,
      diff: '+7', // 11+11+6+11 = 39 for, 7+7+11+7 = 32 against
      title: 'Saturday open play',
      date: expect.stringMatching(THU_12_NOV),
      footer: share.footer,
    })
  })

  it('takes place and the field size from the standings (removed players don’t count in “of”)', () => {
    const s = ladder(5)
    s.players.push(player('gone', 'Left early', 'removed'))
    const rows = standings(s)
    for (const r of rows) {
      const data = playerCardData(s, r.playerId, { date: NOON_UTC })!
      expect(data.place, r.name).toBe(r.place)
      expect(data.of, r.name).toBe(5)
    }
    expect(playerCardData(s, 'p5', { date: NOON_UTC })!.place).toBe(5)
  })

  it('gives tied players the same shared place', () => {
    // p1 and p2 each beat p3 once by the same score: equal on wins, rate, difference and points.
    const s = session([player('p1'), player('p2'), player('p3')], [scored(['p1'], ['p3'], 11, 5), scored(['p2'], ['p3'], 11, 5)])
    expect(playerCardData(s, 'p1', { date: NOON_UTC })!.place).toBe(1)
    expect(playerCardData(s, 'p2', { date: NOON_UTC })!.place).toBe(1)
    expect(playerCardData(s, 'p3', { date: NOON_UTC })!.place).toBe(3)
  })

  it('rounds the win rate to a whole percent (2 of 3 → 67, 1 of 3 → 33)', () => {
    expect(playerCardData(run('WWL'), 'p1', { date: NOON_UTC })!.winRate).toBe(67)
    expect(playerCardData(run('WWL'), 'p2', { date: NOON_UTC })!.winRate).toBe(33)
    expect(playerCardData(run('WWW'), 'p1', { date: NOON_UTC })!.winRate).toBe(100)
    expect(playerCardData(run('LLL'), 'p1', { date: NOON_UTC })!.winRate).toBe(0)
  })

  it('uses the minus sign (U+2212) for a negative difference and "0" for none', () => {
    const neg = playerCardData(run('L'), 'p1', { date: NOON_UTC })!
    expect(neg.diff).toBe(`${MINUS}5`)
    expect(neg.diff).not.toContain('-')
    const even = session([player('p1'), player('p2')], [scored(['p1'], ['p2'], 11, 5), scored(['p1'], ['p2'], 5, 11)])
    expect(playerCardData(even, 'p1', { date: NOON_UTC })!.diff).toBe('0')
  })

  it('handles a player with no scored games: 0–0, no win rate, no streak, a difference of 0', () => {
    const s = run('WS', [player('p3', 'Late Arrival')])
    const data = playerCardData(s, 'p3', { date: NOON_UTC })!
    expect(data).not.toBeNull()
    expect(data.name).toBe('Late Arrival')
    expect(data.wins).toBe(0)
    expect(data.losses).toBe(0)
    expect(data.games).toBe(0)
    expect(data.record).toBe(`0${EN_DASH}0`)
    expect(data.winRate).toBeNull()
    expect(data.streak).toBe(0)
    expect(data.diff).toBe('0')
    expect(data.of).toBe(3)
    expect(data.place).toBe(standings(s).find((r) => r.playerId === 'p3')!.place)
  })

  it('treats only skipped games as no scored games', () => {
    const data = playerCardData(run('SS'), 'p1', { date: NOON_UTC })!
    expect(data.games).toBe(0)
    expect(data.winRate).toBeNull()
    expect(data.record).toBe(`0${EN_DASH}0`)
  })

  it('uses the best streak, not the current one', () => {
    expect(playerCardData(run('WWWLW'), 'p1', { date: NOON_UTC })!.streak).toBe(3)
    expect(playerCardData(run('WSWCW'), 'p1', { date: NOON_UTC })!.streak).toBe(3)
  })

  it('returns null for an unknown player', () => {
    expect(playerCardData(run('W'), 'nobody', { date: NOON_UTC })).toBeNull()
  })

  it('returns null for a removed player', () => {
    const s = run('WW', [player('p3', 'Gone', 'removed')])
    expect(playerCardData(s, 'p3', { date: NOON_UTC })).toBeNull()
  })

  describe('no title', () => {
    it('has an empty title when the session has none, not the standings heading', () => {
      const data = playerCardData(run('W'), 'p1', { date: NOON_UTC })!
      expect(data.title).toBe('')
    })

    it('trims the session title', () => {
      const s = { ...run('W'), title: '  Friday night  ' }
      expect(playerCardData(s, 'p1', { date: NOON_UTC })!.title).toBe('Friday night')
    })

    it('treats a blank title as none', () => {
      const s = { ...run('W'), title: '   ' }
      expect(playerCardData(s, 'p1', { date: NOON_UTC })!.title).toBe('')
    })

    it('keeps a full 60-character title whole', () => {
      const title = 'Sunday Open Play (ALL LEVELS) at Claudex Courts, Quezon City'
      expect(title).toHaveLength(60)
      expect(playerCardData({ ...run('W'), title }, 'p1', { date: NOON_UTC })!.title).toBe(title)
    })
  })

  describe('long names cut', () => {
    const named = (name: string) => playerCardData(session([player('p1', name), player('p2')], [scored(['p1'], ['p2'], 11, 3)]), 'p1', { date: NOON_UTC })!

    it('keeps a name of exactly MAX_CARD_NAME characters as typed', () => {
      const name = 'A'.repeat(MAX_CARD_NAME)
      expect(named(name).name).toBe(name)
    })

    it('cuts a name one character over the limit, ending with "…"', () => {
      const name = 'B'.repeat(MAX_CARD_NAME + 1)
      const cut = named(name).name
      expect(cut).not.toBe(name)
      expect(cut.endsWith('…')).toBe(true)
      expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_CARD_NAME)
    })

    it('keeps the start of a long name as typed', () => {
      const name = 'Maria Clara de los Santos Villanueva y Gonzales del Rosario' // 59
      const cut = named(name).name
      expect(cut.endsWith('…')).toBe(true)
      const kept = cut.slice(0, -1)
      expect(name.startsWith(kept.trimEnd())).toBe(true)
      expect(Array.from(kept.trimEnd()).length).toBeGreaterThanOrEqual(MAX_CARD_NAME - 3)
      expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_CARD_NAME)
    })

    it('counts characters, not UTF-16 units, so an emoji or ñ is never split', () => {
      const short = '🏓'.repeat(MAX_CARD_NAME) // MAX characters, twice as many UTF-16 units
      expect(named(short).name).toBe(short)
      const cut = named(`Señor ${'🏓'.repeat(MAX_CARD_NAME)}`).name
      expect(cut.endsWith('…')).toBe(true)
      expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
      expect(Array.from(cut).length).toBeLessThanOrEqual(MAX_CARD_NAME)
    })
  })

  it('formats the date for en-PH as weekday, day, month and year', () => {
    expect(playerCardData(run('W'), 'p1', { date: NOON_UTC })!.date).toMatch(THU_12_NOV)
  })

  it('carries the Paddle Stack link as the footer, and just the link (T8.7c)', () => {
    const data = playerCardData(run('W'), 'p1', { date: NOON_UTC })!
    expect(data.footer).toBe(share.footer)
    expect(data.footer).toBe('plotline.fit/paddle-stack')
    expect(data.footer).toContain('plotline.fit/paddle-stack')
  })

  describe('in Manila (UTC+8)', () => {
    let savedTz: string | undefined
    beforeEach(() => {
      savedTz = process.env.TZ
      process.env.TZ = 'Asia/Manila'
    })
    afterEach(() => {
      if (savedTz === undefined) delete process.env.TZ
      else process.env.TZ = savedTz
    })

    it('dates a 7:30 AM session to that day, though it is still the day before in UTC', () => {
      const morning = new Date('2026-11-11T23:30:00Z')
      expect(playerCardData(run('W'), 'p1', { date: morning })!.date).toMatch(THU_12_NOV)
      expect(groupCardData(run('W'), { date: morning, size: 'post' }).date).toMatch(THU_12_NOV)
    })

    it('dates an 11:30 PM session to that day, not the next', () => {
      const night = new Date('2026-11-12T15:30:00Z')
      expect(playerCardData(run('W'), 'p1', { date: night })!.date).toMatch(THU_12_NOV)
      expect(groupCardData(run('W'), { date: night, size: 'story' }).date).toMatch(THU_12_NOV)
    })
  })
})

// ---------- group card ----------

describe('groupRowsFit', () => {
  it('holds a whole, positive number of rows in each size', () => {
    for (const size of ['story', 'post'] as CardSize[]) {
      expect(Number.isInteger(groupRowsFit(size)), size).toBe(true)
      expect(groupRowsFit(size), size).toBeGreaterThanOrEqual(8)
    }
  })

  it('holds more rows in the taller story than in the post', () => {
    expect(groupRowsFit('story')).toBeGreaterThan(groupRowsFit('post'))
  })

  it('holds 18 rows on a story and 11 on a post (SPEC §2)', () => {
    expect(groupRowsFit('story')).toBe(18)
    expect(groupRowsFit('post')).toBe(11)
  })
})

describe('groupCardData: the group card’s layout data', () => {
  it('maps each standings row to place, name, W–L record and signed difference, in standings order', () => {
    const s = session([player('p1', 'Andrew'), player('p2', 'Maria'), player('p3', 'Juan'), player('p4', 'Jose')], [
      scored(['p1'], ['p4'], 11, 7),
      scored(['p2'], ['p3'], 11, 0),
      scored(['p1'], ['p3'], 11, 9),
    ])
    const data = groupCardData(s, { date: NOON_UTC, size: 'post' })
    expect(data.rows).toEqual(
      standings(s).map((r) => ({
        place: r.place,
        name: r.name,
        record: `${r.wins}${EN_DASH}${r.losses}`,
        diff: r.pointsFor - r.pointsAgainst > 0 ? `+${r.pointsFor - r.pointsAgainst}` : r.pointsFor === r.pointsAgainst ? '0' : `${MINUS}${r.pointsAgainst - r.pointsFor}`,
      })),
    )
    expect(data.rows[0]).toEqual({ place: 1, name: 'Andrew', record: `2${EN_DASH}0`, diff: '+6' })
    expect(data.more).toBe(0)
  })

  it('shows everyone and more = 0 when the players fit', () => {
    for (const size of ['story', 'post'] as CardSize[]) {
      const n = groupRowsFit(size)
      const data = groupCardData(ladder(n), { date: NOON_UTC, size })
      expect(data.rows, size).toHaveLength(n)
      expect(data.more, size).toBe(0)
    }
  })

  it('shows the top rows that fit, then counts the rest in more (plan gate: “+N more”)', () => {
    for (const size of ['story', 'post'] as CardSize[]) {
      const fit = groupRowsFit(size)
      const total = fit + 7
      const data = groupCardData(ladder(total), { date: NOON_UTC, size })
      expect(data.rows.length, size).toBeLessThanOrEqual(fit)
      expect(data.rows.length, size).toBeGreaterThanOrEqual(fit - 1)
      expect(data.rows.length + data.more, size).toBe(total)
      expect(data.more, size).toBeGreaterThan(0)
      // The top of the standings, in order.
      expect(data.rows.map((r) => r.name), size).toEqual(standings(ladder(total)).slice(0, data.rows.length).map((r) => r.name))
    }
  })

  it('gives the last slot to "+N more" when the standings overflow the card, per SPEC §2', () => {
    for (const size of ['story', 'post'] as CardSize[]) {
      const slots = groupRowsFit(size)
      for (const total of [slots + 1, slots + 7]) {
        const data = groupCardData(ladder(total), { date: NOON_UTC, size })
        expect(data.rows, `${size} with ${total}`).toHaveLength(slots - 1)
        expect(data.more, `${size} with ${total}`).toBe(total - (slots - 1))
      }
    }
  })

  it('cuts at a different row for story and post (the size decides what fits)', () => {
    const s = ladder(40)
    const story = groupCardData(s, { date: NOON_UTC, size: 'story' })
    const post = groupCardData(s, { date: NOON_UTC, size: 'post' })
    expect(story.rows.length).toBeGreaterThan(post.rows.length)
    expect(story.more).toBeLessThan(post.more)
    expect(story.rows.length + story.more).toBe(40)
    expect(post.rows.length + post.more).toBe(40)
  })

  it('one player over the fit still adds up: rows + more = everyone', () => {
    const fit = groupRowsFit('post')
    const data = groupCardData(ladder(fit + 1), { date: NOON_UTC, size: 'post' })
    expect(data.more).toBeGreaterThanOrEqual(1)
    expect(data.rows.length + data.more).toBe(fit + 1)
  })

  it('leaves removed players out of the rows and of more', () => {
    const s = ladder(4)
    s.players[1] = { ...s.players[1], status: 'removed' }
    const data = groupCardData(s, { date: NOON_UTC, size: 'post' })
    expect(data.rows.map((r) => r.name)).not.toContain('Player 2')
    expect(data.rows.length + data.more).toBe(3)
  })

  it('lists players with no scored games too (they are in the standings)', () => {
    const s = run('W', [player('p3', 'Late Arrival')])
    const data = groupCardData(s, { date: NOON_UTC, size: 'post' })
    const late = data.rows.find((r) => r.name === 'Late Arrival')
    expect(late).toEqual({ place: expect.any(Number), name: 'Late Arrival', record: `0${EN_DASH}0`, diff: '0' })
  })

  it('cuts long names on the rows the same way as the player card', () => {
    const long = 'Maria Clara de los Santos Villanueva y Gonzales del Rosario'
    const s = session([player('p1', long), player('p2')], [scored(['p1'], ['p2'], 11, 3)])
    const row = groupCardData(s, { date: NOON_UTC, size: 'story' }).rows[0]
    expect(row.name.endsWith('…')).toBe(true)
    expect(Array.from(row.name).length).toBeLessThanOrEqual(MAX_CARD_NAME)
    expect(row.name).toBe(playerCardData(s, 'p1', { date: NOON_UTC })!.name)
  })

  it('uses the trimmed session title, or the default heading when there is none', () => {
    expect(groupCardData({ ...ladder(3), title: '  Saturday open play ' }, { date: NOON_UTC, size: 'post' }).title).toBe('Saturday open play')
    expect(groupCardData(ladder(3), { date: NOON_UTC, size: 'post' }).title).toBe(share.defaultTitle)
    expect(groupCardData({ ...ladder(3), title: '   ' }, { date: NOON_UTC, size: 'post' }).title).toBe(share.defaultTitle)
  })

  it('has no rows and more = 0 for a session with no players', () => {
    const data = groupCardData(session([]), { date: NOON_UTC, size: 'story' })
    expect(data.rows).toEqual([])
    expect(data.more).toBe(0)
  })

  it('carries the date and the footer', () => {
    const data = groupCardData(ladder(3), { date: NOON_UTC, size: 'post' })
    expect(data.date).toMatch(THU_12_NOV)
    expect(data.footer).toBe(share.footer)
  })
})
