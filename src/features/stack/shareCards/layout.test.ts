// T8.7b Arrange the player card: the layout model (TASKS.md T8.7b). Acceptance: "tests cover the layout model (move,
// resize within limits, items kept on the card, removing and restoring parts inside the player card and whole items,
// the fixed Plotline items untouched), the three looks and the opacity". Do (the user's calls, 2026-11-18, SPEC §6):
// three items (the player card: name, place and four stat tiles as one card; the session title; the date); each part
// of the player card removable on its own, the rest closing up; removing every part removes the card; looks Default
// (2×2 tiles), Compact (one row of four) and List (one row per stat); an opacity for the player card's panel, solid
// to clear; the Plotline logo, wordmark and footer can't be moved, resized or removed.
//
// Contract (the plan's names, `./layout`):
// - `CardLayout` = { items: Record<'player'|'title'|'date', { x, y, scale, removed }>, removedParts, opacity, look };
//   x, y = the top-left of the item's box in card pixels (`CARD_SIZES[size]` space).
// - `SAFE_AREA[size]` = { top, bottom }: **y coordinates** in card pixels; every item's box stays inside the card
//   horizontally (0…width) and between `top` (below the logo and wordmark, which end at y 168) and `bottom` (above the
//   footer's rule at height − 150).
// - `itemRects(layout, size, { hasTitle })` gives the boxes of the items that are drawn; `hitItem` finds the item
//   under a point; `moveItem`/`resizeItem`/`removeItem`/`restoreItem`/`removePart`/`restorePart`/`setOpacity`/
//   `setLook` return a new layout and never mutate; fixed or unknown ids leave the layout unchanged.
// - `setLook(layout, look, size?)`: the plan's two arguments, plus the card size (a layout doesn't carry it), which the
//   positions are re-clamped for (the player card's height changes with the look). Named in the test-writer's report.
import { describe, expect, it } from 'vitest'
import { CARD_SIZES, type CardSize } from './cardData'
import {
  CARD_ITEMS,
  CARD_LOOKS,
  CARD_PARTS,
  DEFAULT_OPACITY,
  FIXED_ITEMS,
  MAX_SCALE,
  MIN_SCALE,
  SAFE_AREA,
  defaultLayout,
  hitItem,
  itemRects,
  moveItem,
  removeItem,
  removePart,
  resizeItem,
  restoreItem,
  restorePart,
  setLook,
  setOpacity,
  type CardItemId,
  type CardLayout,
  type CardLook,
  type CardPartId,
} from './layout'

const SIZES: CardSize[] = ['story', 'post']
const WITH_TITLE = { hasTitle: true }
const ITEMS: CardItemId[] = ['player', 'title', 'date']
const PARTS: CardPartId[] = ['name', 'place', 'record', 'winRate', 'streak', 'diff']
const LOOKS: CardLook[] = ['default', 'compact', 'list']

type Rect = { x: number; y: number; w: number; h: number }

const rectOf = (layout: CardLayout, size: CardSize, id: CardItemId, hasTitle = true): Rect => {
  const r = itemRects(layout, size, { hasTitle })[id]
  if (!r) throw new Error(`${id} has no rect`)
  return r
}

/** The box lies on the card, between the header and the footer. */
function expectInSafeArea(r: Rect, size: CardSize, what: string) {
  const { width } = CARD_SIZES[size]
  const safe = SAFE_AREA[size]
  expect(r.x, `${what} left edge`).toBeGreaterThanOrEqual(-0.5)
  expect(r.x + r.w, `${what} right edge`).toBeLessThanOrEqual(width + 0.5)
  expect(r.y, `${what} top edge`).toBeGreaterThanOrEqual(safe.top - 0.5)
  expect(r.y + r.h, `${what} bottom edge`).toBeLessThanOrEqual(safe.bottom + 0.5)
}

/** A deep copy to check the input was not mutated. */
const snapshot = (l: CardLayout) => JSON.parse(JSON.stringify(l)) as CardLayout

/** All six parts removed, one at a time. */
const withoutParts = (l: CardLayout, parts: CardPartId[]) => parts.reduce((acc, p) => removePart(acc, p), l)

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// ---------- constants ----------

