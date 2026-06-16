import { test, type BrowserContext } from '@playwright/test'

/**
 * Screenshot capture · 用于设计评审
 * 运行: npx playwright test e2e/screenshots.spec.ts
 * 产物: e2e/shots/*.png
 */

const BASE = 'http://localhost:5175'

async function loginAsAdmin(context: BrowserContext) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-mobile').fill('15675201507')
  await page.getByTestId('login-password').fill('admin123456')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/dashboard$/)
  await page.close()
}

test.describe('Design review snapshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('01 login empty', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'e2e/shots/01-login-empty.png', fullPage: false })
  })

  test('02 login filled', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'e2e/shots/02-login-filled.png', fullPage: false })
  })

  test('03 dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/dashboard`)
    await page.waitForTimeout(1500) // ECharts animation settle
    await page.screenshot({ path: 'e2e/shots/03-dashboard.png', fullPage: true })
    await ctx.close()
  })

  test('04 users', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/users`)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'e2e/shots/04-users.png', fullPage: false })
    await ctx.close()
  })

  test('05 plots', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/plots`)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'e2e/shots/05-plots.png', fullPage: false })
    await ctx.close()
  })

  test('06 ui-kit', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/ui-kit`)
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'e2e/shots/06-ui-kit.png', fullPage: true })
    await ctx.close()
  })

  test('07 device-overview', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/device-overview`)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'e2e/shots/07-device-overview.png', fullPage: true })
    await ctx.close()
  })

  test('08 tasks', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await loginAsAdmin(ctx)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tasks`)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'e2e/shots/08-tasks.png', fullPage: false })
    await ctx.close()
  })
})
