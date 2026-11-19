import { defineConfig } from '@playwright/test'

// `npm run test:live`: the live stack specs (TASKS.md, Milestone 6) against court-booking-system's local stack
// (`npx supabase start` there). They call its Edge Function and RPCs directly, so there is no browser and no
// preview server, and the device matrix (`playwright.config.ts`, the `.env` build) stays as it is.
// Kept out of `npm run verify` and the Stop-hook gate, like the matrix.
export default defineConfig({
  testDir: 'e2e/live',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results-live',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  projects: [{ name: 'live' }],
})
