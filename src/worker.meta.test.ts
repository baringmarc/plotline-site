// @vitest-environment node
// T5.6 Make the stack findable: the site is a single-page app, so the Worker rewrites index.html's head for
// `/paddle-stack` (its own title, description, canonical and Open Graph tags, and OG image) and leaves `/` alone.
// Plan names: `paddleStackMeta` in src/config/pageMeta.ts ({ path, title, description, url, image, imageAlt })
// and `withPageMeta(html, meta)` exported by src/worker.ts.
import { describe, expect, it, vi } from 'vitest'
import indexHtml from '../index.html?raw'
import { paddleStackMeta } from './config/pageMeta'
import worker, { withPageMeta } from './worker'

type Meta = typeof paddleStackMeta

/** Every `content` of a meta tag with this name= or property= (attribute order free). */
function metaContents(html: string, key: string): string[] {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  return tags
    .filter((t) => new RegExp(`\\b(?:name|property)="${key.replace(/[.:]/g, '\\$&')}"`).test(t))
    .map((t) => /\bcontent="([^"]*)"/.exec(t)?.[1] ?? '')
}
const titles = (html: string) => [...html.matchAll(/<title>([^<]*)<\/title>/gi)].map((m) => m[1])
const canonicals = (html: string) =>
  (html.match(/<link\b[^>]*rel="canonical"[^>]*>/gi) ?? []).map((t) => /\bhref="([^"]*)"/.exec(t)?.[1] ?? '')
const head = (html: string) => /<head>([\s\S]*)<\/head>/i.exec(html)?.[1] ?? ''

function makeEnv(body: string = indexHtml, init: ResponseInit = {}) {
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'content-length': String(new TextEncoder().encode(body).byteLength),
    'x-from-assets': 'yes',
    'cache-control': 'public, max-age=0, must-revalidate',
    ...Object.fromEntries(new Headers(init.headers).entries()),
  })
  const assetResponse = new Response(body, { status: init.status ?? 200, headers })
  const fetch = vi.fn<(req: Request) => Promise<Response>>(async () => assetResponse)
  return { env: { ASSETS: { fetch } }, fetch, assetResponse }
}

describe('paddleStackMeta (T5.6)', () => {
  it('names the page, its absolute URL and its own OG image', () => {
    expect(paddleStackMeta.path).toBe('/paddle-stack')
    expect(paddleStackMeta.url).toBe('https://plotline.fit/paddle-stack')
    expect(paddleStackMeta.image).toBe('https://plotline.fit/og-paddle-stack.jpg')
    expect(paddleStackMeta.title).toContain('Paddle Stack')
    expect(paddleStackMeta.description.trim()).not.toBe('')
    expect(paddleStackMeta.imageAlt.trim()).not.toBe('')
  })

  it('differs from the landing page head', () => {
    expect(titles(indexHtml)).not.toContain(paddleStackMeta.title)
    expect(metaContents(indexHtml, 'description')).not.toContain(paddleStackMeta.description)
  })

  it('has no amounts (only the pricing config may set them) and no trial or sign-up wording', () => {
    const text = `${paddleStackMeta.title} ${paddleStackMeta.description} ${paddleStackMeta.imageAlt}`
    expect(text).not.toMatch(/₱\s?\d/)
    expect(text).not.toMatch(/trial|\/month|per month/i)
  })
})

