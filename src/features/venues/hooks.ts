import { useQuery } from '@tanstack/react-query'
import { fetchPublicVenues } from './api'

/** A venue approved in the console shows up within minutes, or when the visitor comes back to the tab. */
export function usePublicVenues() {
  return useQuery({
    queryKey: ['venues', 'public'],
    queryFn: fetchPublicVenues,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}
