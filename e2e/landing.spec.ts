// `/` in every device-matrix project, both themes (TASKS.md T8.1).
import { test } from '@playwright/test'
import { checkPage, setTheme, stubNetwork, watch } from './helpers.ts'
import { themes } from './matrix.ts'

for (const theme of themes) {
  test(`landing page, ${theme}`, async ({ page }, testInfo) => {
    watch(page)
    await stubNetwork(page)
    await setTheme(page, theme)
    await page.goto('/')
    await page.getByRole('heading', { level: 1 }).waitFor()
    await page.waitForLoadState('networkidle')

    // The page's blocks (sections, one after another), then the cards inside them.
    await checkPage(page, testInfo, { name: `landing-${theme}`, cards: 'main > *' })
    await checkPage(page, testInfo, { name: `landing-cards-${theme}`, cards: '.card, .vcard' })
  })
}
