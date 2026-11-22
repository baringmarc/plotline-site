// T8.7b Arrange the player card, rearranged by T8.7c: the layout model (TASKS.md T8.7b, T8.7c). T8.7c (the user's
// calls, 2026-11-21, SPEC §6): everything on the player card is inside one card that moves and resizes as a whole:
// the Plotline logo left of the name (no wordmark), the four stat tiles, the session title and the date bottom left,
// and the Paddle Stack link bottom right; the place ("2nd of 14") is gone. The name, each tile, the title and the date
// can be removed on their own and the rest close up; the logo and the link can't, so the card itself is never
// removed. Looks Default (2×2 tiles), Compact (one row of four) and List (one row per stat); an opacity for the
// card's panel, solid to clear.
//
// Contract (`./layout`):
// - `CardLayout` = { items: { player: { x, y, scale } }, removedParts, opacity, look }; x, y = the top-left of the
//   card's box in card pixels (`CARD_SIZES[size]` space).
// - `SAFE_AREA[size]` = { top, bottom }: y coordinates the card stays between (the whole card: nothing is drawn
//   outside the player card any more); it stays inside horizontally (0…width).
// - `itemRects(layout, size, { hasTitle })` gives the card's box (shorter without a title line); `hitItem` finds it
//   under a point; `moveItem`/`resizeItem`/`removePart`/`restorePart`/`setOpacity`/`setLook` return a new layout and
//   never mutate; the fixed parts (logo, link) and unknown ids leave the layout unchanged.
// - `playerHeight`, `statsHeight` and `footHeight` give the card's, the tiles' and the bottom row's heights at scale 1
//   from `PLAYER_METRICS` (drawCard.ts draws from the same numbers).
import { describe, expect, it } from 'vitest'
import { CARD_SIZES, type CardSize } from './cardData'
import {
  CARD_ITEMS,
  CARD_LOOKS,
  CARD_PARTS,
  DEFAULT_OPACITY,
  FIXED_PARTS,
  MAX_SCALE,
  MIN_SCALE,
  PLAYER_METRICS,
  SAFE_AREA,
  defaultLayout,
  footHeight,
  hitItem,
  itemRects,
  moveItem,
  partShown,
  playerHeight,
  removePart,
  resizeItem,
  restorePart,
  setLook,
  setOpacity,
  statsHeight,
  type CardLayout,
  type CardLook,
  type CardPartId,
} from './layout'

const SIZES: CardSize[] = ['story', 'post']
const WITH_TITLE = { hasTitle: true }
const NO_TITLE = { hasTitle: false }
const PARTS: CardPartId[] = ['name', 'record', 'winRate', 'streak', 'diff', 'title', 'date']
const TILES: CardPartId[] = ['record', 'winRate', 'streak', 'diff']
const LOOKS: CardLook[] = ['default', 'compact', 'list']

type Rect = { x: number; y: number; w: number; h: number }

const cardRect = (layout: CardLayout, size: CardSize, hasTitle = true): Rect => itemRects(layout, size, { hasTitle }).player

/** The box lies on the card, inside the safe area. */
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

const withoutParts = (l: CardLayout, parts: CardPartId[]) => parts.reduce((acc, p) => removePart(acc, p), l)

// ---------- constants ----------

describe('layout constants', () => {
  it('names one movable item (the player card), its seven removable parts and the three looks', () => {
    expect([...CARD_ITEMS]).toEqual(['player'])
    expect([...CARD_PARTS].sort()).toEqual([...PARTS].sort())
    expect([...CARD_LOOKS].sort()).toEqual([...LOOKS].sort())
  })

  it('no longer has the place as a part', () => {
    expect(CARD_PARTS as readonly string[]).not.toContain('place')
  })

  it('keeps the logo and the link out of the removable parts and the movable items', () => {
    expect([...FIXED_PARTS].sort()).toEqual(['link', 'logo'])
    for (const f of FIXED_PARTS) {
      expect(CARD_PARTS as readonly string[], f).not.toContain(f)
      expect(CARD_ITEMS as readonly string[], f).not.toContain(f)
    }
  })

  it('lets the card shrink and grow from its default size (MIN_SCALE < 1 < MAX_SCALE)', () => {
    expect(MIN_SCALE).toBeGreaterThan(0)
    expect(MIN_SCALE).toBeLessThan(1)
    expect(MAX_SCALE).toBeGreaterThan(1)
  })

  it('has a default opacity from 0 to 100', () => {
    expect(DEFAULT_OPACITY).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_OPACITY).toBeLessThanOrEqual(100)
  })

  for (const size of SIZES) {
    it(`lets the ${size} card use the whole height (nothing is drawn outside the player card)`, () => {
      const safe = SAFE_AREA[size]
      expect(safe.top).toBe(0)
      expect(safe.bottom).toBe(CARD_SIZES[size].height)
    })

    it(`makes the ${size} logo smaller than the T8.7 header's 88 px tile, and no taller than the name's row`, () => {
      const m = PLAYER_METRICS[size]
      expect(m.logo).toBeLessThan(88)
      expect(m.logo).toBeLessThanOrEqual(m.name)
      expect(m.linkFont, 'the link is smaller than the date').toBeLessThan(m.dateFont)
    })
  }
})

