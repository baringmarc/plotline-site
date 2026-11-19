/**
 * The organizer's live key on this device: the stack's code, its secret and the last version published. It sits in
 * localStorage next to the session. The secret never goes in a URL and goes only to `publish_live_stack`
 * (court-booking-system docs/PLATFORM.md §4 "Live stacks"). Storage can be missing or throw: nothing here throws.
 */
export const LIVE_KEY_STORAGE_KEY = 'plotline.paddle-stack.live'

/** The venue a hand-off stack belongs to, for the board's header. */
export type LiveVenue = { name: string; logoPath: string | null }

export type LiveKey = { code: string; secret: string; version: number; venue?: LiveVenue }

function venueOf(v: unknown): LiveVenue | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const { name, logoPath } = v as Record<string, unknown>
  if (typeof name !== 'string' || (logoPath !== null && typeof logoPath !== 'string')) return undefined
  return { name, logoPath: logoPath ?? null }
}

export function loadLiveKey(): LiveKey | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY_STORAGE_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
    const { code, secret, version, venue } = data as Record<string, unknown>
    if (typeof code !== 'string' || typeof secret !== 'string' || !Number.isInteger(version)) return null
    const known = venueOf(venue)
    return known ? { code, secret, version: version as number, venue: known } : { code, secret, version: version as number }
  } catch {
    return null
  }
}

/** False when storage refuses the write (private mode, quota). */
export function saveLiveKey(key: LiveKey): boolean {
  try {
    localStorage.setItem(LIVE_KEY_STORAGE_KEY, JSON.stringify(key))
    return true
  } catch {
    return false
  }
}

export function clearLiveKey(): void {
  try {
    localStorage.removeItem(LIVE_KEY_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
