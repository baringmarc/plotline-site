// index.html's title and meta tags are what search results and link previews show for `/`,
// so they follow the same copy rules as the page (SPEC §3.1 "Pricing claims" and "Feature claims").
import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'

const head = [...html.matchAll(/<title>([^<]*)<\/title>|content="([^"]*)"/g)].map((m) => m[1] ?? m[2]).join(' | ')

describe('index.html', () => {
  it('has no trial, sign-up or plan wording', () => {
    expect(head).toContain('free for your venue')
    expect(head).not.toMatch(/trial|sign[ -]?ups?|\/month|per month|\bplans?\b/i)
  })

  it('has no amounts, which only the pricing config may set', () => {
    expect(head).not.toMatch(/₱\s?\d/)
  })
})