describe('layout constants', () => {
  it('names the three movable items, the six parts of the player card and the three looks', () => {
    expect([...CARD_ITEMS].sort()).toEqual([...ITEMS].sort())
    expect([...CARD_PARTS].sort()).toEqual([...PARTS].sort())
    expect([...CARD_LOOKS].sort()).toEqual([...LOOKS].sort())
  })

  it('keeps the Plotline logo, wordmark and footer out of the movable items', () => {
    expect([...FIXED_ITEMS].sort()).toEqual(['footer', 'logo', 'wordmark'])
    for (const f of FIXED_ITEMS) expect(CARD_ITEMS as readonly string[]).not.toContain(f)
  })

  it('lets an item shrink and grow from its default size (MIN_SCALE < 1 < MAX_SCALE)', () => {
    expect(MIN_SCALE).toBeGreaterThan(0)
    expect(MIN_SCALE).toBeLessThan(1)
    expect(MAX_SCALE).toBeGreaterThan(1)
  })

  it('has a default opacity from 0 to 100', () => {
    expect(DEFAULT_OPACITY).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_OPACITY).toBeLessThanOrEqual(100)
  })

  for (const size of SIZES) {
    it(`puts the ${size} safe area below the logo and wordmark and above the footer`, () => {
      const { height } = CARD_SIZES[size]
      const safe = SAFE_AREA[size]
      expect(safe.top).toBeGreaterThanOrEqual(168)
      expect(safe.bottom).toBeLessThanOrEqual(height - 150)
      expect(safe.bottom).toBeGreaterThan(safe.top)
    })
  }
})

// ---------- the default layout ----------

describe('defaultLayout', () => {
  for (const size of SIZES) {
    it(`shows all three items at their default size on the ${size} card, nothing removed, the Default look`, () => {
      const l = defaultLayout(size)
      for (const id of ITEMS) {
        expect(l.items[id].removed, id).toBe(false)
        expect(l.items[id].scale, id).toBe(1)
      }
      expect(l.removedParts).toEqual([])
      expect(l.look).toBe('default')
      expect(l.opacity).toBe(DEFAULT_OPACITY)
    })

    it(`places every ${size} item inside the safe area, without overlapping another`, () => {
      const l = defaultLayout(size)
      const rects = itemRects(l, size, WITH_TITLE)
      expect(Object.keys(rects).sort()).toEqual([...ITEMS].sort())
      for (const id of ITEMS) expectInSafeArea(rects[id]!, size, id)
      expect(overlap(rects.player!, rects.title!), 'player/title').toBe(false)
      expect(overlap(rects.player!, rects.date!), 'player/date').toBe(false)
      expect(overlap(rects.title!, rects.date!), 'title/date').toBe(false)
    })
  }

  it('returns a fresh layout each time (changing one does not change the next)', () => {
    const a = defaultLayout('story')
    a.items.player.x = 999
    a.removedParts.push('name')
    const b = defaultLayout('story')
    expect(b.items.player.x).not.toBe(999)
    expect(b.removedParts).toEqual([])
  })
})

// ---------- itemRects ----------

describe('itemRects', () => {
  it('puts each box’s top-left at the item’s x and y', () => {
    const l = defaultLayout('story')
    for (const id of ITEMS) {
      const r = rectOf(l, 'story', id)
      expect(r.x, id).toBeCloseTo(l.items[id].x, 5)
      expect(r.y, id).toBeCloseTo(l.items[id].y, 5)
      expect(r.w, id).toBeGreaterThan(0)
      expect(r.h, id).toBeGreaterThan(0)
    }
  })

  it('leaves the title out when the session has no title', () => {
    const rects = itemRects(defaultLayout('story'), 'story', { hasTitle: false })
    expect(rects.title).toBeUndefined()
    expect(rects.player).toBeDefined()
    expect(rects.date).toBeDefined()
  })

  it('leaves out an item that was removed', () => {
    for (const id of ITEMS) {
      const rects = itemRects(removeItem(defaultLayout('post'), id), 'post', WITH_TITLE)
      expect(rects[id], id).toBeUndefined()
      for (const other of ITEMS.filter((o) => o !== id)) expect(rects[other], `${other} stays`).toBeDefined()
    }
  })

  it('has no box for the fixed Plotline items', () => {
    const rects = itemRects(defaultLayout('story'), 'story', WITH_TITLE) as Record<string, unknown>
    for (const f of FIXED_ITEMS) expect(rects[f], f).toBeUndefined()
  })

  for (const size of SIZES) {
    it(`grows and shrinks a ${size} box with its scale`, () => {
      const base = defaultLayout(size)
      const s = (MIN_SCALE + 1) / 2
      for (const id of ITEMS) {
        const a = rectOf(base, size, id)
        const b = rectOf(resizeItem(base, size, id, s), size, id)
        expect(b.w, `${id} width`).toBeCloseTo(a.w * s, 0)
        expect(b.h, `${id} height`).toBeCloseTo(a.h * s, 0)
      }
    })
  }

  it('makes the Compact player card shorter than the Default one (one row of four, not 2×2)', () => {
    for (const size of SIZES) {
      const d = rectOf(defaultLayout(size), size, 'player')
      const c = rectOf(setLook(defaultLayout(size), 'compact'), size, 'player')
      expect(c.h, size).toBeLessThan(d.h)
    }
  })

  it('makes the player card shorter as parts are removed (the rest close up)', () => {
    for (const look of LOOKS) {
      const base = setLook(defaultLayout('story'), look)
      const full = rectOf(base, 'story', 'player').h
      const noName = rectOf(removePart(base, 'name'), 'story', 'player').h
      expect(noName, `${look}: without the name`).toBeLessThan(full)
      const noPlace = rectOf(removePart(base, 'place'), 'story', 'player').h
      expect(noPlace, `${look}: without the place`).toBeLessThan(full)
      const noTiles = rectOf(withoutParts(base, ['record', 'winRate', 'streak', 'diff']), 'story', 'player').h
      expect(noTiles, `${look}: without the four tiles`).toBeLessThan(full)
    }
  })

  it('makes the List look one row per stat: removing one stat shortens it', () => {
    const list = setLook(defaultLayout('story'), 'list')
    const full = rectOf(list, 'story', 'player').h
    for (const p of ['record', 'winRate', 'streak', 'diff'] as CardPartId[]) {
      expect(rectOf(removePart(list, p), 'story', 'player').h, p).toBeLessThan(full)
    }
  })
})

