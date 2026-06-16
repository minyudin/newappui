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

test.describe('§4 Codes · 认养码', () => {
  test('页头 + 筛选 + 表格骨架', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/codes`)
    await expect(page.locator('.folio-page__seal')).toContainText('§4 · Codes')
    await expect(page.locator('.folio-page__title')).toContainText('Adoption Codes')
    await expect(page.getByTestId('codes-filter')).toBeVisible()
    await expect(page.getByTestId('codes-table')).toBeVisible()
    await context.close()
  })

  test('GET /admin/adoption-codes 正常返回', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    const req = page.waitForResponse(
      (r) => r.url().includes('/admin/adoption-codes') && r.status() === 200,
    )
    await page.goto(`${BASE}/codes`)
    const res = await req
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('list')
    await context.close()
  })

  test('状态筛选 status=revoked 拦到请求', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/codes`)
    await expect(page.getByTestId('codes-filter')).toBeVisible()
    const req = page.waitForRequest(
      (r) => r.url().includes('/admin/adoption-codes') && r.url().includes('status=revoked'),
    )
    await page.locator('#codes-filter-status').click()
    await page.getByRole('option', { name: /已吊销/ }).click()
    await req
    await context.close()
  })

  test('生成认养码 Dialog 含全部必填', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/codes`)
    await page.getByTestId('codes-create-trigger').click()
    await expect(page.locator('#code-order-id')).toBeVisible()
    await expect(page.locator('#code-valid-from')).toBeVisible()
    await expect(page.locator('#code-valid-to')).toBeVisible()
    await context.close()
  })

  test('生成 · 空必填触发 warning', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/codes`)
    await page.getByTestId('codes-create-trigger').click()
    await page.getByTestId('codes-create-submit').click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('必填')
    await context.close()
  })
})
