// T8.7b Arrange the player card: the dialog's controls (TASKS.md T8.7b). Do: "Tap an item to select it (outline and a
// ✕), drag it to move it, and a Size slider under the preview grows or shrinks it. Inside the player card each part …
// can be removed on its own …; the title and date are removed whole. Removed parts and items can be brought back.
// Opacity: a slider for the player card's background panel … Looks …: Default, Compact and List. … saved on the
// device per size (story, post) …, with a 'Reset layout' button; if storage fails it works for the visit. The group
// card stays a fixed leaderboard. Works with touch and a mouse; the shared PNG matches the preview." Acceptance:
// "… Reset layout, and the dialog's controls".
//
// Contract (the plan's names; ShareCardDialog.tsx with ./drawCard mocked, ./layout real):
// - player card only: an overlay over the preview with a button per drawn item, named
//   `share.layout.select(share.layout.items[id])`, `aria-pressed` true when selected; pointerdown → pointermove →
//   pointerup on it moves the item (mouse or touch); arrow keys move the selected item;
// - the selected item shows a button `share.layout.remove(label)`; with the player card selected, one button per part
//   present, `share.layout.remove(share.layout.parts[part])`;
// - a slider `share.layout.itemSize` for the selected item's scale (min MIN_SCALE, max MAX_SCALE, value = the scale);
// - a slider `share.layout.opacity` (0–100, starts at DEFAULT_OPACITY);
// - a radio group `share.layout.lookLabel` with radios `share.layout.looks[look]`;
// - a group `share.layout.removedLabel` with `share.layout.restore(label)` buttons for each removed item and part;
// - a button `share.layout.reset`: back to `defaultLayout(size)`, the saved one cleared;
// - the layout loads with `loadCardLayout(size)` on open and on a size change, saves with `saveCardLayout` after each
//   change, and every `drawPlayerCard` call (preview and share) gets it as `opts.layout`.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore } from '../engine'
import { shareOrDownload } from '../shareImage'
import type { Session } from '../types'
import { drawGroupCard, drawPlayerCard } from './drawCard'
import {
  CARD_LAYOUT_KEY,
  DEFAULT_OPACITY,
  MAX_SCALE,
  MIN_SCALE,
  defaultLayout,
  loadCardLayout,
  saveCardLayout,
  setLook,
  setOpacity,
  type CardItemId,
  type CardLayout,
  type CardPartId,
} from './layout'
import { ShareCardDialog } from './ShareCardDialog'

const mocks = vi.hoisted(() => ({
  blob: new Blob(['png'], { type: 'image/png' }),
}))

vi.mock('./drawCard', () => ({
  drawPlayerCard: vi.fn(() => Promise.resolve(mocks.blob)),
  drawGroupCard: vi.fn(() => Promise.resolve(mocks.blob)),
}))

vi.mock('../shareImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shareImage')>()
  return { ...actual, shareOrDownload: vi.fn(() => Promise.resolve('shared' as const)) }
})

const { share } = paddleStack
const L = share.layout

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

