// @vitest-environment node
// T4.2: Workers static assets answer Range with a full 200, and Safari/iOS need 206 to play a video,
// so the Worker cuts single ranges of video and audio replies itself.
import { describe, expect, it, vi } from 'vitest'
import worker, { parseRange } from './worker'

const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i))

function envWith(type: string, status = 200) {
  const fetch = vi.fn(async () => new Response(status === 200 ? bytes : null, { status, headers: { 'content-type': type } }))
  return { ASSETS: { fetch } }
}

const get = (range?: string, extra: Record<string, string> = {}) =>
  new Request('https://plotline.fit/admin-tour/admin-demo.mp4', {
    headers: { ...(range ? { range } : {}), ...extra },
  })

describe('parseRange', () => {
  it.each([
    ['bytes=0-9', { start: 0, end: 9 }],
    ['bytes=90-', { start: 90, end: 99 }],
    ['bytes=-10', { start: 90, end: 99 }],
    ['bytes=50-500', { start: 50, end: 99 }],
    ['bytes=-500', { start: 0, end: 99 }],
  ])('%s', (h, want) => {
    expect(parseRange(h, 100)).toEqual(want)
  })

  it('ignores missing, malformed and multi-range headers', () => {
    expect(parseRange(null, 100)).toBeNull()
    expect(parseRange('bytes=-', 100)).toBeNull()
    expect(parseRange('items=0-1', 100)).toBeNull()
    expect(parseRange('bytes=0-1,5-9', 100)).toBeNull()
  })

  it('flags unsatisfiable ranges', () => {
    expect(parseRange('bytes=100-', 100)).toBe('bad')
    expect(parseRange('bytes=9-3', 100)).toBe('bad')
    expect(parseRange('bytes=-0', 100)).toBe('bad')
  })
})

describe('worker: byte ranges for media', () => {
  it('answers a video range with 206, the slice and Content-Range', async () => {
    const res = await worker.fetch(get('bytes=0-1'), envWith('video/mp4'))
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-1/100')
    expect(res.headers.get('content-length')).toBe('2')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0, 1])
  })

  it('answers an open-ended range from the middle', async () => {
    const res = await worker.fetch(get('bytes=98-'), envWith('video/webm'))
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 98-99/100')
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([98, 99])
  })

  it('answers an unsatisfiable range with 416', async () => {
    const res = await worker.fetch(get('bytes=500-'), envWith('video/mp4'))
    expect(res.status).toBe(416)
    expect(res.headers.get('content-range')).toBe('bytes */100')
  })

  it('sends the whole file for a multi-range request', async () => {
    const res = await worker.fetch(get('bytes=0-1,4-5'), envWith('video/mp4'))
    expect(res.status).toBe(200)
    expect((await res.arrayBuffer()).byteLength).toBe(100)
  })

  it('passes the asset reply through untouched without Range, for pages, for If-Range and for non-200 replies', async () => {
    for (const [req, env] of [
      [get(), envWith('video/mp4')],
      [get('bytes=0-1'), envWith('text/html')],
      [get('bytes=0-1', { 'if-range': '"etag"' }), envWith('video/mp4')],
      [get('bytes=0-1'), envWith('video/mp4', 304)],
    ] as const) {
      const assetRes = await env.ASSETS.fetch()
      env.ASSETS.fetch.mockResolvedValueOnce(assetRes)
      const res = await worker.fetch(req, env)
      expect(res).toBe(assetRes)
    }
  })

  it('serves the range when If-Range matches the ETag or Last-Modified, and the whole file when it does not', async () => {
    const lm = 'Tue, 10 Nov 2026 15:08:00 GMT'
    const env = () => ({
      ASSETS: {
        fetch: vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'video/mp4', etag: '"abc"', 'last-modified': lm } })),
      },
    })
    expect((await worker.fetch(get('bytes=0-1', { 'if-range': '"abc"' }), env())).status).toBe(206)
    expect((await worker.fetch(get('bytes=0-1', { 'if-range': lm }), env())).status).toBe(206)
    expect((await worker.fetch(get('bytes=0-1', { 'if-range': '"old"' }), env())).status).toBe(200)
    expect((await worker.fetch(get('bytes=0-1', { 'if-range': 'W/"abc"' }), env())).status).toBe(200)
  })
})
