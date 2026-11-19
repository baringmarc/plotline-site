/**
 * The hand-off from a venue's /admin/open-play (T6.3; court-booking-system docs/PLATFORM.md §4): the link is
 * `/paddle-stack?live=<code>#key=<secret>`. The secret is in the fragment, which browsers never send to a server.
 */
export const HANDOFF_QUERY = 'live'

const URL_SAFE = /^[A-Za-z0-9_-]+$/

/** The code and the secret from a hand-off link, or null when either is missing or malformed. */
export function parseHandoff(search: string, hash: string): { code: string; secret: string } | null {
  const code = new URLSearchParams(search).get(HANDOFF_QUERY)
  const secret = new URLSearchParams(hash.replace(/^#/, '')).get('key')
  if (!code || !secret || !URL_SAFE.test(code) || !URL_SAFE.test(secret)) return null
  return { code, secret }
}

/** The venue's logo in the public `venue-media` bucket (PLATFORM.md §4: a path inside it). */
export function venueLogoUrl(logoPath: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/venue-media/${logoPath}`
}

/** A venue's booking page (T6.4): `https://<slug>.plotline.fit/book`. */
export function venueBookUrl(slug: string): string {
  return `https://${slug}.plotline.fit/book`
}