function played(title = 'Saturday open play'): Session {
  let s = fillCourts(createSession({ format: 'fair', courts: 1, names: ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben'], title }))
  for (const [a, b] of [
    [11, 5],
    [7, 11],
  ]) {
    const g = s.games.find((x) => x.status === 'playing')!
    s = fillCourts(recordScore(s, g.id, a, b))
  }
  return s
}

const idOf = (s: Session, name: string) => s.players.find((p) => p.name === name)!.id
const dialog = () => screen.getByRole('dialog', { name: share.dialogTitle })
const lastLayout = (): CardLayout | undefined => {
  const calls = vi.mocked(drawPlayerCard).mock.calls
  return calls.length ? (calls[calls.length - 1][1] as { layout?: CardLayout }).layout : undefined
}
const itemButton = (id: CardItemId) => within(dialog()).getByRole('button', { name: L.select(L.items[id]) })
const queryItemButton = (id: CardItemId) => within(dialog()).queryByRole('button', { name: L.select(L.items[id]) })
const removedGroup = () => within(dialog()).getByRole('group', { name: L.removedLabel })
const PARTS: CardPartId[] = ['name', 'place', 'record', 'winRate', 'streak', 'diff']

async function openPlayer(s = played()) {
  const user = userEvent.setup()
  render(<ShareCardDialog session={s} playerId={idOf(s, 'Andrew')} onClose={() => {}} />)
  await waitFor(() => expect(lastLayout()).toBeDefined())
  return user
}

/** Waits until the preview has been drawn with a layout that passes `check`. */
const drawnWith = (check: (l: CardLayout) => void) => waitFor(() => check(lastLayout()!))

async function select(user: ReturnType<typeof userEvent.setup>, id: CardItemId) {
  const btn = itemButton(id)
  if (btn.getAttribute('aria-pressed') !== 'true') await user.click(btn)
  await waitFor(() => expect(itemButton(id)).toHaveAttribute('aria-pressed', 'true'))
}

const BOX_KEYS = ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight'] as const
const saved: Partial<Record<(typeof BOX_KEYS)[number], PropertyDescriptor>> = {}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://localhost/card'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  // jsdom lays nothing out: give every box the story preview's on-screen size (half the card), and pointer capture.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ x: 0, y: 0, left: 0, top: 0, width: 540, height: 960, right: 540, bottom: 960, toJSON: () => ({}) }) as DOMRect,
  )
  for (const k of BOX_KEYS) saved[k] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)
  for (const [k, v] of [
    ['clientWidth', 540],
    ['clientHeight', 960],
    ['offsetWidth', 540],
    ['offsetHeight', 960],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v })
  }
  for (const k of ['setPointerCapture', 'releasePointerCapture'] as const) {
    Object.defineProperty(Element.prototype, k, { configurable: true, writable: true, value: vi.fn() })
  }
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { configurable: true, writable: true, value: vi.fn(() => false) })
  vi.mocked(drawPlayerCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(drawGroupCard).mockImplementation(() => Promise.resolve(mocks.blob))
  vi.mocked(shareOrDownload).mockImplementation(() => Promise.resolve('shared'))
})
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const k of BOX_KEYS) {
    const d = saved[k]
    if (d) Object.defineProperty(HTMLElement.prototype, k, d)
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k]
  }
})

// ---------- copy ----------

describe('layout copy (config)', () => {
  it('has the hint, slider, look, item, part and button labels as strings', () => {
    for (const k of ['hint', 'itemSize', 'opacity', 'lookLabel', 'removedLabel', 'reset'] as const) {
      expect(typeof L[k], k).toBe('string')
      expect((L[k] as string).length, k).toBeGreaterThan(0)
    }
    for (const look of ['default', 'compact', 'list'] as const) expect(L.looks[look].length, look).toBeGreaterThan(0)
    for (const id of ['player', 'title', 'date'] as const) expect(L.items[id].length, id).toBeGreaterThan(0)
    for (const p of PARTS) expect(L.parts[p].length, p).toBeGreaterThan(0)
    expect(new Set(Object.values(L.looks)).size).toBe(3)
    expect(new Set(Object.values(L.parts)).size).toBe(6)
  })

  it('names the select, remove and restore buttons after the item', () => {
    for (const fn of [L.select, L.remove, L.restore]) {
      expect(fn('Date')).toContain('Date')
      expect(fn('Date')).not.toBe(fn('Title'))
    }
    expect(L.select('Date')).not.toBe(L.remove('Date'))
    expect(L.remove('Date')).not.toBe(L.restore('Date'))
  })
})

// ---------- what shows ----------

