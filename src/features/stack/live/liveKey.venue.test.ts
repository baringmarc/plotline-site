// T6.3 Hand-off from a venue: the live key remembers the venue it came from (TASKS.md T6.3), so the board can show
// the venue's name and logo after a reload. Names from the approved plan: `LiveKey` gains an optional
// `venue?: { name: string; logoPath: string | null }`; `loadLiveKey()` keeps a well-formed venue and drops a malformed
// one (the key itself still loads, with venue undefined). Storage can be missing or throw: nothing here throws.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_KEY_STORAGE_KEY, loadLiveKey, saveLiveKey, type LiveKey } from './liveKey'

// Node 25's own (file-less) `localStorage` global shadows jsdom's in this test environment and has no methods,
// so each test gets a fresh in-memory Storage on both `globalThis` and `window`.
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

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const BASE = { code: 'CODE123', secret: 'SECRET456', version: 7 }

describe('live key with a venue (T6.3)', () => {
  it('a key saved with a venue and a logo loads back with both', () => {
    const key: LiveKey = { ...BASE, venue: { name: 'Claudex Courts', logoPath: 'venue-1/logo.webp' } }
    expect(saveLiveKey(key)).toBe(true)
    expect(loadLiveKey()).toEqual(key)
  })

  it('a key saved with a venue that has no logo loads back with logoPath null', () => {
    const key: LiveKey = { ...BASE, venue: { name: 'Claudex Courts', logoPath: null } }
    saveLiveKey(key)
    const loaded = loadLiveKey()
    expect(loaded).toEqual(key)
    expect(loaded!.venue!.logoPath).toBeNull()
  })

  it('a key saved without a venue loads back with venue undefined', () => {
    saveLiveKey(BASE)
    const loaded = loadLiveKey()
    expect(loaded).toEqual(BASE)
    expect(loaded!.venue).toBeUndefined()
  })

  it('a key stored before T6.3 (code, secret, version only) still loads', () => {
    storage.setItem(LIVE_KEY_STORAGE_KEY, JSON.stringify(BASE))
    expect(loadLiveKey()).toEqual(BASE)
    expect(loadLiveKey()!.venue).toBeUndefined()
  })

  it.each([
    ['null', null],
    ['a string', 'Claudex Courts'],
    ['a number', 3],
    ['an array', ['Claudex Courts', null]],
    ['no name', { logoPath: null }],
    ['a numeric name', { name: 5, logoPath: null }],
    ['a numeric logoPath', { name: 'Claudex Courts', logoPath: 9 }],
    ['an object logoPath', { name: 'Claudex Courts', logoPath: { path: 'x' } }],
    ['no logoPath', { name: 'Claudex Courts' }],
  ])('a malformed venue (%s) is dropped and the key still loads', (_label, venue) => {
    storage.setItem(LIVE_KEY_STORAGE_KEY, JSON.stringify({ ...BASE, venue }))
    const loaded = loadLiveKey()
    expect(loaded).not.toBeNull()
    expect(loaded!.code).toBe(BASE.code)
    expect(loaded!.secret).toBe(BASE.secret)
    expect(loaded!.version).toBe(BASE.version)
    expect(loaded!.venue).toBeUndefined()
  })

  it('a malformed key is still null even with a good venue', () => {
    storage.setItem(
      LIVE_KEY_STORAGE_KEY,
      JSON.stringify({ code: 'CODE123', version: 1, venue: { name: 'Claudex Courts', logoPath: null } }),
    )
    expect(loadLiveKey()).toBeNull()
  })
})