// ---------- the default layout ----------

describe('defaultLayout', () => {
  for (const size of SIZES) {
    it(`shows the ${size} card at its default size, nothing removed, the Default look`, () => {
      const l = defaultLayout(size)
      expect(l.items.player.scale).toBe(1)
      expect(Object.keys(l.items)).toEqual(['player'])
      expect(l.removedParts).toEqual([])
      expect(l.look).toBe('default')
      expect(l.opacity).toBe(DEFAULT_OPACITY)
    })

    it(`places the ${size} card inside the safe area, roughly centred`, () => {
      const r = cardRect(defaultLayout(size), size)
      expectInSafeArea(r, size, 'player')
      const { height } = CARD_SIZES[size]
      expect(Math.abs(r.y + r.h / 2 - height / 2), 'vertically centred').toBeLessThan(40)
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

// ---------- heights ----------

describe('the card’s heights', () => {
  for (const size of SIZES) {
    it(`adds up the ${size} card from its rows: top row, tiles, bottom row, with the gaps and padding`, () => {
      const m = PLAYER_METRICS[size]
      const l = defaultLayout(size)
      const tiles = 2 * m.tile + m.tileGap
      expect(statsHeight(l, size)).toBe(tiles)
      expect(footHeight(l, size, WITH_TITLE)).toBe(m.title + m.date)
      expect(playerHeight(l, size, WITH_TITLE)).toBe(m.pad + m.name + m.gap + tiles + m.gap + m.title + m.date + m.pad)
    })
  }

  it('sizes the tiles for each look and the tiles left', () => {
    const m = PLAYER_METRICS.story
    const l = defaultLayout('story')
    expect(statsHeight(setLook(l, 'compact'), 'story')).toBe(m.compactTile)
    expect(statsHeight(setLook(l, 'list'), 'story')).toBe(4 * m.row + 3 * m.rowGap)
    expect(statsHeight(removePart(l, 'diff'), 'story'), 'three tiles still take two rows').toBe(2 * m.tile + m.tileGap)
    expect(statsHeight(withoutParts(l, ['streak', 'diff']), 'story'), 'two tiles take one row').toBe(m.tile)
    expect(statsHeight(withoutParts(l, TILES), 'story')).toBe(0)
  })

  it('sizes the bottom row from the title and date lines, or the link’s line with neither', () => {
    const m = PLAYER_METRICS.post
    const l = defaultLayout('post')
    expect(footHeight(removePart(l, 'title'), 'post', WITH_TITLE)).toBe(m.date)
    expect(footHeight(removePart(l, 'date'), 'post', WITH_TITLE)).toBe(m.title)
    expect(footHeight(l, 'post', NO_TITLE), 'a session without a title').toBe(m.date)
    expect(footHeight(withoutParts(l, ['title', 'date']), 'post', WITH_TITLE)).toBe(m.link)
  })

  it('uses the logo’s height for the top row when the name is removed', () => {
    const m = PLAYER_METRICS.story
    const l = defaultLayout('story')
    expect(playerHeight(l, 'story') - playerHeight(removePart(l, 'name'), 'story')).toBe(m.name - m.logo)
  })

  it('drops one gap with the tiles', () => {
    const m = PLAYER_METRICS.story
    const l = defaultLayout('story')
    expect(playerHeight(l, 'story') - playerHeight(withoutParts(l, TILES), 'story')).toBe(m.gap + statsHeight(l, 'story'))
  })
})

// ---------- itemRects ----------

describe('itemRects', () => {
  it('puts the box’s top-left at the card’s x and y', () => {
    const l = defaultLayout('story')
    const r = cardRect(l, 'story')
    expect(r.x).toBeCloseTo(l.items.player.x, 5)
    expect(r.y).toBeCloseTo(l.items.player.y, 5)
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })

  it('makes the card shorter for a session without a title (no title line), like a removed title', () => {
    for (const size of SIZES) {
      const l = defaultLayout(size)
      expect(cardRect(l, size, false).h, size).toBeLessThan(cardRect(l, size, true).h)
      expect(cardRect(l, size, false).w, size).toBe(cardRect(l, size, true).w)
      expect(cardRect(l, size, false), size).toEqual(cardRect(removePart(l, 'title'), size, true))
    }
  })

  it('always has the card’s box, whatever is removed', () => {
    const empty = withoutParts(defaultLayout('story'), PARTS)
    const r = cardRect(empty, 'story')
    expect(r).toBeDefined()
    expect(r.h, 'still room for the logo and the link').toBeGreaterThan(0)
  })

  for (const size of SIZES) {
    it(`grows and shrinks the ${size} box with its scale`, () => {
      const base = defaultLayout(size)
      const s = (MIN_SCALE + 1) / 2
      const a = cardRect(base, size)
      const b = cardRect(resizeItem(base, size, 'player', s), size)
      expect(b.w).toBeCloseTo(a.w * s, 0)
      expect(b.h).toBeCloseTo(a.h * s, 0)
    })
  }

  it('makes the Compact card shorter than the Default one (one row of four, not 2×2)', () => {
    for (const size of SIZES) {
      const d = cardRect(defaultLayout(size), size)
      const c = cardRect(setLook(defaultLayout(size), 'compact'), size)
      expect(c.h, size).toBeLessThan(d.h)
    }
  })

  it('makes the card shorter as parts are removed (the rest close up)', () => {
    for (const look of LOOKS) {
      const base = setLook(defaultLayout('story'), look)
      const full = cardRect(base, 'story').h
      for (const p of ['name', 'title', 'date'] as CardPartId[]) {
        expect(cardRect(removePart(base, p), 'story').h, `${look}: without the ${p}`).toBeLessThan(full)
      }
      expect(cardRect(withoutParts(base, TILES), 'story').h, `${look}: without the four tiles`).toBeLessThan(full)
    }
  })

  it('keeps the logo’s row and the link’s row when everything removable is gone', () => {
    for (const size of SIZES) {
      const m = PLAYER_METRICS[size]
      const h = playerHeight(withoutParts(defaultLayout(size), PARTS), size)
      expect(h, size).toBe(2 * m.pad + m.logo + m.gap + m.link)
    }
  })

  it('makes the List look one row per stat: removing one stat shortens it', () => {
    const list = setLook(defaultLayout('story'), 'list')
    const full = cardRect(list, 'story').h
    for (const p of TILES) expect(cardRect(removePart(list, p), 'story').h, p).toBeLessThan(full)
  })
})

// ---------- partShown ----------

describe('partShown', () => {
  it('shows every part by default, and not a removed one', () => {
    const l = defaultLayout('story')
    for (const p of PARTS) expect(partShown(l, p, WITH_TITLE), p).toBe(true)
    for (const p of PARTS) expect(partShown(removePart(l, p), p, WITH_TITLE), p).toBe(false)
  })

  it('never shows the title of a session without one', () => {
    expect(partShown(defaultLayout('story'), 'title', NO_TITLE)).toBe(false)
    expect(partShown(defaultLayout('story'), 'date', NO_TITLE)).toBe(true)
  })
})

// ---------- hitItem ----------

describe('hitItem', () => {
  it('finds the card under a point inside its box', () => {
    for (const size of SIZES) {
      const l = defaultLayout(size)
      const r = cardRect(l, size)
      expect(hitItem(l, size, WITH_TITLE, r.x + r.w / 2, r.y + r.h / 2), size).toBe('player')
      expect(hitItem(l, size, WITH_TITLE, r.x + 2, r.y + 2), `${size} corner`).toBe('player')
    }
  })

  it('finds nothing above or below the card, or off the card', () => {
    const l = defaultLayout('story')
    const r = cardRect(l, 'story')
    expect(hitItem(l, 'story', WITH_TITLE, r.x + 10, r.y - 20)).toBeNull()
    expect(hitItem(l, 'story', WITH_TITLE, r.x + 10, r.y + r.h + 20)).toBeNull()
    expect(hitItem(l, 'story', WITH_TITLE, -10, -10)).toBeNull()
  })

  it('finds nothing in the title line’s room when the session has no title', () => {
    const l = defaultLayout('story')
    const r = cardRect(l, 'story', true)
    expect(hitItem(l, 'story', WITH_TITLE, r.x + 10, r.y + r.h - 5)).toBe('player')
    expect(hitItem(l, 'story', NO_TITLE, r.x + 10, r.y + r.h - 5)).toBeNull()
  })
})

// ---------- moving ----------

describe('moveItem', () => {
  for (const size of SIZES) {
    it(`moves the ${size} card by dx, dy`, () => {
      const l = defaultLayout(size)
      const moved = moveItem(l, size, 'player', 30, 40)
      expect(moved.items.player.x).toBeCloseTo(Math.min(l.items.player.x + 30, CARD_SIZES[size].width - cardRect(l, size).w), 5)
      expect(moved.items.player.y).toBeCloseTo(l.items.player.y + 40, 5)
      expect(moved.items.player.scale).toBe(l.items.player.scale)
    })

    it(`keeps the ${size} card on the card however far it is dragged`, () => {
      const { width, height } = CARD_SIZES[size]
      const l = defaultLayout(size)
      const farRightDown = cardRect(moveItem(l, size, 'player', 5000, 5000), size)
      expectInSafeArea(farRightDown, size, 'dragged right and down')
      expect(farRightDown.x + farRightDown.w, 'stops at the right edge').toBeCloseTo(width, 0)
      expect(farRightDown.y + farRightDown.h, 'stops at the bottom edge').toBeCloseTo(height, 0)
      const farLeftUp = cardRect(moveItem(l, size, 'player', -5000, -5000), size)
      expectInSafeArea(farLeftUp, size, 'dragged left and up')
      expect(farLeftUp.x, 'stops at the left edge').toBeCloseTo(0, 0)
      expect(farLeftUp.y, 'stops at the top edge').toBeCloseTo(0, 0)
    })
  }

  it('moves a smaller card further before it stops', () => {
    const small = resizeItem(defaultLayout('story'), 'story', 'player', MIN_SCALE)
    const r = cardRect(moveItem(small, 'story', 'player', 5000, 0), 'story')
    expect(r.x).toBeCloseTo(CARD_SIZES.story.width - r.w, 0)
    expect(r.x).toBeGreaterThan(cardRect(moveItem(defaultLayout('story'), 'story', 'player', 5000, 0), 'story').x)
  })

  it('returns a new layout and leaves the one passed in as it was', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    const moved = moveItem(l, 'story', 'player', 10, 10)
    expect(moved).not.toBe(l)
    expect(l).toEqual(before)
  })

  it('leaves the layout unchanged for the logo, the link, the old title and date items or an unknown id', () => {
    const l = defaultLayout('story')
    for (const id of [...FIXED_PARTS, 'title', 'date', 'nope', '']) {
      expect(moveItem(l, 'story', id, 50, 50), id).toEqual(l)
    }
  })
})

// ---------- resizing ----------

describe('resizeItem', () => {
  it('sets the scale inside the limits, and keeps the position when it still fits', () => {
    const s = (MIN_SCALE + 1) / 2
    const l = defaultLayout('post')
    const small = resizeItem(l, 'post', 'player', s)
    expect(small.items.player.scale).toBeCloseTo(s, 5)
    expect(small.items.player.x).toBe(l.items.player.x)
    expect(small.items.player.y).toBe(l.items.player.y)
  })

  it('stops at MIN_SCALE when asked for smaller', () => {
    expect(resizeItem(defaultLayout('story'), 'story', 'player', 0).items.player.scale).toBeCloseTo(MIN_SCALE, 5)
    expect(resizeItem(defaultLayout('story'), 'story', 'player', -3).items.player.scale).toBeCloseTo(MIN_SCALE, 5)
  })

  for (const size of SIZES) {
    it(`never goes above MAX_SCALE or past the ${size} card`, () => {
      const big = resizeItem(defaultLayout(size), size, 'player', 100)
      expect(big.items.player.scale).toBeLessThanOrEqual(MAX_SCALE)
      expect(big.items.player.scale, 'still grows').toBeGreaterThan(1)
      expectInSafeArea(cardRect(big, size), size, 'at the largest size')
    })

    it(`moves the ${size} card back inside when growing it near the edge would push it off`, () => {
      const atCorner = moveItem(defaultLayout(size), size, 'player', 5000, 5000)
      const grown = resizeItem(atCorner, size, 'player', MAX_SCALE)
      expectInSafeArea(cardRect(grown, size), size, 'grown in the corner')
    })
  }

  it('returns a new layout without mutating, and ignores fixed or unknown ids', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    expect(resizeItem(l, 'story', 'player', MIN_SCALE)).not.toBe(l)
    expect(l).toEqual(before)
    for (const id of [...FIXED_PARTS, 'nope']) expect(resizeItem(l, 'story', id, MIN_SCALE), id).toEqual(l)
    expect(resizeItem(l, 'story', 'player', Number.NaN)).toEqual(l)
  })
})

// ---------- parts of the player card ----------

describe('removePart and restorePart', () => {
  it('removes each part on its own', () => {
    for (const p of PARTS) expect(removePart(defaultLayout('story'), p).removedParts, p).toEqual([p])
  })

  it('does not list a part twice', () => {
    const l = removePart(removePart(defaultLayout('story'), 'diff'), 'diff')
    expect(l.removedParts).toEqual(['diff'])
  })

  it('keeps the card when every part is removed: the logo and the link stay', () => {
    const empty = withoutParts(defaultLayout('story'), PARTS)
    expect([...empty.removedParts].sort()).toEqual([...PARTS].sort())
    expect(empty.items.player).toEqual(defaultLayout('story').items.player)
    expect(hitItem(empty, 'story', WITH_TITLE, empty.items.player.x + 5, empty.items.player.y + 5)).toBe('player')
  })

  it('cannot remove the logo or the link', () => {
    const l = defaultLayout('story')
    for (const f of FIXED_PARTS) expect(removePart(l, f as unknown as CardPartId), f).toEqual(l)
  })

  it('brings a part back', () => {
    const l = withoutParts(defaultLayout('post'), ['name', 'winRate', 'date'])
    expect(restorePart(l, 'name').removedParts).toEqual(['winRate', 'date'])
    expect(restorePart(l, 'date').removedParts).toEqual(['name', 'winRate'])
  })

  it('changes nothing when the part was not removed', () => {
    const l = removePart(defaultLayout('story'), 'name')
    expect(restorePart(l, 'diff')).toEqual(l)
  })

  it('never mutates and ignores unknown parts', () => {
    const l = defaultLayout('story')
    const before = snapshot(l)
    removePart(l, 'name')
    restorePart(removePart(l, 'diff'), 'diff')
    expect(l).toEqual(before)
    expect(removePart(l, 'nope' as CardPartId)).toEqual(l)
    expect(removePart(l, 'place' as CardPartId)).toEqual(l)
    expect(restorePart(removePart(l, 'diff'), 'nope' as CardPartId)).toEqual(removePart(l, 'diff'))
  })

  it('keeps the card inside the safe area as parts come back', () => {
    for (const size of SIZES) {
      const fewer = withoutParts(defaultLayout(size), ['name', 'record', 'title', 'date'])
      const atBottom = moveItem(fewer, size, 'player', 0, 5000)
      expectInSafeArea(cardRect(atBottom, size), size, `${size} with fewer parts`)
      const back = restorePart(restorePart(restorePart(atBottom, 'name', size), 'record', size), 'title', size)
      expectInSafeArea(cardRect(back, size), size, `${size} with the parts back`)
    }
  })
})

// ---------- opacity and looks ----------

describe('setOpacity', () => {
  it('sets the card panel’s opacity from 0 (clear) to 100 (solid)', () => {
    const l = defaultLayout('story')
    expect(setOpacity(l, 0).opacity).toBe(0)
    expect(setOpacity(l, 40).opacity).toBe(40)
    expect(setOpacity(l, 100).opacity).toBe(100)
  })

  it('clamps below 0 and above 100, rounds, and ignores a non-number', () => {
    const l = defaultLayout('story')
    expect(setOpacity(l, -20).opacity).toBe(0)
    expect(setOpacity(l, 250).opacity).toBe(100)
    expect(setOpacity(l, 33.4).opacity).toBe(33)
    expect(setOpacity(l, Number.NaN)).toEqual(l)
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
    it(`keeps the ${size} card inside the safe area after a change of look`, () => {
      for (const from of LOOKS) {
        for (const to of LOOKS) {
          const atBottom = moveItem(setLook(defaultLayout(size), from), size, 'player', 5000, 5000)
          const grown = resizeItem(atBottom, size, 'player', MAX_SCALE)
          expectInSafeArea(cardRect(setLook(grown, to, size), size), size, `${from} → ${to}`)
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
