/**
 * Keeps the organizer's Paddle Stack in this browser's localStorage, so a refresh or a closed tab resumes it.
 * Storage can be missing or throw (private mode, blocked site data): nothing here throws, and a failed save
 * returns false so the page can say so.
 */
import { deserialize, serialize } from './engine'
import type { Session } from './types'

export const STACK_STORAGE_KEY = 'plotline.paddle-stack'

export interface StackState {
  session: Session
  ended: boolean
}

export function loadStack(): StackState | null {
  try {
    const raw = localStorage.getItem(STACK_STORAGE_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const { ended, session } = data as Record<string, unknown>
    if (typeof ended !== 'boolean' || typeof session !== 'string') return null
    const restored = deserialize(session)
    return restored ? { session: restored, ended } : null
  } catch {
    return null
  }
}

export function saveStack(state: StackState): boolean {
  try {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify({ ended: state.ended, session: serialize(state.session) }))
    return true
  } catch {
    return false
  }
}

export function clearStack(): void {
  try {
    localStorage.removeItem(STACK_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
