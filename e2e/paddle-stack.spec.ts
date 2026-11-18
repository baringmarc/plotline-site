// `/paddle-stack` in every device-matrix project, both themes (TASKS.md T8.1): the start screen, a started board,
// TV mode (only in the `*-pc` projects, 1920×1080) and the `?tv=1` window.
import { test, type Page } from '@playwright/test'
import { checkPage, setTheme, stubNetwork, watch } from './helpers.ts'
import { themes, tvViewport } from './matrix.ts'

const NAMES = ['Ana', 'Ben', 'Carla', 'Dante', 'Ella', 'Felix', 'Gia', 'Hugo', 'Ines', 'Jun'].join('\n')

const startCards = '.formcard.stack-start, .stack-guide-grid > *, .stack-faq'
const boardCards = '.stack-courts > *, .stack-line, .stack-standings, .stack-actions'
const tvCards = '.stack-tv-courts > *, .stack-tv-next, .stack-tv-banner'

async function open(page: Page, theme: (typeof themes)[number], path = '/paddle-stack') {
  watch(page)
  await stubNetwork(page)
  await setTheme(page, theme)
  await page.goto(path)
}

async function startStack(page: Page) {
  await page.getByRole('textbox').fill(NAMES)
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

    test('started board', async ({ page }, testInfo) => {
      await open(page, theme)
      await startStack(page)
      await checkPage(page, testInfo, { name: `stack-board-${theme}`, cards: boardCards })
    })

    test('TV mode', async ({ page }, testInfo) => {
      test.skip(!isTvProject(testInfo.project.name), 'the TV board runs only at 1920×1080')
      await open(page, theme)
      await startStack(page)
      await page.getByRole('button', { name: 'TV mode' }).click()
      await page.getByRole('button', { name: 'Exit TV mode' }).waitFor()
      await checkPage(page, testInfo, { name: `stack-tv-${theme}`, cards: tvCards })
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
  })
}
