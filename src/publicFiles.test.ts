// @vitest-environment node
/// <reference types="node" />
// T5.6 Make the stack findable: public/sitemap.xml lists the four pages, robots.txt points at it, and Paddle
// Stack's share image exists at the size index.html's og:image:width/height declare (1200×630).
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const file = (name: string) => resolve(process.cwd(), 'public', name)

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

describe('public/sitemap.xml (T5.6)', () => {
  it('exists', () => {
    expect(existsSync(file('sitemap.xml'))).toBe(true)
  })

  it('is a sitemaps.org urlset listing exactly /, /paddle-stack, /terms and /privacy on plotline.fit', () => {
    const xml = readFileSync(file('sitemap.xml'), 'utf8')
    expect(xml.trimStart().startsWith('<?xml')).toBe(true)
    expect(xml).toMatch(/<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/)
    const locs = [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => m[1])
    expect([...locs].sort()).toEqual(
      ['https://plotline.fit/', 'https://plotline.fit/paddle-stack', 'https://plotline.fit/privacy', 'https://plotline.fit/terms'].sort(),
    )
  })
})

describe('public/robots.txt (T5.6)', () => {
  it('lists the sitemap and still allows everything', () => {
    const txt = readFileSync(file('robots.txt'), 'utf8')
    const lines = txt.split(/\r?\n/).map((l) => l.trim())
    expect(lines).toContain('Sitemap: https://plotline.fit/sitemap.xml')
    expect(lines).toContain('User-agent: *')
    expect(lines).toContain('Allow: /')
    expect(lines.some((l) => /^Disallow:\s*\/\S*/i.test(l))).toBe(false)
  })
})

describe('public/og-paddle-stack.jpg (T5.6)', () => {
  it('exists and is a JPEG', () => {
    expect(existsSync(file('og-paddle-stack.jpg'))).toBe(true)
    const buf = readFileSync(file('og-paddle-stack.jpg'))
    expect([buf[0], buf[1], buf[2]]).toEqual([0xff, 0xd8, 0xff])
  })

  it('is 1200×630, the size the page head declares', () => {
    const buf = readFileSync(file('og-paddle-stack.jpg'))
    expect(jpegSize(buf)).toEqual([1200, 630])
  })

  it('stays under Facebook’s 8 MB limit for share images', () => {
    expect(readFileSync(file('og-paddle-stack.jpg')).byteLength).toBeLessThan(8 * 1024 * 1024)
  })
})
