import { callFunction } from '../../lib/functions'
import type { ContactPayload } from '../../lib/siteForms'

export type ContactReply = { ok: true }

/** Sends the owner contact form to the platform's `site-contact` function (court-booking-system docs/PLATFORM.md §4). */
export function sendContact(payload: ContactPayload): Promise<ContactReply> {
  return callFunction<ContactReply>('site-contact', payload)
}
