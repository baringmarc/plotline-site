// T8.2: Paddle Stack's display face (Bricolage Grotesque) loads on `/paddle-stack` only. The landing page's
// network log has no request for it, and the stack page really renders it (not a silent fallback).
/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { stubNetwork, watch } from './helpers.ts'

/** Every URL the page requests from now on. */
function logRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (req) => urls.push(req.url()))
  return urls
}

const isStackFont = (url: string) => /Bricolage/i.test(decodeURIComponent(url))

test('the landing page requests no Paddle Stack font', async ({ page }) => {
  watch(page)
  await stubNetwork(page)
  const urls = logRequests(page)
  await page.goto('/')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  expect(urls.length).toBeGreaterThan(0)
  expect(urls.filter(isStackFont)).toEqual([])
  expect(await page.locator('link[href*="Bricolage"]').count()).toBe(0)
})

test('/paddle-stack loads and renders Bricolage Grotesque', async ({ page }) => {
  watch(page)
  await stubNetwork(page)
  const urls = logRequests(page)
  await page.goto('/paddle-stack')
  await page.getByRole('button', { name: 'Start the stack' }).waitFor()
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)

  expect(urls.filter(isStackFont).length).toBeGreaterThan(0)
  const h1 = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)
  expect(h1).toMatch(/^"?Bricolage Grotesque/)
  const rendered = await page.evaluate(async () => {
    await document.fonts.load("800 32px 'Bricolage Grotesque'")
    return [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Bricolage Grotesque' && f.status === 'loaded')
  })
  expect(rendered).toBe(true)
})
