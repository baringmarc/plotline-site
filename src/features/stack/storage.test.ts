// T5.3 storage: the session is kept in localStorage after every change; storage failing (private mode)
// must never throw into the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, fillCourts, recordScore, serialize } from './engine'
import { STACK_STORAGE_KEY, clearStack, loadStack, saveStack } from './storage'

const names = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana']

function session() {
  return fillCourts(createSession({ format: 'fair', courts: 1, names }))
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

describe('stack storage (T5.3)', () => {
  it('has a non-empty localStorage key', () => {
    expect(typeof STACK_STORAGE_KEY).toBe('string')
    expect(STACK_STORAGE_KEY.length).toBeGreaterThan(0)
  })

  it('loadStack returns null when nothing is saved', () => {
    expect(loadStack()).toBeNull()
  })

  it('saveStack writes under STACK_STORAGE_KEY and returns true', () => {
    expect(saveStack({ session: session(), ended: false })).toBe(true)
    expect(localStorage.getItem(STACK_STORAGE_KEY)).not.toBeNull()
  })

  it('round trips the session and the ended flag', () => {
    const s = session()
    const scored = recordScore(s, s.games[0].id, 11, 5)
    saveStack({ session: scored, ended: false })
    expect(loadStack()).toEqual({ session: scored, ended: false })
    saveStack({ session: scored, ended: true })
    expect(loadStack()).toEqual({ session: scored, ended: true })
  })

  it('a later save replaces the earlier one', () => {
    const s = session()
    saveStack({ session: s, ended: false })
    const scored = recordScore(s, s.games[0].id, 3, 11)
    saveStack({ session: scored, ended: false })
    expect(loadStack()?.session.games[0].status).toBe('scored')
  })

  it('loadStack returns null for malformed JSON instead of throwing', () => {
    localStorage.setItem(STACK_STORAGE_KEY, '{not json')
    expect(loadStack()).toBeNull()
  })

  it('loadStack returns null for a stored session with an unknown version (refused, not guessed)', () => {
    const bumped = JSON.parse(serialize(session())) as { version: number }
    bumped.version = 999
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: false, session: JSON.stringify(bumped) }))
    expect(loadStack()).toBeNull()
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify(bumped))
    expect(loadStack()).toBeNull()
  })

  it('loadStack returns null for a stored value of the wrong shape', () => {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    expect(loadStack()).toBeNull()
    localStorage.setItem(STACK_STORAGE_KEY, '42')
    expect(loadStack()).toBeNull()
  })

  it('saveStack returns false when storage throws (private mode, quota)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(saveStack({ session: session(), ended: false })).toBe(false)
  })

  it('loadStack returns null when reading storage throws', () => {
    saveStack({ session: session(), ended: false })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(loadStack()).toBeNull()
  })

  it('clearStack removes the saved session', () => {
    saveStack({ session: session(), ended: false })
    clearStack()
    expect(localStorage.getItem(STACK_STORAGE_KEY)).toBeNull()
    expect(loadStack()).toBeNull()
  })

  it('clearStack does not throw when storage throws', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(() => clearStack()).not.toThrow()
  })
})
