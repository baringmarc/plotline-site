/**
 * Serves plotline.fit: www goes to the apex, everything else comes from the built site (wrangler.jsonc).
 * Workers static assets answer a Range request with the whole file (200), checked on 2026-11-11 on
 * production and `wrangler dev`, and Safari and iOS won't play a video without 206 replies, so the
 * Worker cuts the range itself (T4.2, RESEARCH "Demo video").
 */
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } }

const apex = 'plotline.fit'

/** One byte range from a Range header, clamped to the file; null when absent or unsupported (several ranges), 'bad' when unsatisfiable. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'bad' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const [, a, b] = m
  if (a === '' && b === '') return null
  if (a === '') {
    const suffix = Number(b)
    if (suffix === 0 || size === 0) return 'bad'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(a)
  const end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  if (start >= size || end < start) return 'bad'
  return { start, end }
}

/** Media types the Worker cuts ranges for: the demo video (and any audio). Pages and text pass through untouched. */
const isMedia = (res: Response) => /^(video|audio)\//.test(res.headers.get('content-type') ?? '')

/** If-Range (RFC 9110 §13.1.5): serve the range only when its validator matches the reply's ETag or Last-Modified; absent means yes. */
function ifRangeMatches(request: Request, res: Response): boolean {
  const v = request.headers.get('if-range')
  if (v === null) return true
  const etag = res.headers.get('etag')
  if (v.startsWith('"') || v.startsWith('W/')) return etag !== null && !etag.startsWith('W/') && v === etag
  return v === res.headers.get('last-modified')
}

/** Turns a full 200 media reply into a 206 (or 416) for a single-range GET; anything else is passed through. */
async function withRange(request: Request, res: Response): Promise<Response> {
  const header = request.headers.get('range')
  if (!header || request.method !== 'GET' || res.status !== 200 || !isMedia(res) || !ifRangeMatches(request, res)) {
    return res
  }
  const body = await res.arrayBuffer()
  const size = body.byteLength
  const range = parseRange(header, size)
  const headers = new Headers(res.headers)
  headers.set('accept-ranges', 'bytes')
  if (range === null) return new Response(body, { status: 200, headers })
  if (range === 'bad') {
    headers.delete('content-length')
    headers.set('content-range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }
  headers.set('content-range', `bytes ${range.start}-${range.end}/${size}`)
  headers.set('content-length', String(range.end - range.start + 1))
  return new Response(body.slice(range.start, range.end + 1), { status: 206, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === `www.${apex}`) {
      return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301)
    }
    return withRange(request, await env.ASSETS.fetch(request))
  },
}