describe('ShareCardDialog: arranging the player card (T8.7b)', () => {
  it('draws the preview with the default layout for the size, and shows the hint', async () => {
    await openPlayer()
    expect(lastLayout()).toEqual(defaultLayout('story'))
    expect(within(dialog()).getByText(L.hint)).toBeInTheDocument()
  })

  it('shows a button for each drawn item: the player card, the title and the date', async () => {
    await openPlayer()
    for (const id of ['player', 'title', 'date'] as CardItemId[]) {
      expect(itemButton(id), id).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('shows no title button when the session has no title', async () => {
    await openPlayer(played(''))
    expect(queryItemButton('title')).toBeNull()
    expect(itemButton('player')).toBeInTheDocument()
    expect(itemButton('date')).toBeInTheDocument()
  })

  it('selects an item when tapped (one at a time) and shows its ✕', async () => {
    const user = await openPlayer()
    expect(within(dialog()).queryByRole('button', { name: L.remove(L.items.date) })).toBeNull()
    await user.click(itemButton('date'))
    expect(itemButton('date')).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog()).getByRole('button', { name: L.remove(L.items.date) })).toBeInTheDocument()
    await user.click(itemButton('title'))
    expect(itemButton('title')).toHaveAttribute('aria-pressed', 'true')
    expect(itemButton('date')).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog()).getByRole('button', { name: L.remove(L.items.title) })).toBeInTheDocument()
  })

  for (const pointerType of ['mouse', 'touch']) {
    it(`moves an item dragged with ${pointerType === 'mouse' ? 'a mouse' : 'a finger'} (pointer events)`, async () => {
      const user = await openPlayer()
      const before = lastLayout()!.items.date
      await select(user, 'date')
      const btn = itemButton('date')
      const common = { pointerId: 7, pointerType, isPrimary: true, button: 0 }
      fireEvent.pointerDown(btn, { ...common, buttons: 1, clientX: 100, clientY: 100 })
      fireEvent.pointerMove(btn, { ...common, buttons: 1, clientX: 120, clientY: 130 })
      fireEvent.pointerMove(btn, { ...common, buttons: 1, clientX: 140, clientY: 160 })
      fireEvent.pointerUp(btn, { ...common, buttons: 0, clientX: 140, clientY: 160 })
      await drawnWith((l) => {
        expect(l.items.date.x).toBeGreaterThan(before.x)
        expect(l.items.date.y).toBeGreaterThan(before.y)
      })
      expect(lastLayout()!.items.player).toEqual(defaultLayout('story').items.player)
    })
  }

  it('moves the selected item with the arrow keys', async () => {
    const user = await openPlayer()
    const start = lastLayout()!.items.date
    await select(user, 'date')
    itemButton('date').focus()
    await user.keyboard('{ArrowRight}{ArrowDown}')
    await drawnWith((l) => {
      expect(l.items.date.x).toBeGreaterThan(start.x)
      expect(l.items.date.y).toBeGreaterThan(start.y)
    })
    const moved = lastLayout()!.items.date
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    await drawnWith((l) => {
      expect(l.items.date.x).toBeLessThan(moved.x)
      expect(l.items.date.y).toBeLessThan(moved.y)
    })
  })

  it('resizes the selected item with the Size slider', async () => {
    const user = await openPlayer()
    await select(user, 'title')
    const slider = within(dialog()).getByRole('slider', { name: L.itemSize })
    expect(Number(slider.getAttribute('min'))).toBeCloseTo(MIN_SCALE, 5)
    expect(Number(slider.getAttribute('max'))).toBeCloseTo(MAX_SCALE, 5)
    expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(1, 5)
    const target = Math.round(((MIN_SCALE + 1) / 2) * 100) / 100
    fireEvent.change(slider, { target: { value: String(target) } })
    await drawnWith((l) => expect(l.items.title.scale).toBeCloseTo(target, 2))
    expect(lastLayout()!.items.date.scale).toBe(1)
  })

  it('removes the title with its ✕ and brings it back from Removed', async () => {
    const user = await openPlayer()
    await select(user, 'title')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.items.title) }))
    await drawnWith((l) => expect(l.items.title.removed).toBe(true))
    expect(queryItemButton('title')).toBeNull()
    await user.click(within(removedGroup()).getByRole('button', { name: L.restore(L.items.title) }))
    await drawnWith((l) => expect(l.items.title.removed).toBe(false))
    expect(itemButton('title')).toBeInTheDocument()
  })

  it('removes the date with its ✕ and brings it back', async () => {
    const user = await openPlayer()
    await select(user, 'date')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.items.date) }))
    await drawnWith((l) => expect(l.items.date.removed).toBe(true))
    await user.click(within(removedGroup()).getByRole('button', { name: L.restore(L.items.date) }))
    await drawnWith((l) => expect(l.items.date.removed).toBe(false))
  })

  it('shows a ✕ for each part of the selected player card', async () => {
    const user = await openPlayer()
    await select(user, 'player')
    for (const p of PARTS) expect(within(dialog()).getByRole('button', { name: L.remove(L.parts[p]) }), p).toBeInTheDocument()
    await user.click(itemButton('date'))
    expect(within(dialog()).queryByRole('button', { name: L.remove(L.parts.name) })).toBeNull()
  })

  it('removes one part of the player card and brings it back', async () => {
    const user = await openPlayer()
    await select(user, 'player')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.parts.winRate) }))
    await drawnWith((l) => expect(l.removedParts).toEqual(['winRate']))
    expect(lastLayout()!.items.player.removed).toBe(false)
    expect(within(dialog()).queryByRole('button', { name: L.remove(L.parts.winRate) })).toBeNull()
    await user.click(within(removedGroup()).getByRole('button', { name: L.restore(L.parts.winRate) }))
    await drawnWith((l) => expect(l.removedParts).toEqual([]))
  })

  it('removes the player card when every part is removed, and restoring it brings all the parts back', async () => {
    const user = await openPlayer()
    for (const p of PARTS) {
      await select(user, 'player')
      await user.click(within(dialog()).getByRole('button', { name: L.remove(L.parts[p]) }))
    }
    await drawnWith((l) => expect(l.items.player.removed).toBe(true))
    expect(queryItemButton('player')).toBeNull()
    await user.click(within(removedGroup()).getByRole('button', { name: L.restore(L.items.player) }))
    await drawnWith((l) => {
      expect(l.items.player.removed).toBe(false)
      expect(l.removedParts).toEqual([])
    })
    expect(itemButton('player')).toBeInTheDocument()
  })

  it('removes the whole player card with its ✕', async () => {
    const user = await openPlayer()
    await select(user, 'player')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.items.player) }))
    await drawnWith((l) => expect(l.items.player.removed).toBe(true))
    expect(within(removedGroup()).getByRole('button', { name: L.restore(L.items.player) })).toBeInTheDocument()
  })

  it('sets the panel’s opacity with its slider', async () => {
    await openPlayer()
    const slider = within(dialog()).getByRole('slider', { name: L.opacity })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '100')
    expect(Number((slider as HTMLInputElement).value)).toBe(DEFAULT_OPACITY)
    const target = DEFAULT_OPACITY === 30 ? 60 : 30
    fireEvent.change(slider, { target: { value: String(target) } })
    await drawnWith((l) => expect(l.opacity).toBe(target))
  })

  it('offers the three looks, Default first, and redraws with the one picked', async () => {
    const user = await openPlayer()
    const looks = within(dialog()).getByRole('radiogroup', { name: L.lookLabel })
    expect(within(looks).getByRole('radio', { name: L.looks.default })).toBeChecked()
    expect(within(looks).getByRole('radio', { name: L.looks.compact })).not.toBeChecked()
    await user.click(within(looks).getByRole('radio', { name: L.looks.compact }))
    await drawnWith((l) => expect(l.look).toBe('compact'))
    await user.click(within(looks).getByRole('radio', { name: L.looks.list }))
    await drawnWith((l) => expect(l.look).toBe('list'))
    expect(within(looks).getByRole('radio', { name: L.looks.list })).toBeChecked()
  })
})

