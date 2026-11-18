// T8.7 Share cards: the background choice and darkness (TASKS.md T8.7 Acceptance: "tests cover … the background choice
// and darkness"). Plan gate, SPEC §6 "T8.7 plan gate" (2026-11-18): four built-in backgrounds drawn on the canvas in
// brand tones (no image files), plus the organizer's own photo with a darkness slider.
//
// Contract (the plan's names): `BACKGROUNDS` (four `{ id, label }`), `CardBackground`, `overlayAlpha(darkness)` with
// darkness 0–100 clamped, `DEFAULT_DARKNESS`. How each background draws is in drawCard.test.ts.
import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, DEFAULT_DARKNESS, overlayAlpha, type CardBackground } from './backgrounds'

describe('BACKGROUNDS (plan gate: four drawn on the canvas)', () => {
  it('has four built-ins', () => {
    expect(BACKGROUNDS).toHaveLength(4)
  })

  it('gives each a unique id and a visible label', () => {
    const ids = BACKGROUNDS.map((b) => b.id)
    expect(new Set(ids).size).toBe(4)
    const labels = BACKGROUNDS.map((b) => b.label)
    expect(new Set(labels).size).toBe(4)
    for (const b of BACKGROUNDS) {
      expect(typeof b.id, JSON.stringify(b)).toBe('string')
      expect(b.id.length).toBeGreaterThan(0)
      expect(typeof b.label).toBe('string')
      expect(b.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('names no image file or URL: the built-ins are drawn, not downloaded', () => {
    expect(JSON.stringify(BACKGROUNDS)).not.toMatch(/https?:|\/stack-bg\/|\.(png|jpe?g|webp|avif|svg)\b/i)
  })

  it('makes a built-in a CardBackground by id', () => {
    const bg: CardBackground = { kind: 'builtin', id: BACKGROUNDS[0].id }
    expect(bg.kind).toBe('builtin')
  })
})

describe('overlayAlpha: the darkness slider over a photo', () => {
  it('lays no shade at darkness 0 (the photo as it is)', () => {
    expect(overlayAlpha(0)).toBe(0)
  })

  it('darkens strongly at 100 without going past opaque', () => {
    expect(overlayAlpha(100)).toBeGreaterThanOrEqual(0.6)
    expect(overlayAlpha(100)).toBeLessThanOrEqual(1)
  })

  it('gets darker as the slider goes up, step by step', () => {
    let last = -1
    for (let d = 0; d <= 100; d += 5) {
      const a = overlayAlpha(d)
      expect(a, `darkness ${d}`).toBeGreaterThanOrEqual(last)
      last = a
    }
    expect(overlayAlpha(80)).toBeGreaterThan(overlayAlpha(20))
    expect(overlayAlpha(50)).toBeGreaterThan(overlayAlpha(0))
    expect(overlayAlpha(100)).toBeGreaterThan(overlayAlpha(50))
  })

  it('clamps below 0 and above 100', () => {
    expect(overlayAlpha(-20)).toBe(overlayAlpha(0))
    expect(overlayAlpha(-Infinity)).toBe(overlayAlpha(0))
    expect(overlayAlpha(150)).toBe(overlayAlpha(100))
    expect(overlayAlpha(Infinity)).toBe(overlayAlpha(100))
  })

  it('always gives an alpha between 0 and 1', () => {
    for (const d of [-5, 0, 1, 33.3, 50, 99, 100, 101]) {
      const a = overlayAlpha(d)
      expect(Number.isFinite(a), `darkness ${d}`).toBe(true)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1)
    }
  })
})

describe('DEFAULT_DARKNESS', () => {
  it('is on the slider (0–100) and already shades a photo so the text reads', () => {
    expect(DEFAULT_DARKNESS).toBeGreaterThan(0)
    expect(DEFAULT_DARKNESS).toBeLessThanOrEqual(100)
    expect(overlayAlpha(DEFAULT_DARKNESS)).toBeGreaterThanOrEqual(0.25)
  })
})
