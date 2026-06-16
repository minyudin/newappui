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

test('adoption wizard layout screenshot', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await loginAsAdmin(context)
  const page = await context.newPage()
  await page.goto(`${BASE}/adoptions/new`)
  await expect(page.getByTestId('wizard-submit')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/shots/09-wizard.png', fullPage: false })
  await context.close()
})

