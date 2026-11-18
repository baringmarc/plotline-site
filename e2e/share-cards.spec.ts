// T8.7 share cards in every device-matrix project, both themes: the preview dialog for a player's card and the group
// card (no sideways scroll, no overlap, no console errors, a screenshot each), and the network log while making and
// sharing a card with an uploaded photo: nothing may leave the page (TASKS.md T8.7 Acceptance).
import { fileURLToPath } from 'node:url'
import { expect, test, type Page, type Request } from '@playwright/test'
import { checkPage, setTheme, stubNetwork, watch } from './helpers.ts'
import { themes } from './matrix.ts'

const NAMES = ['Ana', 'Ben', 'Carla', 'Dante', 'Ella', 'Felix', 'Gia', 'Hugo', 'Ines', 'Jun'].join('\n')
const PHOTO = fileURLToPath(new URL('../public/demo/court-1.jpg', import.meta.url))
// The Share/Close bar is left out: it sticks to the bottom over the options on a phone, on purpose (opaque background).
const dialogCards = '.stack-card-preview, .stack-card-options'

async function scoredBoard(page: Page, theme: (typeof themes)[number]) {
  watch(page)
  await stubNetwork(page)
  await setTheme(page, theme)
  await page.goto('/paddle-stack')
  await page.getByRole('textbox', { name: 'Game title (optional)' }).fill('Sunday Open Play')
  await page.getByRole('textbox', { name: 'Players' }).fill(NAMES)
  await page.getByRole('button', { name: 'Start the stack' }).click()
  const court1 = page.getByRole('region', { name: 'Court 1' })
  await court1.getByRole('button', { name: 'Enter score' }).click()
  const boxes = court1.getByRole('textbox')
  await boxes.nth(0).fill('11')
  await boxes.nth(1).fill('7')
  await court1.getByRole('button', { name: 'Save score' }).click()
  await page.getByRole('button', { name: 'Share standings' }).waitFor()
}

async function previewReady(page: Page) {
  const img = page.getByRole('dialog', { name: 'Share a card' }).getByRole('img', { name: 'Preview of the card' })
  // Encoding a 1080×1920 PNG takes about a second in headless browsers, longer with the matrix running in parallel.
  await expect(img).toHaveAttribute('src', /^blob:/, { timeout: 20_000 })
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true)
}

for (const theme of themes) {
  test.describe(`share cards, ${theme}`, () => {
    test('player card preview', async ({ page }, testInfo) => {
      await scoredBoard(page, theme)
      await page.getByRole('button', { name: /^Share card for / }).first().click()
      await previewReady(page)
      await checkPage(page, testInfo, { name: `stack-card-player-${theme}`, cards: dialogCards })
    })

    test('group card preview, post size', async ({ page }, testInfo) => {
      await scoredBoard(page, theme)
      await page.getByRole('button', { name: 'Share standings' }).click()
      await page.getByRole('radio', { name: 'Post' }).check()
      await previewReady(page)
      await checkPage(page, testInfo, { name: `stack-card-group-${theme}`, cards: dialogCards })
    })
  })
}

test('no network request while making and sharing a card, uploaded photo included', async ({ page }) => {
  // Download, not the share sheet, so the run ends the same way in every engine.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await scoredBoard(page, 'light')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))

  const requests: string[] = []
  const onRequest = (r: Request) => {
    const url = r.url()
    if (!url.startsWith('blob:') && !url.startsWith('data:')) requests.push(`${r.method()} ${url}`)
  }
  page.on('request', onRequest)

  await page.getByRole('button', { name: /^Share card for / }).first().click()
  await previewReady(page)
  await page.getByLabel('Use your own photo').setInputFiles(PHOTO)
  await expect(page.getByRole('radio', { name: 'Your photo' })).toBeChecked()
  await page.getByRole('slider', { name: 'Darken the photo' }).fill('70')
  await page.getByRole('radio', { name: 'Post' }).check()
  await previewReady(page)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^paddle-stack-.+\.png$/)

  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Share standings' }).click()
  await previewReady(page)

  page.off('request', onRequest)
  expect(requests).toEqual([])
})

// T8.7b: arranging the player card with a real pointer (mouse here; touch is the user's by-eye check), in every
// project and both themes: drag the date, pick the List look, remove a part, and the layout comes back on reopening.
// No network request throughout (TASKS.md T8.7b Acceptance).
for (const theme of themes) {
  test(`arrange the player card, ${theme}`, async ({ page }, testInfo) => {
    await scoredBoard(page, theme)
    const requests: string[] = []
    page.on('request', (r: Request) => {
      const url = r.url()
      if (!url.startsWith('blob:') && !url.startsWith('data:')) requests.push(`${r.method()} ${url}`)
    })
    await page.getByRole('button', { name: /^Share card for / }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Share a card' })
    await previewReady(page)

    const date = dialog.getByRole('button', { name: 'Pick Date' })
    const before = (await date.boundingBox())!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2 + 60, { steps: 6 })
    await page.mouse.up()
    await expect(date).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await date.boundingBox())!.y).toBeGreaterThan(before.y + 20)

    await dialog.getByRole('button', { name: 'Pick Player card' }).click()
    await dialog.getByRole('button', { name: 'Remove Best streak' }).click()
    await dialog.getByRole('radio', { name: 'List' }).check()
    await dialog.getByRole('slider', { name: 'Card background' }).fill('80')
    await previewReady(page)
    await checkPage(page, testInfo, { name: `stack-card-arranged-${theme}`, cards: dialogCards })

    await dialog.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: /^Share card for / }).nth(1).click()
    await previewReady(page)
    await expect(dialog.getByRole('radio', { name: 'List' })).toBeChecked()
    await expect(dialog.getByRole('group', { name: 'Removed' }).getByRole('button', { name: 'Add Best streak back' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Reset layout' }).click()
    await expect(dialog.getByRole('radio', { name: 'Default' })).toBeChecked()
    expect(requests).toEqual([])
  })
}
