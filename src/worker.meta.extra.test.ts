// @vitest-environment node
// T5.6 review round 1: a revalidation of /paddle-stack (If-None-Match → 304 from the assets) must pass through,
// not be rebuilt with a body (a 304 can't carry one, so that would throw and answer 500).
import { describe, expect, it, vi } from 'vitest'
import worker from './worker'

function envWith(res: Response) {
  return { ASSETS: { fetch: vi.fn(async () => res) } }
}

describe('worker: bodiless replies at /paddle-stack', () => {
  it('passes a 304 for the page through unchanged', async () => {
    const notModified = new Response(null, { status: 304, headers: { 'content-type': 'text/html', etag: '"abc"' } })
    const req = new Request('https://plotline.fit/paddle-stack', { headers: { 'if-none-match': '"abc"' } })
    const res = await worker.fetch(req, envWith(notModified))
    expect(res).toBe(notModified)
    expect(res.status).toBe(304)
  })

  it('passes a 204 HTML reply through unchanged', async () => {
    const empty = new Response(null, { status: 204, headers: { 'content-type': 'text/html' } })
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack'), envWith(empty))
    expect(res).toBe(empty)
  })
})

describe('worker: the rewritten page has no index.html ETag', () => {
  it('drops the ETag so a change to the page tags alone is never answered with 304', async () => {
    const page = new Response('<html><head><title>x</title></head></html>', {
      headers: { 'content-type': 'text/html', etag: '"index"' },
    })
    const res = await worker.fetch(new Request('https://plotline.fit/paddle-stack'), envWith(page))
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeNull()
  })
})
