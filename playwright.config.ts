import { defineConfig, devices } from '@playwright/test'
import { engines, viewports, type Engine, type ViewportName } from './e2e/matrix.ts'

// `npm run test:e2e`: every engine × viewport in the device matrix (TASKS.md, Milestone 8), against `vite preview`.
// Kept out of `npm run verify` and the Stop-hook gate: the browsers are a large download and slow the gate.
// One-time setup: `npx playwright install chromium webkit firefox`.

const desktop: Record<Engine, (typeof devices)[string]> = {
  chromium: devices['Desktop Chrome'],
  webkit: devices['Desktop Safari'],
  firefox: devices['Desktop Firefox'],
}

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // The live stack specs run with `npm run test:live` (playwright.live.config.ts).
  testIgnore: 'live/**',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: engines.flatMap((engine) =>
    (Object.keys(viewports) as ViewportName[]).map((name) => ({
      name: `${engine}-${name}`,
      use: { ...desktop[engine], viewport: { ...viewports[name] } },
    })),
  ),
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
