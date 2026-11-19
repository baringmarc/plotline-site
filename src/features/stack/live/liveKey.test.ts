// T6.2 Organizer goes live: the live key (code, secret, last published version) stays in this browser's
// localStorage with the session (TASKS.md T6.2; court-booking-system docs/PLATFORM.md §4 "Live stacks": the secret
// stays on the organizer's device). Names from the approved plan: `LIVE_KEY_STORAGE_KEY`, `LiveKey`,
// `loadLiveKey()`, `saveLiveKey(key)`, `clearLiveKey()`. Storage can be missing or throw: nothing here throws.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STACK_STORAGE_KEY } from '../storage'
import { LIVE_KEY_STORAGE_KEY, clearLiveKey, loadLiveKey, saveLiveKey, type LiveKey } from './liveKey'

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

const KEY: LiveKey = { code: 'abcDEF123_-xyz', secret: 's3cr3t-value', version: 0 }

describe('live key storage (T6.2)', () => {
  it('uses the localStorage key plotline.paddle-stack.live, apart from the session', () => {
    expect(LIVE_KEY_STORAGE_KEY).toBe('plotline.paddle-stack.live')
    expect(LIVE_KEY_STORAGE_KEY).not.toBe(STACK_STORAGE_KEY)
  })

  it('loadLiveKey returns null when nothing is saved', () => {
    expect(loadLiveKey()).toBeNull()
  })

  it('saveLiveKey writes under LIVE_KEY_STORAGE_KEY and returns true', () => {
    expect(saveLiveKey(KEY)).toBe(true)
    expect(storage.getItem(LIVE_KEY_STORAGE_KEY)).not.toBeNull()
  })

  it('a saved key loads back with its code, secret and version', () => {
    saveLiveKey(KEY)
    expect(loadLiveKey()).toEqual(KEY)
    saveLiveKey({ ...KEY, version: 41 })
    expect(loadLiveKey()).toEqual({ ...KEY, version: 41 })
  })

  it('saving the key leaves the saved session alone', () => {
    storage.setItem(STACK_STORAGE_KEY, 'the session')
    saveLiveKey(KEY)
    expect(storage.getItem(STACK_STORAGE_KEY)).toBe('the session')
  })

  it.each([
    ['not JSON', '{not json'],
    ['JSON null', 'null'],
    ['an array', '[]'],
    ['a string', '"abc"'],
    ['no version', JSON.stringify({ code: 'c', secret: 's' })],
    ['no secret', JSON.stringify({ code: 'c', version: 0 })],
    ['no code', JSON.stringify({ secret: 's', version: 0 })],
    ['a numeric code', JSON.stringify({ code: 1, secret: 's', version: 0 })],
    ['a numeric secret', JSON.stringify({ code: 'c', secret: 2, version: 0 })],
    ['a string version', JSON.stringify({ code: 'c', secret: 's', version: '1' })],
  ])('loadLiveKey returns null for a malformed value (%s)', (_label, raw) => {
    storage.setItem(LIVE_KEY_STORAGE_KEY, raw)
    expect(loadLiveKey()).toBeNull()
  })

  it('loadLiveKey returns null when storage throws', () => {
    saveLiveKey(KEY)
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => loadLiveKey()).not.toThrow()
    expect(loadLiveKey()).toBeNull()
  })

  it('saveLiveKey returns false when storage throws (private mode, quota)', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveLiveKey(KEY)).not.toThrow()
    expect(saveLiveKey(KEY)).toBe(false)
  })

  it('clearLiveKey removes the saved key', () => {
    saveLiveKey(KEY)
    clearLiveKey()
    expect(storage.getItem(LIVE_KEY_STORAGE_KEY)).toBeNull()
    expect(loadLiveKey()).toBeNull()
  })

  it('clearLiveKey never throws, even when storage does', () => {
    vi.spyOn(storage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => clearLiveKey()).not.toThrow()
  })
})
