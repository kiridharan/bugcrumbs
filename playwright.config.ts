import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

/**
 * Real-browser tests against examples/vite-react, which consumes the built packages.
 * Uses the locally installed Chrome by default; set PW_CHANNEL= (empty) to use Playwright's
 * bundled Chromium instead (run `pnpm exec playwright install chromium` first, e.g. in CI).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    channel: process.env.PW_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm -F vite-react-example exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
