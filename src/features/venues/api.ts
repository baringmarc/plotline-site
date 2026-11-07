import { unwrap } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'

/** The demo venue keeps its own link on the page and is never shown as a real venue. */
export const DEMO_SLUG = 'claudex-courts'

export type PublicVenue = {
  slug: string
  name: string
  city: string | null
  logoUrl: string | null
  url: string
}

const MEDIA_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/venue-media/`

export async function fetchPublicVenues(): Promise<PublicVenue[]> {
  // The view returns active venues a platform admin approved (PLATFORM.md, public_venues).
  const rows = unwrap(
    await supabase.from('public_venues').select('slug, name, city, logo_url').order('name').limit(24),
  )
  const venues: PublicVenue[] = []
  for (const r of rows) {
    if (!r.slug || !r.name || r.slug === DEMO_SLUG) continue
    venues.push({
      slug: r.slug,
      name: r.name,
      city: r.city?.trim() || null,
      logoUrl: r.logo_url ? MEDIA_BASE + r.logo_url : null,
      url: `https://${r.slug}.plotline.fit`,
    })
  }
  return venues
}
