import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E · longarch-admin-next
 * ============================================================
 *  运行前: npm run dev (http://localhost:5175)
 *  运行:   npx playwright test
 * ============================================================ */
export default defineConfig({
  testDir: './e2e',
  // Dev server (Vite) + 本地后端联调，过高并发会导致偶发 page.goto 超时
  workers: 1,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