// ---------- hitItem ----------

describe('hitItem', () => {
  const centre = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const

  it('finds the item under a point inside its box', () => {
    for (const size of SIZES) {
      const l = defaultLayout(size)
      for (const id of ITEMS) {
        const [x, y] = centre(rectOf(l, size, id))
        expect(hitItem(l, size, WITH_TITLE, x, y), `${size} ${id}`).toBe(id)
      }
    }
  })

  it('finds nothing over the header, the footer or an empty corner', () => {
    const l = defaultLayout('story')
    const { width, height } = CARD_SIZES.story
    expect(hitItem(l, 'story', WITH_TITLE, 120, 120)).toBeNull()
    expect(hitItem(l, 'story', WITH_TITLE, width / 2, height - 80)).toBeNull()
    expect(hitItem(l, 'story', WITH_TITLE, -10, -10)).toBeNull()
  })

  it('finds no removed item and no title when the session has none', () => {
    const l = defaultLayout('story')
    const [tx, ty] = centre(rectOf(l, 'story', 'title'))
    expect(hitItem(l, 'story', { hasTitle: false }, tx, ty)).not.toBe('title')
    expect(hitItem(removeItem(l, 'title'), 'story', WITH_TITLE, tx, ty)).not.toBe('title')
    const [px, py] = centre(rectOf(l, 'story', 'player'))
    expect(hitItem(removeItem(l, 'player'), 'story', WITH_TITLE, px, py)).not.toBe('player')
  })
})

// ---------- moving ----------

describe('moveItem', () => {
  for (const size of SIZES) {
    it(`moves a ${size} item by dx, dy`, () => {
      const l = defaultLayout(size)
      const moved = moveItem(l, size, 'date', 30, 40)
      expect(moved.items.date.x).toBeCloseTo(l.items.date.x + 30, 5)
      expect(moved.items.date.y).toBeCloseTo(l.items.date.y + 40, 5)
      expect(moved.items.player).toEqual(l.items.player)
      expect(moved.items.title).toEqual(l.items.title)
    })

    it(`keeps every ${size} item on the card, between the header and the footer, however far it is dragged`, () => {
      const { width } = CARD_SIZES[size]
      const safe = SAFE_AREA[size]
      for (const id of ITEMS) {
        const l = defaultLayout(size)
        const farRightDown = rectOf(moveItem(l, size, id, 5000, 5000), size, id)
        expectInSafeArea(farRightDown, size, `${id} dragged right and down`)
        expect(farRightDown.x + farRightDown.w, `${id} stops at the right edge`).toBeCloseTo(width, 0)
        expect(farRightDown.y + farRightDown.h, `${id} stops at the footer`).toBeCloseTo(safe.bottom, 0)
        const farLeftUp = rectOf(moveItem(l, size, id, -5000, -5000), size, id)
        expectInSafeArea(farLeftUp, size, `${id} dragged left and up`)
        expect(farLeftUp.x, `${id} stops at the left edge`).toBeCloseTo(0, 0)
        expect(farLeftUp.y, `${id} stops under the header`).toBeCloseTo(safe.top, 0)
      }
    })
  }

  it('returns a new layout and leaves the one passed in as it was', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    const moved = moveItem(l, 'story', 'player', 10, 10)
    expect(moved).not.toBe(l)
    expect(l).toEqual(before)
  })

  it('leaves the layout unchanged for the logo, wordmark, footer or an unknown id', () => {
    const l = defaultLayout('story')
    for (const id of [...FIXED_ITEMS, 'nope', '']) {
      expect(moveItem(l, 'story', id, 50, 50), id).toEqual(l)
    }
  })
})

