// @vitest-environment node
// The Cloudflare Worker in front of the static assets. court-booking-system docs/PLATFORM.md §2:
// `plotline.fit` and `www.plotline.fit` serve this site, and `www` redirects to the apex.
import { describe, expect, it, vi } from 'vitest'
import worker from './worker'

function makeEnv() {
  const assetResponse = new Response('<!doctype html>asset', {
    status: 200,
    headers: { 'content-type': 'text/html', 'x-from-assets': 'yes' },
  })
  const fetch = vi.fn<(req: Request) => Promise<Response>>(async () => assetResponse)
  return { env: { ASSETS: { fetch } }, fetch, assetResponse }
}

describe('worker: www redirects to the apex', () => {
  it('sends www.plotline.fit/ to https://plotline.fit/ with a permanent redirect', async () => {
    const { env, fetch } = makeEnv()
    const res = await worker.fetch(new Request('https://www.plotline.fit/'), env)
    expect([301, 308]).toContain(res.status)
    expect(res.headers.get('location')).toBe('https://plotline.fit/')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the path and query string', async () => {
    const { env, fetch } = makeEnv()
    const res = await worker.fetch(new Request('https://www.plotline.fit/privacy?ref=fb&x=1'), env)
    expect([301, 308]).toContain(res.status)
    expect(res.headers.get('location')).toBe('https://plotline.fit/privacy?ref=fb&x=1')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('redirects plain http www to the https apex', async () => {
    const { env } = makeEnv()
    const res = await worker.fetch(new Request('http://www.plotline.fit/terms'), env)
    expect([301, 308]).toContain(res.status)
    expect(res.headers.get('location')).toBe('https://plotline.fit/terms')
  })

  it('redirects a deep path without a query and adds no stray "?"', async () => {
    const { env } = makeEnv()
    const res = await worker.fetch(new Request('https://www.plotline.fit/a/b/c'), env)
    expect(res.headers.get('location')).toBe('https://plotline.fit/a/b/c')
  })
})

describe('worker: every other host is served from the assets', () => {
  it.each([
    'https://plotline.fit/',
    'https://plotline.fit/privacy?ref=fb',
    'https://plotline-site.example.workers.dev/terms',
    'http://localhost:8787/',
  ])('passes %s to env.ASSETS.fetch and returns its response unchanged', async (url) => {
    const { env, fetch, assetResponse } = makeEnv()
    const request = new Request(url)
    const res = await worker.fetch(request, env)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(request)
    expect(res).toBe(assetResponse)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-from-assets')).toBe('yes')
  })

  it('does not treat a lookalike host (www.plotline.fit.evil.com) as www', async () => {
    const { env, fetch, assetResponse } = makeEnv()
    const res = await worker.fetch(new Request('https://www.plotline.fit.evil.com/'), env)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(res).toBe(assetResponse)
  })
})
