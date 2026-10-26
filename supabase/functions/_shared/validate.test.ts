import { describe, expect, it } from 'vitest'
import { isLikelyBot, MIN_FILL_MS, validateReview, validateSignup, type SignupPayload } from './validate.ts'

const NOW = 1_800_000_000_000

const good: SignupPayload = {
  firstName: 'Ana',
  lastName: 'Reyes',
  email: ' Ana@Example.com ',
  phone: '0917 123 4567',
  venueName: 'Sample Pickle Park',
  location: 'Pasig',
  courts: 3,
  facebook: '',
  message: '',
  openPlayAddon: true,
  password: 'correct horse',
  password2: 'correct horse',
  agreeTerms: true,
  agreeCertify: true,
  website: '',
  started: NOW - 60_000,
}

describe('validateSignup', () => {
  it('accepts a complete form and normalizes email and phone', () => {
    const r = validateSignup(good)
    expect(r).toEqual({
      ok: true,
      value: expect.objectContaining({ email: 'ana@example.com', phone: '09171234567', courts: 3, openPlayAddon: true }),
    })
  })

  it.each([
    [{ email: 'not-an-email' }, 'valid email'],
    [{ phone: '12345' }, 'mobile number'],
    [{ courts: 0 }, 'how many courts'],
    [{ password: 'short', password2: 'short' }, 'at least 8'],
    [{ password2: 'different' }, 'do not match'],
    [{ agreeCertify: false }, 'tick both'],
  ])('rejects %o', (patch, message) => {
    const r = validateSignup({ ...good, ...patch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(message)
  })

  it('accepts +63 numbers', () => {
    expect(validateSignup({ ...good, phone: '+63 917-123-4567' }).ok).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(validateSignup(null).ok).toBe(false)
    expect(validateSignup('x').ok).toBe(false)
  })
})

describe('isLikelyBot', () => {
  it('passes a person who took their time', () => {
    expect(isLikelyBot(good, NOW)).toBe(false)
  })
  it('flags a filled honeypot', () => {
    expect(isLikelyBot({ ...good, website: 'http://spam' }, NOW)).toBe(true)
  })
  it('flags a form sent too fast or never touched', () => {
    expect(isLikelyBot({ ...good, started: NOW - MIN_FILL_MS + 1 }, NOW)).toBe(true)
    expect(isLikelyBot({ ...good, started: 0 }, NOW)).toBe(true)
  })
})

describe('validateReview', () => {
  const review = { name: 'Ben', venue: '', quote: 'Booking took me one minute.', role: 'player', rating: 5, consent: true }

  it('accepts a complete review', () => {
    expect(validateReview(review)).toEqual({
      ok: true,
      value: { name: 'Ben', venue: '', quote: 'Booking took me one minute.', role: 'player', rating: 5 },
    })
  })
  it('needs a rating, a role and consent', () => {
    expect(validateReview({ ...review, rating: 0 }).ok).toBe(false)
    expect(validateReview({ ...review, role: 'admin' }).ok).toBe(false)
    expect(validateReview({ ...review, consent: false }).ok).toBe(false)
  })
})
