// @vitest-environment node
// T6.4 Player view: the Worker's head for `/paddle-stack/live/<code>` (TASKS.md T6.4: "Worker meta for the route
// (noindex)"). Player links are private to a group and live for a day, so search engines must not index them.
// Plan names: `liveStackMeta` in src/config/pageMeta.ts (matches `/paddle-stack/live/<code>`), applied by
// src/worker.ts, which adds `<meta name="robots" content="noindex">` inside <head>.
import { describe, expect, it, vi } from 'vitest'
import indexHtml from '../index.html?raw'
import { liveStackMeta, paddleStackMeta } from './config/pageMeta'
import worker from './worker'

function metaContents(html: string, key: string): string[] {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  return tags
    .filter((t) => new RegExp(`\\b(?:name|property)="${key.replace(/[.:]/g, '\\$&')}"`).test(t))
    .map((t) => /\bcontent="([^"]*)"/.exec(t)?.[1] ?? '')
}
const titles = (html: string) => [...html.matchAll(/<title>([^<]*)<\/title>/gi)].map((m) => m[1])
const head = (html: string) => /<head>([\s\S]*)<\/head>/i.exec(html)?.[1] ?? ''

function makeEnv(body: string = indexHtml, contentType = 'text/html; charset=utf-8') {
  const assetResponse = new Response(body, { status: 200, headers: { 'content-type': contentType } })
  const fetch = vi.fn<(req: Request) => Promise<Response>>(async () => assetResponse)
  return { env: { ASSETS: { fetch } }, fetch, assetResponse }
}

describe('liveStackMeta (T6.4)', () => {
  it('has its own title, not the landing page’s or the Stack page’s', () => {
    expect(liveStackMeta.title.trim()).not.toBe('')
    expect(titles(indexHtml)).not.toContain(liveStackMeta.title)
    expect(liveStackMeta.title).not.toBe(paddleStackMeta.title)
  })
})

describe('worker: /paddle-stack/live/<code> is noindex (T6.4)', () => {
  it.each([
    'https://plotline.fit/paddle-stack/live/AbC_123-x',
    'https://plotline.fit/paddle-stack/live/AbC_123-x/',
    'https://plotline.fit/paddle-stack/live/AbC_123-x?ref=qr',
  ])('GET %s gets one robots noindex tag in <head> and the live title', async (url) => {
    const { env, fetch } = makeEnv()
    const res = await worker.fetch(new Request(url), env)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(metaContents(html, 'robots')).toEqual(['noindex'])
    expect(metaContents(head(html), 'robots')).toEqual(['noindex'])
    expect(titles(html)).toEqual([liveStackMeta.title])
    expect(html).toContain('<div id="root"></div>')
  })

  it('a different code gets the same head', async () => {
    const a = await (await worker.fetch(new Request('https://plotline.fit/paddle-stack/live/one'), makeEnv().env)).text()
    const b = await (await worker.fetch(new Request('https://plotline.fit/paddle-stack/live/TWO_2'), makeEnv().env)).text()
    expect(a).toBe(b)
  })

  it('a non-HTML reply on the route is left untouched', async () => {
    const { env, assetResponse } = makeEnv('{"ok":true}', 'application/json')
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack/live/AbC'), env)
    expect(res).toBe(assetResponse)
  })

  it.each(['https://plotline.fit/', 'https://plotline.fit/paddle-stack', 'https://plotline.fit/terms'])(
    '%s stays indexable (no robots noindex)',
    async (url) => {
      const res = await worker.fetch(new Request(url), makeEnv().env)
      expect(metaContents(await res.text(), 'robots')).toEqual([])
    },
  )
})
