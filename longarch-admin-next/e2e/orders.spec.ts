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

test.describe('§3 Orders · 认养订单', () => {
  test('页头 + 筛选 + 表格骨架', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/orders`)
    await expect(page.locator('.folio-page__seal')).toContainText('§3 · Orders')
    await expect(page.locator('.folio-page__title')).toContainText('Adoption Orders')
    await expect(page.getByTestId('orders-filter')).toBeVisible()
    await expect(page.getByTestId('orders-table')).toBeVisible()
    await context.close()
  })

  test('GET /admin/adoption-orders 正常返回', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    const req = page.waitForResponse(
      (r) => r.url().includes('/admin/adoption-orders') && r.status() === 200,
    )
    await page.goto(`${BASE}/orders`)
    const res = await req
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('list')
    expect(json.data).toHaveProperty('total')
    await context.close()
  })

  test('状态筛选 orderStatus=active 拦到请求', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/orders`)
    await page.waitForLoadState('networkidle')

    const req = page.waitForRequest(
      (r) => r.url().includes('/admin/adoption-orders') && r.url().includes('orderStatus=active'),
    )
    await page.locator('#orders-filter-status').click()
    await page.getByRole('option', { name: /进行中/ }).click()
    await req
    await context.close()
  })

  test('新建订单 Dialog 含全部必填字段', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/orders`)
    await page.getByTestId('orders-create-trigger').click()
    await expect(page.locator('#order-plot-id')).toBeVisible()
    await expect(page.locator('#order-start')).toBeVisible()
    await expect(page.locator('#order-end')).toBeVisible()
    await context.close()
  })

  test('新建 · 空必填触发 warning', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/orders`)
    await page.getByTestId('orders-create-trigger').click()
    await page.getByTestId('orders-create-submit').click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('必填')
    await context.close()
  })
})
