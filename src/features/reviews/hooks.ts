import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchApprovedReviews, sendReview } from './api'

export function useApprovedReviews() {
  return useQuery({ queryKey: ['reviews', 'approved'], queryFn: fetchApprovedReviews })
}

/** New reviews wait for approval, so there is nothing to invalidate after sending one. */
export function useSendReview() {
  return useMutation({ mutationFn: sendReview })
}