// ---------- resizing ----------

describe('resizeItem', () => {
  it('sets the scale inside the limits', () => {
    const l = defaultLayout('post')
    const s = (MIN_SCALE + 1) / 2
    expect(resizeItem(l, 'post', 'date', s).items.date.scale).toBeCloseTo(s, 5)
  })

  it('stops at MIN_SCALE when asked for smaller', () => {
    for (const id of ITEMS) {
      expect(resizeItem(defaultLayout('story'), 'story', id, 0).items[id].scale, id).toBeCloseTo(MIN_SCALE, 5)
      expect(resizeItem(defaultLayout('story'), 'story', id, -3).items[id].scale, id).toBeCloseTo(MIN_SCALE, 5)
    }
  })

  for (const size of SIZES) {
    it(`never goes above MAX_SCALE or past the ${size} safe area`, () => {
      for (const id of ITEMS) {
        const big = resizeItem(defaultLayout(size), size, id, 100)
        expect(big.items[id].scale, id).toBeLessThanOrEqual(MAX_SCALE)
        expect(big.items[id].scale, `${id} still grows`).toBeGreaterThan(1)
        expectInSafeArea(rectOf(big, size, id), size, `${id} at the largest size`)
      }
    })

    it(`moves a ${size} item back inside when growing it near the edge would push it off`, () => {
      for (const id of ITEMS) {
        const atCorner = moveItem(defaultLayout(size), size, id, 5000, 5000)
        const grown = resizeItem(atCorner, size, id, MAX_SCALE)
        expectInSafeArea(rectOf(grown, size, id), size, `${id} grown in the corner`)
      }
    })
  }

  it('returns a new layout without mutating, and ignores fixed or unknown ids', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    expect(resizeItem(l, 'story', 'player', MIN_SCALE)).not.toBe(l)
    expect(l).toEqual(before)
    for (const id of [...FIXED_ITEMS, 'nope']) expect(resizeItem(l, 'story', id, MIN_SCALE), id).toEqual(l)
  })
})

// ---------- removing and restoring whole items ----------

describe('removeItem and restoreItem', () => {
  it('removes the title and the date whole, and brings them back', () => {
    for (const id of ['title', 'date'] as CardItemId[]) {
      const l = defaultLayout('story')
      const gone = removeItem(l, id)
      expect(gone.items[id].removed, id).toBe(true)
      const back = restoreItem(gone, id)
      expect(back.items[id].removed, id).toBe(false)
      expect(back.items[id].x, `${id} keeps its place`).toBe(l.items[id].x)
      expect(back.items[id].y).toBe(l.items[id].y)
    }
  })

  it('removes the player card whole and brings it back with its parts', () => {
    const l = removePart(defaultLayout('post'), 'streak')
    const gone = removeItem(l, 'player')
    expect(gone.items.player.removed).toBe(true)
    const back = restoreItem(gone, 'player')
    expect(back.items.player.removed).toBe(false)
    expect(back.removedParts).toEqual(['streak'])
  })

  it('brings every part back when the player card is restored after all its parts were removed', () => {
    const empty = withoutParts(defaultLayout('story'), PARTS)
    expect(empty.items.player.removed).toBe(true)
    const back = restoreItem(empty, 'player')
    expect(back.items.player.removed).toBe(false)
    expect(back.removedParts).toEqual([])
  })

  it('never mutates and ignores the fixed Plotline items and unknown ids', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    removeItem(l, 'title')
    restoreItem(removeItem(l, 'date'), 'date')
    expect(l).toEqual(before)
    for (const id of [...FIXED_ITEMS, 'nope']) {
      expect(removeItem(l, id), id).toEqual(l)
      expect(restoreItem(l, id), id).toEqual(l)
    }
  })
})

// ---------- parts of the player card ----------

