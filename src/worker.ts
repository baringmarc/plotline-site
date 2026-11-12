/**
 * Serves plotline.fit: www goes to the apex, everything else comes from the built site (wrangler.jsonc).
 * Workers static assets answer a Range request with the whole file (200), checked on 2026-11-11 on
 * production and `wrangler dev`, and Safari and iOS won't play a video without 206 replies, so the
 * Worker cuts the range itself (T4.2, RESEARCH "Demo video").
 */
import { paddleStackMeta, type PageMeta } from './config/pageMeta'

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

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Sets the `content` of one `<meta name|property="key">` tag in index.html. */
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`(<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content=")[^"]*(")`)
  return html.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`)
}

/**
 * Gives a page its own title, description, canonical and Open Graph tags (T5.6), so a link to it previews as
 * that page rather than the landing page. A string rewrite of our own index.html (Cloudflare's HTMLRewriter
 * can't run in the unit tests); `src/worker.meta.test.ts` runs it on the real file, so a renamed tag fails there.
 */
export function withPageMeta(html: string, meta: PageMeta): string {
  let out = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(meta.title)}</title>`)
  out = setMeta(out, 'name', 'description', meta.description)
  out = setMeta(out, 'property', 'og:title', meta.title)
  out = setMeta(out, 'property', 'og:description', meta.description)
  out = setMeta(out, 'property', 'og:url', meta.url)
  out = setMeta(out, 'property', 'og:image', meta.image)
  out = setMeta(out, 'property', 'og:image:alt', meta.imageAlt)
  return out.replace('</head>', () => `  <link rel="canonical" href="${escapeHtml(meta.url)}" />\n  </head>`)
}

/** Pages with their own head: the path, with or without a trailing slash. */
const pageMetas: PageMeta[] = [paddleStackMeta]

async function withHead(request: Request, res: Response): Promise<Response> {
  if (request.method !== 'GET') return res
  const path = new URL(request.url).pathname.replace(/\/$/, '') || '/'
  const meta = pageMetas.find((m) => m.path === path)
  if (!meta || !(res.headers.get('content-type') ?? '').startsWith('text/html')) return res
  // A 304 (a reload or re-scrape revalidating its copy) and other bodiless replies pass through: they carry no
  // page to rewrite, and a Response with a null-body status can't be given one.
  if (res.body === null || [101, 204, 205, 304].includes(res.status)) return res
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  // The ETag belongs to index.html, not to this page: a change to the page's tags alone must not answer 304.
  headers.delete('etag')
  return new Response(withPageMeta(await res.text(), meta), { status: res.status, statusText: res.statusText, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === `www.${apex}`) {
      return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301)
    }
    return withHead(request, await withRange(request, await env.ASSETS.fetch(request)))
  },
}
