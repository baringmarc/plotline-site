import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../lib/database.types'
import { ApiError } from '../../lib/queryClient'
import { DEMO_SLUG, fetchPublicVenues, type PublicVenue } from './api'

type Row = Database['public']['Views']['public_venues']['Row']
type Reply = { data: Row[] | null; error: { message: string; code: string; hint: string; details: string } | null }

/** Every builder call made for one read, in order, e.g. ["select", ["slug, name, city, logo_url"]]. */
const calls: [string, unknown[]][] = []
const from = vi.fn()
let reply: Reply = { data: [], error: null }

/**
 * A stand-in for the PostgREST query builder: every method records itself and returns the builder,
 * and awaiting it gives `reply`. It ignores filters, so anything the read must drop is dropped by the code.
 */
function builder(): unknown {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'limit', 'not', 'neq', 'eq', 'is', 'filter', 'range', 'returns', 'overrideTypes']) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, args])
      return b
    }
  }
  b.then = (resolve: (r: Reply) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(reply).then(resolve, reject)
  return b
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      from(...a)
      return builder()
    },
  },
}))

function row(over: Partial<Row> = {}): Row {
  return { slug: 'acme-courts', name: 'Acme Courts', city: 'Cebu City', logo_url: null, ...over }
}

const STORAGE = 'http://localhost:55321/storage/v1/object/public/venue-media/'

function argsOf(method: string): unknown[][] {
  return calls.filter(([m]) => m === method).map(([, a]) => a)
}

beforeEach(() => {
  calls.length = 0
  from.mockReset()
  reply = { data: [], error: null }
})

describe('fetchPublicVenues: the read (T3.1)', () => {
  it('reads the public_venues view, selecting exactly slug, name, city and logo_url', async () => {
    await fetchPublicVenues()
    expect(from).toHaveBeenCalledWith('public_venues')
    const selects = argsOf('select')
    expect(selects).toHaveLength(1)
    const cols = String(selects[0][0])
      .split(',')
      .map((c) => c.trim())
      .sort()
    expect(cols).toEqual(['city', 'logo_url', 'name', 'slug'])
  })

  it('orders by name (ascending) and asks for at most 24 rows', async () => {
    await fetchPublicVenues()
    const orders = argsOf('order')
    expect(orders.map((a) => a[0])).toContain('name')
    const byName = orders.find((a) => a[0] === 'name')
    const opts = byName?.[1] as { ascending?: boolean } | undefined
    expect(opts?.ascending ?? true).toBe(true)
    expect(argsOf('limit')).toEqual([[24]])
  })

  it('names the demo slug claudex-courts', () => {
    expect(DEMO_SLUG).toBe('claudex-courts')
  })
})

describe('fetchPublicVenues: mapping rows (T3.1)', () => {
  it('maps a full row to a PublicVenue with its own plotline.fit address and the public logo URL', async () => {
    reply = { data: [row({ slug: 'acme-courts', name: 'Acme Courts', city: 'Cebu City', logo_url: 'v1/logo.png' })], error: null }
    const expected: PublicVenue[] = [
      {
        slug: 'acme-courts',
        name: 'Acme Courts',
        city: 'Cebu City',
        logoUrl: `${STORAGE}v1/logo.png`,
        url: 'https://acme-courts.plotline.fit',
      },
    ]
    await expect(fetchPublicVenues()).resolves.toEqual(expected)
  })

  it('builds the logo URL from VITE_SUPABASE_URL', async () => {
    reply = { data: [row({ logo_url: 'a/b.webp' })], error: null }
    const [v] = await fetchPublicVenues()
    expect(v.logoUrl).toBe(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/venue-media/a/b.webp`)
  })

  it('gives a null logoUrl when logo_url is null', async () => {
    reply = { data: [row({ logo_url: null })], error: null }
    const [v] = await fetchPublicVenues()
    expect(v.logoUrl).toBeNull()
  })

  it('keeps a null city as null and turns an empty city into null', async () => {
    reply = { data: [row({ slug: 'a-courts', name: 'A Courts', city: null }), row({ slug: 'b-courts', name: 'B Courts', city: '' })], error: null }
    const venues = await fetchPublicVenues()
    expect(venues.map((v) => v.city)).toEqual([null, null])
  })

  it('drops rows without a slug or without a name', async () => {
    reply = {
      data: [
        row({ slug: null, name: 'No Slug Courts' }),
        row({ slug: 'no-name', name: null }),
        row({ slug: 'kept-courts', name: 'Kept Courts' }),
      ],
      error: null,
    }
    const venues = await fetchPublicVenues()
    expect(venues.map((v) => v.slug)).toEqual(['kept-courts'])
  })

  it('drops the demo venue (claudex-courts): it keeps its own link', async () => {
    reply = {
      data: [row({ slug: 'acme-courts', name: 'Acme Courts' }), row({ slug: DEMO_SLUG, name: 'Claudex Courts' }), row({ slug: 'zeta-courts', name: 'Zeta Courts' })],
      error: null,
    }
    const venues = await fetchPublicVenues()
    expect(venues.map((v) => v.slug)).toEqual(['acme-courts', 'zeta-courts'])
    expect(venues.some((v) => v.name === 'Claudex Courts')).toBe(false)
  })

  it('keeps the order the database returned (ordered by name there)', async () => {
    reply = { data: [row({ slug: 'a', name: 'Alpha' }), row({ slug: 'b', name: 'Bravo' }), row({ slug: 'c', name: 'Charlie' })], error: null }
    const venues = await fetchPublicVenues()
    expect(venues.map((v) => v.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('returns an empty list when the view has no rows', async () => {
    reply = { data: [], error: null }
    await expect(fetchPublicVenues()).resolves.toEqual([])
  })
})

describe('fetchPublicVenues: errors (T3.1)', () => {
  it('throws the error as an ApiError, so the query fails instead of showing an empty list', async () => {
    reply = { data: null, error: { message: 'relation unavailable', code: '42P01', hint: '', details: '' } }
    const err = await fetchPublicVenues().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('relation unavailable')
    expect((err as ApiError).code).toBe('42P01')
  })
})