describe('withPageMeta: the rewritten head for /paddle-stack (T5.6)', () => {
  const out = withPageMeta(indexHtml, paddleStackMeta)

  it('sets exactly one <title>, Paddle Stack’s', () => {
    expect(titles(out)).toEqual([paddleStackMeta.title])
  })

  it('sets the description', () => {
    expect(metaContents(out, 'description')).toEqual([paddleStackMeta.description])
  })

  it('sets og:title, og:description and og:url', () => {
    expect(metaContents(out, 'og:title')).toEqual([paddleStackMeta.title])
    expect(metaContents(out, 'og:description')).toEqual([paddleStackMeta.description])
    expect(metaContents(out, 'og:url')).toEqual([paddleStackMeta.url])
  })

  it('sets og:image and og:image:alt to the Paddle Stack image', () => {
    expect(metaContents(out, 'og:image')).toEqual(['https://plotline.fit/og-paddle-stack.jpg'])
    expect(metaContents(out, 'og:image:alt')).toEqual([paddleStackMeta.imageAlt])
  })

  it('adds one canonical link to https://plotline.fit/paddle-stack inside <head>', () => {
    expect(canonicals(out)).toEqual(['https://plotline.fit/paddle-stack'])
    expect(canonicals(head(out))).toEqual(['https://plotline.fit/paddle-stack'])
  })

  it('leaves none of the landing page’s title, description, URL or image behind', () => {
    expect(out).not.toContain('<title>Plotline: online court booking for your venue</title>')
    expect(out).not.toContain('content="https://plotline.fit/"')
    expect(out).not.toContain('content="https://plotline.fit/og.jpg"')
    for (const d of metaContents(indexHtml, 'description')) expect(out).not.toContain(`content="${d}"`)
    for (const d of metaContents(indexHtml, 'og:description')) expect(out).not.toContain(`content="${d}"`)
  })

  it('keeps the rest of the page: other head tags, the root div and the script', () => {
    expect(metaContents(out, 'og:image:width')).toEqual(['1200'])
    expect(metaContents(out, 'og:image:height')).toEqual(['630'])
    expect(metaContents(out, 'og:type')).toEqual(['website'])
    expect(metaContents(out, 'twitter:card')).toEqual(['summary_large_image'])
    expect(out).toContain('<link rel="icon" type="image/svg+xml" href="/logo.svg" />')
    expect(out).toContain('<div id="root"></div>')
    expect(out).toContain('<script type="module" src="/src/main.tsx"></script>')
  })

  it('escapes HTML special characters in the values', () => {
    const meta: Meta = { ...paddleStackMeta, title: 'A & B "C" <D>', description: 'x & "y"', imageAlt: '<alt>' }
    const html = withPageMeta(indexHtml, meta)
    expect(html).toContain('<title>A &amp; B &quot;C&quot; &lt;D&gt;</title>')
    expect(metaContents(html, 'og:title')).toEqual(['A &amp; B &quot;C&quot; &lt;D&gt;'])
    expect(metaContents(html, 'description')).toEqual(['x &amp; &quot;y&quot;'])
    expect(metaContents(html, 'og:image:alt')).toEqual(['&lt;alt&gt;'])
  })
})

describe('worker: /paddle-stack gets its own head (T5.6)', () => {
  it.each(['https://plotline.fit/paddle-stack', 'https://plotline.fit/paddle-stack/', 'https://plotline.fit/paddle-stack?ref=fb&tv=1'])(
    'rewrites the HTML reply for GET %s',
    async (url) => {
      const { env, fetch } = makeEnv()
      const res = await worker.fetch(new Request(url), env)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(titles(html)).toEqual([paddleStackMeta.title])
      expect(metaContents(html, 'description')).toEqual([paddleStackMeta.description])
      expect(metaContents(html, 'og:title')).toEqual([paddleStackMeta.title])
      expect(metaContents(html, 'og:url')).toEqual([paddleStackMeta.url])
      expect(metaContents(html, 'og:image')).toEqual([paddleStackMeta.image])
      expect(canonicals(html)).toEqual([paddleStackMeta.url])
      expect(html).toBe(withPageMeta(indexHtml, paddleStackMeta))
    },
  )

  it('keeps the status and other headers, and drops the stale content-length', async () => {
    const { env } = makeEnv()
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack'), env)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('x-from-assets')).toBe('yes')
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
    const body = await res.text()
    const len = res.headers.get('content-length')
    if (len !== null) expect(Number(len)).toBe(new TextEncoder().encode(body).byteLength)
    expect(len).not.toBe(String(new TextEncoder().encode(indexHtml).byteLength))
  })

  it('keeps a non-200 status (for example 404 from the assets) while rewriting the HTML', async () => {
    const { env } = makeEnv(indexHtml, { status: 404 })
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack'), env)
    expect(res.status).toBe(404)
  })
})

describe('worker: everything else is left untouched (T5.6)', () => {
  it.each(['https://plotline.fit/', 'https://plotline.fit/terms', 'https://plotline.fit/privacy?ref=fb', 'https://plotline.fit/paddle-stacks', 'https://plotline.fit/paddle-stack/extra'])(
    'returns the assets reply for %s unchanged',
    async (url) => {
      const { env, assetResponse } = makeEnv()
      const res = await worker.fetch(new Request(url), env)
      expect(res).toBe(assetResponse)
      const html = await res.text()
      expect(html).toBe(indexHtml)
      expect(canonicals(html)).toEqual([])
    },
  )

  it('leaves a non-HTML reply at /paddle-stack untouched', async () => {
    const { env, assetResponse } = makeEnv('{"ok":true}', { headers: { 'content-type': 'application/json' } })
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack'), env)
    expect(res).toBe(assetResponse)
    expect(await res.text()).toBe('{"ok":true}')
  })

  it('still redirects www.plotline.fit/paddle-stack to the apex without fetching assets', async () => {
    const { env, fetch } = makeEnv()
    const res = await worker.fetch(new Request('https://www.plotline.fit/paddle-stack?ref=fb'), env)
    expect([301, 308]).toContain(res.status)
    expect(res.headers.get('location')).toBe('https://plotline.fit/paddle-stack?ref=fb')
    expect(fetch).not.toHaveBeenCalled()
  })
})
