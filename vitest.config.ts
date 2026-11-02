import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
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
