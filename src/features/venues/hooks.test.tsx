import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicVenue } from './api'
import { usePublicVenues } from './hooks'

const fetchPublicVenues = vi.fn<() => Promise<PublicVenue[]>>()
vi.mock('./api', () => ({ fetchPublicVenues: () => fetchPublicVenues(), DEMO_SLUG: 'claudex-courts' }))

const acme: PublicVenue = { slug: 'acme-courts', name: 'Acme Courts', city: 'Cebu City', logoUrl: null, url: 'https://acme-courts.plotline.fit' }

function setup() {
  // The app's defaults (lib/queryClient.ts) are a 1-minute stale time and no refetch on focus: the hook overrides both.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, refetchOnWindowFocus: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook(() => usePublicVenues(), { wrapper })
  return { client, ...hook }
}

beforeEach(() => {
  fetchPublicVenues.mockReset()
})

describe('usePublicVenues (T3.1)', () => {
  it('returns the venues from fetchPublicVenues under the key ["venues", "public"]', async () => {
    fetchPublicVenues.mockResolvedValue([acme])
    const { client, result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([acme])
    expect(fetchPublicVenues).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(['venues', 'public'])).toEqual([acme])
  })

  it('stays fresh for 5 minutes, refetches on window focus and never polls', async () => {
    fetchPublicVenues.mockResolvedValue([])
    const { client, result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const query = client.getQueryCache().find({ queryKey: ['venues', 'public'] })
    expect(query).toBeDefined()
    const observer = query!.observers[0]
    expect(observer).toBeDefined()
    expect(observer.options.staleTime).toBe(5 * 60_000)
    expect(observer.options.refetchOnWindowFocus).toBe(true)
    expect(observer.options.refetchInterval).toBeUndefined()
    expect(query!.isStale()).toBe(false)
  })

  it('reports an error when the read fails', async () => {
    fetchPublicVenues.mockRejectedValue(new Error('down'))
    const { result } = setup()
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
