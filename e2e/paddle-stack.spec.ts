// `/paddle-stack` in every device-matrix project, both themes (TASKS.md T8.1): the start screen, a started board,
// TV mode (only in the `*-pc` projects, 1920×1080) and the `?tv=1` window; T8.3 adds a singles board and TV with a title;
// T8.5 the full start screen (name chips with levels, fixed pairs, the format grid: one column below 820 px, two from 820);
// T8.6 the TV's logo, court bands with a last result, and who's on a break.
import { expect, test, type Page } from '@playwright/test'
import { checkPage, setTheme, stubNetwork, watch } from './helpers.ts'
import { themes, tvViewport } from './matrix.ts'

const NAMES = ['Ana', 'Ben', 'Carla', 'Dante', 'Ella', 'Felix', 'Gia', 'Hugo', 'Ines', 'Jun'].join('\n')

const startCards = '.formcard.stack-start, .stack-guide-grid > *, .stack-faq'
const boardCards = '.stack-title, .stack-courts > *, .stack-line, .stack-standings, .stack-actions'
const tvCards = '.stack-tv-logo, .stack-tv-title, .stack-tv-banner, .stack-tv-courts > *, .stack-tv-bottom'
const tvJoinCards = '.stack-tv-logo, .stack-tv-title, .stack-tv-courts > *, .stack-tv-bottom-main, .stack-tv-qr'
const TITLE = 'Sunday Open Play (ALL LEVELS)'

async function open(page: Page, theme: (typeof themes)[number], path = '/paddle-stack') {
  watch(page)
  await stubNetwork(page)
  await setTheme(page, theme)
  await page.goto(path)
}

async function startStack(page: Page, opts: { singles?: boolean; title?: string } = {}) {
  if (opts.title) await page.getByRole('textbox', { name: 'Game title (optional)' }).fill(opts.title)
  if (opts.singles) await page.getByRole('radio', { name: 'Singles' }).check()
  await page.getByRole('textbox', { name: 'Players' }).fill(NAMES)
  await page.getByRole('button', { name: 'Start the stack' }).click()
  await page.getByRole('button', { name: 'TV mode' }).waitFor()
}

const isTvProject = (projectName: string) => projectName.endsWith(`-${tvViewport}`)

