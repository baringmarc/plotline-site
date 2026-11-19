// T6.3 Hand-off from a venue (TASKS.md T6.3; court-booking-system docs/PLATFORM.md §4 "Live stacks", "Hand-off from
// a venue's /admin/open-play"): the venue opens `https://plotline.fit/paddle-stack?live=<code>#key=<secret>`. The code
// is in the `live` query parameter, the secret in the fragment's `key=` parameter (never sent to a server). Both are
// URL-safe base64 without padding ([A-Za-z0-9_-]). Names from the approved plan: `HANDOFF_QUERY`,
// `parseHandoff(search, hash)` -> { code, secret } | null, `venueLogoUrl(logoPath)`.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HANDOFF_QUERY, parseHandoff, venueLogoUrl } from './handoff'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('HANDOFF_QUERY (T6.3)', () => {
  it('is the query parameter live', () => {
    expect(HANDOFF_QUERY).toBe('live')
  })
})

describe('parseHandoff: a good link (T6.3)', () => {
  it('reads the code from ?live= and the secret from #key=', () => {
    expect(parseHandoff('?live=abcDEF123_-xyz', '#key=s3cr3t_VALUE-9')).toEqual({
      code: 'abcDEF123_-xyz',
      secret: 's3cr3t_VALUE-9',
    })
  })

  it('finds them among other query and fragment parameters', () => {
    expect(parseHandoff('?utm_source=admin&live=CODE123', '#from=venue&key=SECRET456')).toEqual({
      code: 'CODE123',
      secret: 'SECRET456',
    })
  })

  it('returns exactly the code and the secret, nothing else', () => {
    const parsed = parseHandoff('?live=CODE123&tv=0', '#key=SECRET456')
    expect(parsed).not.toBeNull()
    expect(Object.keys(parsed!).sort()).toEqual(['code', 'secret'])
  })
})

describe('parseHandoff: a bad link returns null (T6.3)', () => {
  it.each([
    ['no query at all', '', '#key=SECRET456'],
    ['no live parameter', '?tv=1', '#key=SECRET456'],
    ['an empty code', '?live=', '#key=SECRET456'],
    ['a code with a space', '?live=ab%20cd', '#key=SECRET456'],
    ['a code with a slash', '?live=ab%2Fcd', '#key=SECRET456'],
    ['a code with a plus (read as a space)', '?live=ab+cd', '#key=SECRET456'],
    ['a code with padding', '?live=abcd%3D', '#key=SECRET456'],
    ['a code with a dot', '?live=ab.cd', '#key=SECRET456'],
    ['no fragment', '?live=CODE123', ''],
    ['an empty fragment', '?live=CODE123', '#'],
    ['a fragment without key', '?live=CODE123', '#secret=SECRET456'],
    ['an empty key', '?live=CODE123', '#key='],
    ['a key with a space', '?live=CODE123', '#key=ab%20cd'],
    ['a key with a slash', '?live=CODE123', '#key=ab/cd'],
    ['a key with an encoded slash', '?live=CODE123', '#key=ab%2Fcd'],
    ['a key with a plus', '?live=CODE123', '#key=ab+cd'],
    ['a key with padding', '?live=CODE123', '#key=abcd='],
    ['a key with a non-ASCII letter', '?live=CODE123', '#key=ab%C3%B1cd'],
  ])('%s', (_label, search, hash) => {
    expect(parseHandoff(search, hash)).toBeNull()
  })

  it('the secret in the query instead of the fragment is not accepted', () => {
    expect(parseHandoff('?live=CODE123&key=SECRET456', '')).toBeNull()
  })
})

describe('venueLogoUrl (T6.3)', () => {
  it('builds the public venue-media URL from VITE_SUPABASE_URL', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj-ref.supabase.co')
    expect(venueLogoUrl('venue-1/logo.webp')).toBe(
      'https://proj-ref.supabase.co/storage/v1/object/public/venue-media/venue-1/logo.webp',
    )
  })

  it('reads VITE_SUPABASE_URL when called, so another project gives another URL', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:55321')
    expect(venueLogoUrl('a/b.png')).toBe('http://localhost:55321/storage/v1/object/public/venue-media/a/b.png')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://other.supabase.co')
    expect(venueLogoUrl('a/b.png')).toBe('https://other.supabase.co/storage/v1/object/public/venue-media/a/b.png')
  })
})
