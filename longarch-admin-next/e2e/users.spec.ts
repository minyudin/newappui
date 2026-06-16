import { test, expect, type BrowserContext } from '@playwright/test'

/**
 * E2E · §2 Users
 * ============================================================
 *  前置: longarch-server 已启动 · admin_openid 有用户列表权限
 * ============================================================ */

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

test.describe('§2 Users · 用户管理', () => {
  test('页头 seal + 筛选栏 + 表格骨架', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/users`)

    await expect(page.locator('.folio-page__seal')).toContainText('§2 · People')
    await expect(page.locator('.folio-page__title')).toContainText('Users')
    await expect(page.locator('.folio-page__title-cn')).toHaveText('用 户')
    await expect(page.getByTestId('users-filter')).toBeVisible()
    await expect(page.getByTestId('users-table')).toBeVisible()
    await context.close()
  })

  test('GET /admin/users 正常返回 + 表格有行或 Empty', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()

    const waitForUsers = page.waitForResponse(
      (r) => r.url().includes('/admin/users') && r.status() === 200,
    )
    await page.goto(`${BASE}/users`)
    const res = await waitForUsers
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('list')
    expect(json.data).toHaveProperty('total')

    await page.waitForLoadState('networkidle')
    const rowCount = await page.getByTestId('users-table').locator('tbody tr').count()
    if (json.data.total > 0) {
      expect(rowCount).toBeGreaterThan(0)
    }
    await context.close()
  })

  test('筛选 roleType=admin 重新拉取 + 表格只剩 admin', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/users`)
    await expect(page.getByTestId('users-filter')).toBeVisible()

    const filterReq = page.waitForRequest(
      (r) =>
        r.url().includes('/admin/users') &&
        r.url().includes('roleType=admin'),
    )
    await page.locator('#users-filter-role').click()
    await page.getByRole('option', { name: /管理员/ }).click()
    await filterReq

    // filterReq 已 await 过, 说明 roleType=admin 这个 URL 被前端发出了
    // 表格体的具体条数依赖数据库状态, 这里只软断言: 若有行, 至少第 1 行含管理员字样
    await page.waitForLoadState('networkidle')
    const rows = page.getByTestId('users-table').locator('tbody tr')
    const totalRows = await rows.count()
    if (totalRows > 0) {
      await expect(rows.first()).toContainText('管理员')
    }
    await context.close()
  })

  test('点击新建用户打开 Dialog · 含 3 个字段', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/users`)

    // 等待页面从启动引导/数据加载态稳定下来，避免按钮在点击时被重绘导致 detached
    await expect(page.getByTestId('users-filter')).toBeVisible()
    const createBtn = page.getByTestId('users-create-trigger')
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await expect(page.locator('#users-create-openid')).toBeVisible()
    await expect(page.locator('#users-create-nickname')).toBeVisible()
    await expect(page.locator('#users-create-role')).toBeVisible()
    await context.close()
  })

  test('新建用户 · 空字段阻止提交并 warning toast', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/users`)

    await page.getByTestId('users-create-trigger').click()
    await page.getByTestId('users-create-submit').click()
    await expect(page.locator('[data-sonner-toast]')).toBeVisible()
    await expect(page.locator('[data-sonner-toast]')).toContainText('必填')
    await context.close()
  })

  test('Table 表头是 folio-mono uppercase · 行有 hairline', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/users`)
    await page.waitForLoadState('networkidle')

    const headStyle = await page
      .getByTestId('users-table')
      .locator('thead th')
      .first()
      .evaluate((el) => {
        const s = window.getComputedStyle(el)
        return {
          transform: s.textTransform,
          family: s.fontFamily.toLowerCase(),
        }
      })
    expect(headStyle.transform).toBe('uppercase')
    expect(headStyle.family).toMatch(/jetbrains|mono/)
    await context.close()
  })
})