for (const theme of themes) {
  test.describe(`paddle stack, ${theme}`, () => {
    test('start screen', async ({ page }, testInfo) => {
      await open(page, theme)
      await page.getByRole('button', { name: 'Start the stack' }).waitFor()
      await checkPage(page, testInfo, { name: `stack-start-${theme}`, cards: startCards })
    })

    test('start screen with players, levels and fixed pairs', async ({ page }, testInfo) => {
      await open(page, theme)
      await page.getByRole('textbox', { name: 'Players' }).fill(NAMES)
      await page.getByRole('combobox', { name: 'Level for Ana' }).selectOption({ label: 'Advanced' })
      await page.getByRole('radio', { name: 'Fixed pairs' }).check()
      await page.getByRole('group', { name: 'Pair 5' }).waitFor()
      const columns = await page
        .locator('.stack-formats')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length)
      const width = page.viewportSize()?.width ?? 0
      expect(columns).toBe(width >= 820 ? 2 : 1)
      await checkPage(page, testInfo, { name: `stack-start-full-${theme}`, cards: '.stack-formats > *, .stack-pairs > li, .stack-format-details' })
    })

    test('started board', async ({ page }, testInfo) => {
      await open(page, theme)
      await startStack(page)
      await checkPage(page, testInfo, { name: `stack-board-${theme}`, cards: boardCards })
    })

    test('started singles board with a title', async ({ page }, testInfo) => {
      await open(page, theme)
      await startStack(page, { singles: true, title: TITLE })
      await page.locator('.stack-title').waitFor()
      await checkPage(page, testInfo, { name: `stack-board-singles-${theme}`, cards: boardCards })
    })

    test('singles TV mode with a title', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page, { singles: true, title: TITLE })
      await page.getByRole('button', { name: 'TV mode' }).click()
      await page.locator('.stack-tv-title').waitFor()
      await checkPage(page, testInfo, { name: `stack-tv-singles-${theme}`, cards: tvCards })
    })

    test('TV mode', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page)
      await page.getByRole('button', { name: 'TV mode' }).click()
      await page.getByRole('button', { name: 'Exit TV mode' }).waitFor()
      await checkPage(page, testInfo, { name: `stack-tv-${theme}`, cards: tvCards })
    })

    test('TV mode with a last result and a break', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page, { title: TITLE })
      const court1 = page.getByRole('region', { name: 'Court 1' })
      await court1.getByRole('button', { name: 'Enter score' }).click()
      const boxes = court1.getByRole('textbox')
      await boxes.nth(0).fill('11')
      await boxes.nth(1).fill('7')
      await court1.getByRole('button', { name: 'Save score' }).click()
      const upNext = page.getByRole('region', { name: 'Up next' })
      await upNext.getByRole('button', { name: /Time out/ }).first().click()
      await page.getByRole('button', { name: 'TV mode' }).click()
      await expect(page.locator('.stack-tv-logo img')).toBeVisible()
      await expect(page.locator('.stack-tv-last').first()).toHaveText('Last game 11–7')
      await expect(page.locator('.stack-tv-break')).toBeVisible()
      await checkPage(page, testInfo, { name: `stack-tv-results-${theme}`, cards: tvCards })
    })

    test('the ?tv=1 window', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page)
      // Let the stack font finish first: navigating mid-download makes Firefox log the aborted woff2 as an error.
      await page.evaluate(() => document.fonts.ready)
      // The window reads the stack this browser saved, like the one "Open TV in a new window" opens.
      await page.goto('/paddle-stack?tv=1')
      await page.locator('.stack-tv').waitFor()
      await checkPage(page, testInfo, { name: `stack-tv-window-${theme}`, cards: tvCards })
    })

    // T6.6: with a live key on this device the TV's bottom slot shows the join QR and short link. Nothing is
    // published until the board changes, so no backend is needed.
    test('TV mode and the ?tv=1 window with the join QR', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page, { title: TITLE })
      await page.evaluate(() => {
        localStorage.setItem('plotline.paddle-stack.live', JSON.stringify({ code: 'k7m2q9', secret: 's', version: 0 }))
        return document.fonts.ready
      })
      await page.goto('/paddle-stack?tv=1')
      const slot = page.locator('.stack-tv-qr')
      await expect(slot.locator('canvas')).toBeVisible()
      await expect(slot).toContainText('/paddle-stack/live/k7m2q9')
      await checkPage(page, testInfo, { name: `stack-tv-join-window-${theme}`, cards: tvJoinCards })
      await page.goto('/paddle-stack')
      await page.getByRole('button', { name: 'TV mode' }).click()
      await expect(page.locator('.stack-tv-qr canvas')).toBeVisible()
      await checkPage(page, testInfo, { name: `stack-tv-join-${theme}`, cards: tvJoinCards })
    })

    // T6.6: below 640 px the TV board has no room for the QR, so the slot stays hidden even while live.
    test('the ?tv=1 window hides the join QR below 640 px', async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) >= 640, 'only for phone widths')
      await open(page, theme)
      await startStack(page)
      await page.evaluate(() => {
        localStorage.setItem('plotline.paddle-stack.live', JSON.stringify({ code: 'k7m2q9', secret: 's', version: 0 }))
        return document.fonts.ready
      })
      await page.goto('/paddle-stack?tv=1')
      await page.locator('.stack-tv').waitFor()
      await expect(page.locator('.stack-tv-qr canvas')).toBeAttached()
      await expect(page.locator('.stack-tv-qr')).toBeHidden()
    })
  })
}
