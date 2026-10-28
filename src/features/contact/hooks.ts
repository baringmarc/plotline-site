import { useMutation } from '@tanstack/react-query'
import { sendContact } from './api'

export function useSendContact() {
  return useMutation({ mutationFn: sendContact })
}
