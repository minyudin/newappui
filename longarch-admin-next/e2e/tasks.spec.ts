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

test.describe('§10 Tasks · 操作任务', () => {
  test('页头 + 筛选 + 表格骨架', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/tasks`)
    await expect(page.locator('.folio-page__seal')).toContainText('§10 · Tasks')
    await expect(page.locator('.folio-page__title')).toContainText('Operation Tasks')
    await expect(page.getByTestId('tasks-filter')).toBeVisible()
    await expect(page.getByTestId('tasks-table')).toBeVisible()
    await context.close()
  })

  test('GET /admin/operation-tasks 正常返回', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    const req = page.waitForResponse(
      (r) => r.url().includes('/admin/operation-tasks') && r.status() === 200,
    )
    await page.goto(`${BASE}/tasks`)
    const res = await req
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('list')
    await context.close()
  })

  test('状态筛选 taskStatus=executing 拦到请求', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/tasks`)
    await page.waitForLoadState('networkidle')
    const req = page.waitForRequest(
      (r) => r.url().includes('/admin/operation-tasks') && r.url().includes('taskStatus=executing'),
    )
    await page.locator('#tasks-filter-status').click()
    await page.getByRole('option', { name: /执行中/ }).click()
    await req
    await context.close()
  })

  test('6 个状态选项全部可见', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/tasks`)
    await page.locator('#tasks-filter-status').click()
    for (const cn of ['排队中', '执行中', '已完成', '失败', '已取消', '网络待确认']) {
      await expect(page.getByRole('option', { name: new RegExp(cn) })).toBeVisible()
    }
    await context.close()
  })
})
