import { useMutation } from '@tanstack/react-query'
import { registerVenue } from './api'

export function useRegisterVenue() {
  return useMutation({ mutationFn: registerVenue })
}
