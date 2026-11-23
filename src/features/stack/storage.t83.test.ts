// T8.3 storage: a stack saved before the update (version 1) resumes after it, as doubles with an open queue and
// no title; saves are written as version 2 (SPEC §4 "Saving").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, fillCourts } from './engine'
import { STACK_STORAGE_KEY, loadStack, saveStack } from './storage'

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
})

/** What T5.3–T8.2 wrote to localStorage: `{ ended, session: serialize(session) }` with version 1. */
const V1_SESSION = JSON.stringify({
  version: 1,
  session: {
    format: 'americano',
    courts: 1,
    players: [
      { id: 'p1', name: 'Andrew', status: 'playing' },
      { id: 'p2', name: 'Maria', status: 'playing' },
      { id: 'p3', name: 'Juan', status: 'playing' },
      { id: 'p4', name: 'Jose', status: 'playing' },
      { id: 'p5', name: 'Ana', status: 'waiting' },
    ],
    line: ['p5'],
    games: [{ id: 'g1', court: 1, teamA: ['p1', 'p3'], teamB: ['p2', 'p4'], status: 'playing' }],
  },
})

describe('stack storage across the T8.3 update', () => {
  it('a version 1 save resumes as doubles with an open queue and no title', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: V1_SESSION }))
    const loaded = loadStack()
    expect(loaded).not.toBeNull()
    expect(loaded!.ended).toBe(false)
    expect(loaded!.session.play).toBe('doubles')
    expect(loaded!.session).not.toHaveProperty('teams')
    expect(loaded!.session.players.every((p) => p.partner === undefined)).toBe(true)
    expect(loaded!.session.title).toBe('')
    expect(loaded!.session.format).toBe('americano')
    expect(loaded!.session.players.map((p) => p.name)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose', 'Ana'])
    expect(loaded!.session.games).toHaveLength(1)
  })

  it('an ended version 1 save stays ended', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: true, session: V1_SESSION }))
    expect(loadStack()?.ended).toBe(true)
  })

  it('saveStack writes version 3 (T8.9) with the title and play, no teams, and loads them back', () => {
    const session = fillCourts(
      createSession({ format: 'fair', courts: 1, play: 'singles', title: 'Sunday Open Play', names: ['Andrew', 'Maria', 'Juan'] }),
    )
    expect(saveStack({ session, ended: false })).toBe(true)
    const raw = JSON.parse(localStorage.getItem(STACK_STORAGE_KEY)!) as { session: string }
    expect(JSON.parse(raw.session).version).toBe(3)
    expect(raw.session).not.toContain('"teams"')
    expect(loadStack()).toEqual({ session, ended: false })
  })

  it('saveStack keeps locked pairs (T8.9): they load back locked', () => {
    const session = createSession({ format: 'fair', courts: 1, names: ['Andrew', 'Maria'], pairs: [['Juan', 'Jose']] })
    expect(saveStack({ session, ended: false })).toBe(true)
    const loaded = loadStack()!.session
    expect(loaded).toEqual(session)
    const juan = loaded.players.find((p) => p.name === 'Juan')!
    const jose = loaded.players.find((p) => p.name === 'Jose')!
    expect(juan.partner).toBe(jose.id)
    expect(jose.partner).toBe(juan.id)
  })

  it('a save with an unknown version is refused', () => {
    const session = JSON.parse(V1_SESSION) as { version: number }
    session.version = 4
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: JSON.stringify(session) }))
    expect(loadStack()).toBeNull()
  })
})

/** What T8.3–T8.8 wrote: version 2 with `teams`. Fixed pairs: Andrew & Maria on court against Juan & Jose; Ana & Ben wait. */
const V2_FIXED = JSON.stringify({
  version: 2,
  session: {
    title: 'Friday Pairs',
    play: 'doubles',
    teams: 'fixed',
    format: 'fair',
    courts: 1,
    players: [
      { id: 'p1', name: 'Andrew', status: 'playing', partner: 'p2' },
      { id: 'p2', name: 'Maria', status: 'playing', partner: 'p1' },
      { id: 'p3', name: 'Juan', status: 'playing', partner: 'p4' },
      { id: 'p4', name: 'Jose', status: 'playing', partner: 'p3' },
      { id: 'p5', name: 'Ana', status: 'waiting', partner: 'p6' },
      { id: 'p6', name: 'Ben', status: 'waiting', partner: 'p5' },
    ],
    line: ['p5', 'p6'],
    games: [{ id: 'g1', court: 1, teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], status: 'playing' }],
  },
})

describe('stack storage across the T8.9 update (Teams removed, saves version 3)', () => {
  it('a version 2 fixed-pairs save resumes with its pairs locked and no teams', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: V2_FIXED }))
    const loaded = loadStack()
    expect(loaded).not.toBeNull()
    const s = loaded!.session
    expect(s).not.toHaveProperty('teams')
    expect(s.title).toBe('Friday Pairs')
    expect(s.players.map((p) => [p.name, p.partner])).toEqual([
      ['Andrew', 'p2'],
      ['Maria', 'p1'],
      ['Juan', 'p4'],
      ['Jose', 'p3'],
      ['Ana', 'p6'],
      ['Ben', 'p5'],
    ])
    expect(s.line).toEqual(['p5', 'p6'])
  })

  it('a version 2 open-queue save resumes with no locks and no teams', () => {
    const v2 = JSON.parse(V2_FIXED) as { session: { teams: string; players: Record<string, unknown>[] } }
    v2.session.teams = 'open'
    for (const p of v2.session.players) delete p.partner
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: JSON.stringify(v2) }))
    const s = loadStack()!.session
    expect(s).not.toHaveProperty('teams')
    expect(s.players.every((p) => p.partner === undefined)).toBe(true)
    expect(s.games).toHaveLength(1)
  })

  it('a resumed version 2 save is written back as version 3', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: V2_FIXED }))
    const loaded = loadStack()!
    expect(saveStack(loaded)).toBe(true)
    const raw = JSON.parse(localStorage.getItem(STACK_STORAGE_KEY)!) as { session: string }
    expect(JSON.parse(raw.session).version).toBe(3)
    expect(raw.session).not.toContain('"teams"')
    expect(loadStack()).toEqual(loaded)
  })
})
