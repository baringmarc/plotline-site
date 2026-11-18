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
    expect(loaded!.session.teams).toBe('open')
    expect(loaded!.session.title).toBe('')
    expect(loaded!.session.format).toBe('americano')
    expect(loaded!.session.players.map((p) => p.name)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose', 'Ana'])
    expect(loaded!.session.games).toHaveLength(1)
  })

  it('an ended version 1 save stays ended', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: true, session: V1_SESSION }))
    expect(loadStack()?.ended).toBe(true)
  })

  it('saveStack writes version 2 with the title, play and teams, and loads them back', () => {
    const session = fillCourts(
      createSession({ format: 'fair', courts: 1, play: 'singles', title: 'Sunday Open Play', names: ['Andrew', 'Maria', 'Juan'] }),
    )
    expect(saveStack({ session, ended: false })).toBe(true)
    const raw = JSON.parse(localStorage.getItem(STACK_STORAGE_KEY)!) as { session: string }
    expect(JSON.parse(raw.session).version).toBe(2)
    expect(loadStack()).toEqual({ session, ended: false })
  })

  it('a save with an unknown version is refused', () => {
    const session = JSON.parse(V1_SESSION) as { version: number }
    session.version = 3
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: JSON.stringify(session) }))
    expect(loadStack()).toBeNull()
  })
})