describe('removePart and restorePart', () => {
  it('removes each part of the player card on its own and keeps the card', () => {
    for (const p of PARTS) {
      const l = removePart(defaultLayout('story'), p)
      expect(l.removedParts, p).toEqual([p])
      expect(l.items.player.removed, p).toBe(false)
    }
  })

  it('does not list a part twice', () => {
    const l = removePart(removePart(defaultLayout('story'), 'diff'), 'diff')
    expect(l.removedParts).toEqual(['diff'])
  })

  it('removes the player card when its last part is removed', () => {
    const fiveGone = withoutParts(defaultLayout('story'), PARTS.slice(0, 5))
    expect(fiveGone.items.player.removed).toBe(false)
    const allGone = removePart(fiveGone, PARTS[5])
    expect(allGone.items.player.removed).toBe(true)
    expect(itemRects(allGone, 'story', WITH_TITLE).player).toBeUndefined()
  })

  it('brings a part back', () => {
    const l = withoutParts(defaultLayout('post'), ['name', 'winRate'])
    const back = restorePart(l, 'name')
    expect(back.removedParts).toEqual(['winRate'])
    expect(back.items.player.removed).toBe(false)
  })

  it('brings the player card back with the part restored', () => {
    const empty = withoutParts(defaultLayout('story'), PARTS)
    const back = restorePart(empty, 'place')
    expect(back.items.player.removed).toBe(false)
    expect(back.removedParts).not.toContain('place')
    expect(back.removedParts.sort()).toEqual(PARTS.filter((p) => p !== 'place').sort())
    expect(itemRects(back, 'story', WITH_TITLE).player).toBeDefined()
  })

  it('also brings the player card back when it was removed whole', () => {
    const l = removeItem(removePart(defaultLayout('story'), 'name'), 'player')
    const back = restorePart(l, 'name')
    expect(back.items.player.removed).toBe(false)
    expect(back.removedParts).toEqual([])
  })

  it('never mutates and ignores unknown parts', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    removePart(l, 'name')
    restorePart(removePart(l, 'diff'), 'diff')
    expect(l).toEqual(before)
    expect(removePart(l, 'nope' as CardPartId)).toEqual(l)
    expect(restorePart(removePart(l, 'diff'), 'nope' as CardPartId)).toEqual(removePart(l, 'diff'))
  })

  it('keeps the shrunk player card inside the safe area', () => {
    for (const size of SIZES) {
      const atBottom = moveItem(defaultLayout(size), size, 'player', 0, 5000)
      const fewer = withoutParts(atBottom, ['name', 'record'])
      expectInSafeArea(rectOf(fewer, size, 'player'), size, `${size} with fewer parts`)
      const back = restorePart(restorePart(fewer, 'name'), 'record')
      expectInSafeArea(rectOf(back, size, 'player'), size, `${size} with the parts back`)
    }
  })
})

// ---------- opacity and looks ----------

describe('setOpacity', () => {
  it('sets the player card panel’s opacity from 0 (clear) to 100 (solid)', () => {
    const l = defaultLayout('story')
    expect(setOpacity(l, 0).opacity).toBe(0)
    expect(setOpacity(l, 40).opacity).toBe(40)
    expect(setOpacity(l, 100).opacity).toBe(100)
  })

  it('clamps below 0 and above 100', () => {
    const l = defaultLayout('story')
    expect(setOpacity(l, -20).opacity).toBe(0)
    expect(setOpacity(l, 250).opacity).toBe(100)
  })

  it('changes nothing else and never mutates', () => {
    const l = defaultLayout('post')
    const before = snapshot(l)
    const next = setOpacity(l, 30)
    expect({ ...next, opacity: l.opacity }).toEqual(l)
    expect(l).toEqual(before)
  })
})

describe('setLook', () => {
  it('switches between Default, Compact and List', () => {
    for (const look of LOOKS) expect(setLook(defaultLayout('story'), look).look, look).toBe(look)
  })

  it('ignores an unknown look', () => {
    const l = setLook(defaultLayout('story'), 'compact')
    expect(setLook(l, 'grid' as CardLook)).toEqual(l)
    expect(setLook(l, '' as CardLook)).toEqual(l)
  })

  for (const size of SIZES) {
    it(`keeps the ${size} player card inside the safe area after a change of look`, () => {
      for (const from of LOOKS) {
        for (const to of LOOKS) {
          const atBottom = moveItem(setLook(defaultLayout(size), from), size, 'player', 5000, 5000)
          const grown = resizeItem(atBottom, size, 'player', MAX_SCALE)
          // The layout doesn't know its size, so setLook takes it as a third argument to re-clamp the positions.
          expectInSafeArea(rectOf(setLook(grown, to, size), size, 'player'), size, `${from} → ${to}`)
        }
      }
    })
  }

  it('never mutates', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    setLook(l, 'list')
    expect(l).toEqual(before)
  })
})
