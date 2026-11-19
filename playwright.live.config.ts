import { defineConfig, devices } from '@playwright/test'

// `npm run test:live`: the live stack specs (TASKS.md, Milestone 6) against court-booking-system's local stack
// (`npx supabase start` there). `smoke.spec.ts` calls its Edge Function and RPCs from Node; `organizer.spec.ts` drives
// a build made with `.env.live` (the local stack's URL and key) in Chromium. The device matrix (`playwright.config.ts`,
// the `.env` build on port 4173) stays as it is. Kept out of `npm run verify` and the Stop-hook gate, like the matrix.
const LIVE_PORT = 4174

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
  projects: [
    { name: 'live', testMatch: 'smoke.spec.ts' },
    {
      name: 'live-browser',
      testMatch: ['organizer.spec.ts', 'handoff.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${LIVE_PORT}` },
    },
  ],
  webServer: {
    command: `npx vite build --mode live --outDir dist-live && npx vite preview --outDir dist-live --port ${LIVE_PORT} --strictPort`,
    url: `http://localhost:${LIVE_PORT}/paddle-stack`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
