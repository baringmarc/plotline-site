/// <reference types="node" />
// T4.2 Demo video in the tour: the config behind the "Watch the demo" block. Plan names: adminDemo (title, caption,
// poster, sources [{src, type}] WebM first then MP4, captions {src, srclang, label}, width 1280, height 720).
// Files live in public/admin-tour/ and are served from /admin-tour/.
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminDemo } from './site'

/** Per-file budget (court-booking-system RESEARCH "Milestone 21"); Cloudflare's own limit is 25 MiB. */
const BUDGET = 6_000_000
const CLOUDFLARE_LIMIT = 25 * 1024 * 1024

const file = (src: string) => resolve(process.cwd(), 'public', src.slice(1))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Width and height from a JPEG's first SOF marker (baseline or progressive). */
function jpegSize(buf: Buffer): [number, number] {
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`bad marker at ${i}`)
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]
    i += 2 + len
  }
  throw new Error('no SOF marker')
}

describe('admin demo config (T4.2)', () => {
  it('has a "Watch the demo" title', () => {
    expect(adminDemo.title).toMatch(/watch the demo/i)
  })

  it('has a one-line caption that says how long it is (about 70 s) and that it has no sound', () => {
    const c = adminDemo.caption
    expect(c).not.toMatch(/\n/)
    expect(words(c)).toBeLessThanOrEqual(20)
    expect(c).toMatch(/\b70\s?(s|sec|secs|seconds)\b|\b1:10\b|about a minute|a minute/i)
    expect(c).toMatch(/no sound|silent|without sound/i)
  })

  it('declares the video size 1280 x 720', () => {
    expect([adminDemo.width, adminDemo.height]).toEqual([1280, 720])
  })

  it('lists two sources, WebM first then MP4, with their content types', () => {
    expect(adminDemo.sources).toEqual([
      { src: '/admin-tour/admin-demo.webm', type: 'video/webm' },
      { src: '/admin-tour/admin-demo.mp4', type: 'video/mp4' },
    ])
  })

  it('points the poster at /admin-tour/admin-demo-poster.jpg, a 1280 x 720 JPEG that exists', () => {
    expect(adminDemo.poster).toBe('/admin-tour/admin-demo-poster.jpg')
    const buf = readFileSync(file(adminDemo.poster))
    expect([buf[0], buf[1]]).toEqual([0xff, 0xd8])
    expect(jpegSize(buf)).toEqual([1280, 720])
  })

  it('points the captions at /admin-tour/admin-demo.vtt, an English WebVTT file that exists', () => {
    expect(adminDemo.captions.src).toBe('/admin-tour/admin-demo.vtt')
    expect(adminDemo.captions.srclang).toBe('en')
    expect(adminDemo.captions.label.trim()).not.toBe('')
    const vtt = readFileSync(file(adminDemo.captions.src), 'utf8')
    expect(vtt.startsWith('WEBVTT')).toBe(true)
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/)
  })

  it('the captions run about as long as the caption says (60 to 80 s)', () => {
    const vtt = readFileSync(file(adminDemo.captions.src), 'utf8')
    const ends = [...vtt.matchAll(/--> (\d{2}):(\d{2}):(\d{2}\.\d{3})/g)].map(
      (m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]),
    )
    const last = Math.max(...ends)
    expect(last).toBeGreaterThanOrEqual(60)
    expect(last).toBeLessThanOrEqual(80)
  })

  it('size check: each video file exists, is not empty, and is within the 6 MB budget (Cloudflare limit 25 MiB)', () => {
    for (const s of adminDemo.sources) {
      const size = statSync(file(s.src)).size
      expect(size, s.src).toBeGreaterThan(100_000)
      expect(size, s.src).toBeLessThanOrEqual(BUDGET)
      expect(size, s.src).toBeLessThan(CLOUDFLARE_LIMIT)
    }
  })

  it('size check: the poster and the captions are small (poster under 300 kB, captions under 20 kB)', () => {
    expect(statSync(file(adminDemo.poster)).size).toBeLessThan(300_000)
    expect(statSync(file(adminDemo.captions.src)).size).toBeLessThan(20_000)
  })

  it('the files really are WebM and MP4 (EBML header; ftyp box)', () => {
    const webm = readFileSync(file('/admin-tour/admin-demo.webm'))
    expect([...webm.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
    const mp4 = readFileSync(file('/admin-tour/admin-demo.mp4'))
    expect(mp4.subarray(4, 8).toString('latin1')).toBe('ftyp')
  })

  it('claims nothing unshipped and types no peso amount in the demo copy', () => {
    for (const s of [adminDemo.title, adminDemo.caption, adminDemo.captions.label]) {
      expect(s).not.toMatch(/free trial|trial|sign[ -]?up|staff|walk-?ins?|₱\s?\d/i)
    }
  })
})
