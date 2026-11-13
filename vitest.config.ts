import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // The guard's tests (.claude/hooks) run with the app's, so `npm run verify` covers the harness too.
      include: ['src/**/*.test.{ts,tsx}', '.claude/hooks/**/*.test.ts'],
      // Vitest blanks stylesheets by default, including `?raw` imports; a test reads global.css as text.
      css: { include: [/global\.css/] },
      // Dummy values so modules importing lib/supabase.ts load. Tests must mock network calls.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:55321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      },
    },
  }),
)
