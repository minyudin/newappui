import { test, expect, type BrowserContext } from '@playwright/test'

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

test('orders filter layout screenshot', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await loginAsAdmin(context)
  const page = await context.newPage()
  await page.goto(`${BASE}/orders`)
  await expect(page.getByTestId('orders-filter')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/shots/orders-filter.png', fullPage: false })
  await context.close()
})

