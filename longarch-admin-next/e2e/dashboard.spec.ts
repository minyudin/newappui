import { test, expect, type BrowserContext } from '@playwright/test'

/**
 * E2E · §1 Dashboard
 * ============================================================
 *  前置: longarch-server 已启动
 *  路径: 先用 admin_openid 登录拿真 token, 再访问 /dashboard
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

test.describe('§1 Dashboard · 运营工作台', () => {
  test('页头 seal / 标题渲染', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    await expect(page.locator('.folio-page__seal')).toContainText('§1 · Today')
    await expect(page.locator('.folio-page__title')).toContainText('Dashboard')
    await expect(page.locator('.folio-page__title-cn')).toHaveText('仪表盘')
    // 页头右侧提示 LIVE/LOADING + ALERTS
    await expect(page.locator('.folio-page__head-right')).toContainText(/ALERTS/)
    await context.close()
  })

  test('6 张 KPI 卡全部渲染 + 拉到真实数字', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    const kpi = page.getByTestId('dashboard-kpi')
    await expect(kpi).toBeVisible()
    // Dashboard 并行 Promise.all([6 个 API]) 后 setKpi, 任一格拿到数字即所有都到齐
    for (const k of ['users', 'orders', 'codes', 'plots', 'devices', 'tasks']) {
      const cell = page.getByTestId(`dashboard-kpi-${k}`)
      // 新版 KPI 是 <Link>, 数字在子 div 里
      await expect(cell.locator('div').first()).toHaveText(/^\d+$/, {
        timeout: 10_000,
      })
    }
    await context.close()
  })

  test('异常清单三列渲染 · 有数据或空态', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    const alerts = page.getByTestId('dashboard-alerts')
    await expect(alerts).toBeVisible()
    // 三个告警类别必须都在
    await expect(alerts).toContainText('传感器离线')
    await expect(alerts).toContainText('设备锁定')
    await expect(alerts).toContainText('任务失败')
    await context.close()
  })

  test('任务饼图与最近任务同时展示', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    // 今日动态区
    const today = page.getByTestId('dashboard-today')
    await expect(today).toBeVisible()
    await expect(today).toContainText('任务状态分布')
    await expect(today).toContainText('最近任务')

    const chartTasks = page.getByTestId('dashboard-chart-tasks')
    await expect(chartTasks).toBeVisible()

    // 等 API 完成后, 若有任务 → canvas, 若无 → 空态文字
    await page.waitForLoadState('networkidle')
    const tasksHasChart = await chartTasks.locator('canvas').count()
    if (tasksHasChart === 0) {
      await expect(chartTasks).toContainText(/暂无|Loading/)
    }
    await context.close()
  })

  test('快捷入口 4 个链接', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    const shortcuts = page.getByTestId('dashboard-shortcuts')
    await expect(shortcuts).toBeVisible()
    // 至少 4 个链接 (a[href])
    const links = shortcuts.locator('a[href]')
    await expect(links).toHaveCount(4)
    await context.close()
  })

  test('KPI 区域无圆角无阴影 (莫兰迪原则)', async ({ browser }) => {
    const context = await browser.newContext()
    await loginAsAdmin(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/dashboard`)

    const kpiContainer = page.getByTestId('dashboard-kpi').locator('.border.border-line').first()
    const style = await kpiContainer.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { radius: s.borderRadius, shadow: s.boxShadow, w: s.borderTopWidth }
    })
    expect(style.radius).toBe('0px')
    expect(style.shadow === 'none' || style.shadow === '').toBeTruthy()
    expect(style.w).toBe('1px')
    await context.close()
  })
})
