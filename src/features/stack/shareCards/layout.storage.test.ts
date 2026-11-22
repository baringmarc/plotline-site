// T8.7b Arrange the player card: saving the layout on the device (TASKS.md T8.7b). Do: "The layout (positions,
// sizes, removed parts, opacity, look) is saved on the device per size (story, post) and used for every player's card,
// with a 'Reset layout' button; if storage fails it works for the visit." Acceptance: "saving and loading per size
// (bad or missing data falls back to the default), Reset layout".
//
// Contract (the plan's names, `./layout`): `CARD_LAYOUT_KEY = 'plotline.paddle-stack.card-layout'` holds one JSON
// object keyed by size (`{ story?: CardLayout, post?: CardLayout }`); `loadCardLayout(size)` returns
// `defaultLayout(size)` for missing, unparsable or invalid data and when storage throws; `saveCardLayout(size, layout)`
// returns false when storage throws and keeps the other size's layout; `clearCardLayout(size)` drops that size only and
// never throws. T8.7c: the layout has one item (the player card); a T8.7b layout (three items and a place part) still
// loads: the place is dropped and a removed title or date item becomes a removed part.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_SIZES, type CardSize } from './cardData'
import {
  CARD_LAYOUT_KEY,
  SAFE_AREA,
  clearCardLayout,
  defaultLayout,
  itemRects,
  loadCardLayout,
  moveItem,
  removePart,
  resizeItem,
  saveCardLayout,
  setLook,
  setOpacity,
  type CardLayout,
} from './layout'

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

/** A layout unlike the default in every field. */
function arranged(size: CardSize): CardLayout {
  let l = defaultLayout(size)
  l = moveItem(l, size, 'player', 20, 40)
  l = resizeItem(l, size, 'player', 0.8)
  l = removePart(l, 'date')
  l = removePart(l, 'streak')
  l = setOpacity(l, 35)
  l = setLook(l, 'list')
  return l
}

const stored = () => {
  const raw = localStorage.getItem(CARD_LAYOUT_KEY)
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>)
}