// ---------- saving, loading, reset ----------

describe('ShareCardDialog: the saved layout', () => {
  it('opens with the layout saved for the size', async () => {
    const saved = setOpacity(setLook(defaultLayout('story'), 'list'), 20)
    saveCardLayout('story', saved)
    await openPlayer()
    await drawnWith((l) => expect(l).toEqual(saved))
    expect(within(dialog()).getByRole('radio', { name: L.looks.list })).toBeChecked()
    expect(Number((within(dialog()).getByRole('slider', { name: L.opacity }) as HTMLInputElement).value)).toBe(20)
  })

  it('switches to the post size’s own layout when post is picked', async () => {
    saveCardLayout('story', setLook(defaultLayout('story'), 'list'))
    const post = setLook(defaultLayout('post'), 'compact')
    saveCardLayout('post', post)
    const user = await openPlayer()
    await user.click(within(dialog()).getByRole('radio', { name: share.sizes.post }))
    await waitFor(() => {
      const calls = vi.mocked(drawPlayerCard).mock.calls
      const [, opts] = calls[calls.length - 1]
      expect(opts.size).toBe('post')
      expect((opts as { layout?: CardLayout }).layout).toEqual(post)
    })
  })

  it('uses the default post layout when only the story one was saved', async () => {
    saveCardLayout('story', setLook(defaultLayout('story'), 'list'))
    const user = await openPlayer()
    await user.click(within(dialog()).getByRole('radio', { name: share.sizes.post }))
    await waitFor(() => expect(vi.mocked(drawPlayerCard).mock.calls.at(-1)![1].size).toBe('post'))
    await drawnWith((l) => expect(l).toEqual(defaultLayout('post')))
  })

  it('saves the layout after each change, for that size only', async () => {
    const user = await openPlayer()
    await user.click(within(dialog()).getByRole('radio', { name: L.looks.list }))
    await waitFor(() => expect(loadCardLayout('story').look).toBe('list'))
    fireEvent.change(within(dialog()).getByRole('slider', { name: L.opacity }), { target: { value: '25' } })
    await waitFor(() => expect(loadCardLayout('story').opacity).toBe(25))
    await select(user, 'date')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.items.date) }))
    await waitFor(() => expect(loadCardLayout('story').items.date.removed).toBe(true))
    expect(loadCardLayout('post')).toEqual(defaultLayout('post'))
    expect(localStorage.getItem(CARD_LAYOUT_KEY)).not.toBeNull()
  })

  it('Reset layout goes back to the default and clears the saved one', async () => {
    saveCardLayout('story', setLook(defaultLayout('story'), 'list'))
    saveCardLayout('post', setLook(defaultLayout('post'), 'compact'))
    const user = await openPlayer()
    await drawnWith((l) => expect(l.look).toBe('list'))
    fireEvent.change(within(dialog()).getByRole('slider', { name: L.opacity }), { target: { value: '10' } })
    await drawnWith((l) => expect(l.opacity).toBe(10))
    await user.click(within(dialog()).getByRole('button', { name: L.reset }))
    await drawnWith((l) => expect(l).toEqual(defaultLayout('story')))
    expect(loadCardLayout('story')).toEqual(defaultLayout('story'))
    expect(loadCardLayout('post')).toEqual(setLook(defaultLayout('post'), 'compact'))
    expect(within(dialog()).getByRole('radio', { name: L.looks.default })).toBeChecked()
  })

  it('keeps working for the visit when storage fails', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const user = await openPlayer()
    expect(lastLayout()).toEqual(defaultLayout('story'))
    await user.click(within(dialog()).getByRole('radio', { name: L.looks.compact }))
    await drawnWith((l) => expect(l.look).toBe('compact'))
    await select(user, 'title')
    await user.click(within(dialog()).getByRole('button', { name: L.remove(L.items.title) }))
    await drawnWith((l) => {
      expect(l.look).toBe('compact')
      expect(l.items.title.removed).toBe(true)
    })
    expect(within(dialog()).queryByRole('alert')).toBeNull()
  })

  it('shares the PNG drawn with the same layout as the preview', async () => {
    const listBlob = new Blob(['list'], { type: 'image/png' })
    vi.mocked(drawPlayerCard).mockImplementation((_d, o) =>
      Promise.resolve((o as { layout?: CardLayout }).layout?.look === 'list' ? listBlob : mocks.blob),
    )
    const user = await openPlayer()
    await user.click(within(dialog()).getByRole('radio', { name: L.looks.list }))
    await drawnWith((l) => expect(l.look).toBe('list'))
    await user.click(within(dialog()).getByRole('button', { name: share.shareButton }))
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1))
    expect(vi.mocked(shareOrDownload).mock.calls[0][0]).toBe(listBlob)
    expect(lastLayout()!.look).toBe('list')
  })
})

// ---------- the group card stays fixed ----------

describe('ShareCardDialog: the group card has no layout controls', () => {
  it('shows no item buttons, opacity, looks or reset, and draws without a layout', async () => {
    const s = played()
    render(<ShareCardDialog session={s} onClose={() => {}} />)
    await waitFor(() => expect(drawGroupCard).toHaveBeenCalled())
    for (const id of ['player', 'title', 'date'] as CardItemId[]) expect(queryItemButton(id), id).toBeNull()
    expect(within(dialog()).queryByRole('slider', { name: L.opacity })).toBeNull()
    expect(within(dialog()).queryByRole('slider', { name: L.itemSize })).toBeNull()
    expect(within(dialog()).queryByRole('radiogroup', { name: L.lookLabel })).toBeNull()
    expect(within(dialog()).queryByRole('button', { name: L.reset })).toBeNull()
    const [, opts] = vi.mocked(drawGroupCard).mock.calls.at(-1)!
    expect(opts).not.toHaveProperty('layout')
    expect(drawPlayerCard).not.toHaveBeenCalled()
  })
})