describe('card layout storage (T8.7b)', () => {
  it('uses the key plotline.paddle-stack.card-layout', () => {
    expect(CARD_LAYOUT_KEY).toBe('plotline.paddle-stack.card-layout')
  })

  it('loads the default layout when nothing is saved', () => {
    expect(loadCardLayout('story')).toEqual(defaultLayout('story'))
    expect(loadCardLayout('post')).toEqual(defaultLayout('post'))
  })

  it('saves a layout and loads it back: position, size, removed parts, opacity and look', () => {
    const l = arranged('story')
    expect(saveCardLayout('story', l)).toBe(true)
    const back = loadCardLayout('story')
    expect(back).toEqual(l)
    expect(back.look).toBe('list')
    expect(back.opacity).toBe(35)
    expect(back.removedParts).toEqual(['date', 'streak'])
    expect(back.items.player.scale).toBeCloseTo(0.8, 5)
  })

  it('keeps one JSON object in the key, by size', () => {
    saveCardLayout('story', arranged('story'))
    const data = stored()
    expect(data).not.toBeNull()
    expect(Object.keys(data!)).toEqual(['story'])
    expect(data!.story).toEqual(arranged('story'))
  })

  it('keeps a layout per size: saving one size keeps the other’s', () => {
    const story = arranged('story')
    const post = setLook(defaultLayout('post'), 'compact')
    expect(saveCardLayout('story', story)).toBe(true)
    expect(saveCardLayout('post', post)).toBe(true)
    expect(loadCardLayout('story')).toEqual(story)
    expect(loadCardLayout('post')).toEqual(post)
    expect(Object.keys(stored()!).sort()).toEqual(['post', 'story'])
  })

  it('loads the default for a size that was never saved, even when the other size was', () => {
    saveCardLayout('story', arranged('story'))
    expect(loadCardLayout('post')).toEqual(defaultLayout('post'))
  })

  describe('falls back to the default layout for bad data', () => {
    const bad: [string, string][] = [
      ['unparsable JSON', '{not json'],
      ['a number', '42'],
      ['null', 'null'],
      ['an array', '[]'],
      ['a string for the size', JSON.stringify({ story: 'layout' })],
      ['a layout without items', JSON.stringify({ story: { removedParts: [], opacity: 50, look: 'default' } })],
      [
        'an item whose x is not a number',
        JSON.stringify({ story: { ...defaultLayout('story'), items: { ...defaultLayout('story').items, player: { x: 'left', y: 300, scale: 1, removed: false } } } }),
      ],
      ['the player card missing', JSON.stringify({ story: { ...defaultLayout('story'), items: {} } })],
      ['an unknown look', JSON.stringify({ story: { ...defaultLayout('story'), look: 'grid' } })],
      ['an opacity that is not a number', JSON.stringify({ story: { ...defaultLayout('story'), opacity: 'half' } })],
      ['removedParts that is not a list', JSON.stringify({ story: { ...defaultLayout('story'), removedParts: 'name' } })],
      ['an unknown part', JSON.stringify({ story: { ...defaultLayout('story'), removedParts: ['shoes'] } })],
    ]
    for (const [what, raw] of bad) {
      it(what, () => {
        localStorage.setItem(CARD_LAYOUT_KEY, raw)
        expect(loadCardLayout('story')).toEqual(defaultLayout('story'))
      })
    }
  })

  it('never loads the card off the card', () => {
    const l = defaultLayout('post')
    for (const [x, y] of [
      [5000, -5000],
      [-5000, 99999],
    ]) {
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify({ post: { ...l, items: { player: { ...l.items.player, x, y } } } }))
      const r = itemRects(loadCardLayout('post'), 'post', { hasTitle: true }).player
      const { width } = CARD_SIZES.post
      expect(r.x, `${x},${y}`).toBeGreaterThanOrEqual(-0.5)
      expect(r.x + r.w, `${x},${y}`).toBeLessThanOrEqual(width + 0.5)
      expect(r.y, `${x},${y}`).toBeGreaterThanOrEqual(SAFE_AREA.post.top - 0.5)
      expect(r.y + r.h, `${x},${y}`).toBeLessThanOrEqual(SAFE_AREA.post.bottom + 0.5)
    }
  })

  it('loads a layout saved before T8.7c: the place dropped, a removed title or date item now a removed part', () => {
    const old = {
      items: {
        player: { x: 80, y: 600, scale: 0.9, removed: false },
        title: { x: 80, y: 230, scale: 1, removed: true },
        date: { x: 80, y: 300, scale: 1, removed: false },
      },
      removedParts: ['place', 'streak'],
      opacity: 60,
      look: 'compact',
    }
    localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify({ story: old }))
    const back = loadCardLayout('story')
    expect(back.items).toEqual({ player: { x: 80, y: 600, scale: 0.9 } })
    expect(back.removedParts).toEqual(['streak', 'title'])
    expect(back.opacity).toBe(60)
    expect(back.look).toBe('compact')
  })

  it('loads the default when reading storage throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(() => loadCardLayout('story')).not.toThrow()
    expect(loadCardLayout('story')).toEqual(defaultLayout('story'))
  })

  it('returns false from save when storage throws (private mode, quota)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => saveCardLayout('story', arranged('story'))).not.toThrow()
    expect(saveCardLayout('story', arranged('story'))).toBe(false)
  })

  it('still saves over unparsable data, and keeps a good layout of the other size', () => {
    localStorage.setItem(CARD_LAYOUT_KEY, '{not json')
    expect(saveCardLayout('post', arranged('post'))).toBe(true)
    expect(loadCardLayout('post')).toEqual(arranged('post'))
  })

  it('Reset: clearCardLayout drops that size’s layout, so it loads the default again', () => {
    saveCardLayout('story', arranged('story'))
    saveCardLayout('post', arranged('post'))
    clearCardLayout('story')
    expect(loadCardLayout('story')).toEqual(defaultLayout('story'))
    expect(loadCardLayout('post')).toEqual(arranged('post'))
    expect(stored()?.story).toBeUndefined()
  })

  it('clearCardLayout does not throw when storage throws', () => {
    saveCardLayout('story', arranged('story'))
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(localStorage, method).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    expect(() => clearCardLayout('story')).not.toThrow()
  })

  it('keeps the saved layout when saving fails (the visit goes on with it in memory)', () => {
    const first = arranged('story')
    saveCardLayout('story', first)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(saveCardLayout('story', setLook(first, 'compact'))).toBe(false)
    vi.restoreAllMocks()
    expect(loadCardLayout('story')).toEqual(first)
  })
})
