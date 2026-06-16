import { test, expect, type BrowserContext } from '@playwright/test'

/**
 * E2E · P4 UI Kit · 基础组件改皮验证
 * ============================================================
 *  断言原则 (莫兰迪):
 *    · 无圆角 (border-radius 0)
 *    · 无阴影 (box-shadow none)
 *    · hairline 边框 (1px solid)
 *    · 主色 sage #9FB58E = rgb(159,181,142)
 *    · 告警 clay #C5826A = rgb(197,130,106)
 * ============================================================ */

const BASE = 'http://localhost:5175'
const SAGE = 'rgb(159, 181, 142)'
const CLAY = 'rgb(197, 130, 106)'
const PAPER_LIGHT = 'rgb(241, 239, 234)'

async function seedAuth(context: BrowserContext) {
  // Cookie-First 重构后, JS 无法写入 satoken cookie (HttpOnly)
  // 改用 mock /users/me 让 AuthBootstrap 探测成功, RouteGuard 自动放行
  // AppShell 启动时会调 /users/me, 这里 mock 一个假的 admin userInfo, 避免假 token 被 40002 打回
  await context.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          userId: 0, userNo: 'U-MOCK', nickname: '测试管理员',
          roleType: 'admin', status: 1, bindMobile: true,
          roleProfile: { roleName: '平台管理员', roleDesc: 'mock' },
        },
      }),
    }),
  )
}

test.describe('§P4 · UI Kit 渲染', () => {
  test('/ui-kit 页面结构完整 (8 个 section 都在)', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    await expect(page.locator('.folio-page__seal')).toContainText('§UI · Kit')
    await expect(page.locator('.folio-page__title')).toContainText('UI Kit')

    for (const id of [
      'kit-buttons',
      'kit-input',
      'kit-badges',
      'kit-card',
      'kit-dialog',
      'kit-select',
      'kit-table',
      'kit-toast',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
    await context.close()
  })

  test('Button primary 使用莫兰迪绿 · 无圆角', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const btn = page.getByTestId('kit-buttons').getByRole('button', { name: 'Primary' })
    const style = await btn.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { bg: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow }
    })
    expect(style.bg).toBe(SAGE)
    expect(style.radius).toBe('0px')
    expect(style.shadow === 'none' || style.shadow === '').toBeTruthy()
    await context.close()
  })

  test('Button danger 使用砖红 clay', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const btn = page.getByTestId('kit-buttons').getByRole('button', { name: 'Danger' })
    const bg = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bg).toBe(CLAY)
    await context.close()
  })

  test('Input hairline · 无圆角 · 声明 focus:border-sage 类', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const input = page.locator('#kit-input-sample')
    const info = await input.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return {
        w: s.borderTopWidth,
        style: s.borderTopStyle,
        radius: s.borderRadius,
        className: el.className,
      }
    })
    // 基线 · 1px hairline · 无圆角
    expect(info.w).toBe('1px')
    expect(info.style).toBe('solid')
    expect(info.radius).toBe('0px')
    // 声明了 focus 态切换至 sage (Tailwind v4 nested :focus 规则)
    expect(info.className).toContain('focus:border-sage')
    expect(info.className).toContain('border-line')
    await context.close()
  })

  test('Badge 7 tone 全部渲染 + 无圆角', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const badges = page.getByTestId('kit-badges').locator('span')
    await expect(badges).toHaveCount(7)
    const radii = await badges.evaluateAll((els) =>
      els.map((el) => window.getComputedStyle(el).borderRadius),
    )
    for (const r of radii) expect(r).toBe('0px')
    await context.close()
  })

  test('Card hairline · 无阴影', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const card = page.getByTestId('kit-card').locator('.border.border-line').first()
    const style = await card.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { w: s.borderTopWidth, radius: s.borderRadius, shadow: s.boxShadow }
    })
    expect(style.w).toBe('1px')
    expect(style.radius).toBe('0px')
    expect(style.shadow === 'none' || style.shadow === '').toBeTruthy()
    await context.close()
  })

  test('Dialog Radix portal · 打开后 Title / Footer 都存在', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    await page.getByTestId('kit-dialog-trigger').click()
    const content = page.getByTestId('kit-dialog-content')
    await expect(content).toBeVisible()
    await expect(content).toContainText('Archive this record?')
    await expect(content).toContainText('§ FORM · confirm')
    await expect(content.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(content.getByRole('button', { name: 'Archive' })).toBeVisible()

    // 关闭
    await content.getByRole('button', { name: 'Cancel' }).click()
    await expect(content).not.toBeVisible()
    await context.close()
  })

  test('Select 打开下拉 · 切换值', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    await page.getByTestId('kit-select-trigger').click()
    const content = page.getByTestId('kit-select-content')
    await expect(content).toBeVisible()
    await content.getByText('运营人员 · Operator').click()
    await expect(page.locator('text=CURRENT: operator')).toBeVisible()
    await context.close()
  })

  test('Table 渲染 3 行 + Pagination 显示 42 entries', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    const table = page.getByTestId('kit-table')
    await expect(table.locator('tbody tr')).toHaveCount(3)
    await expect(table).toContainText('42 entries · page')

    // 第二页
    await page.getByLabel('Next page').click()
    await expect(table).toContainText('page 02')
    await context.close()
  })

  test('Toast success 弹出后可见', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    await page.getByTestId('kit-toast-success').click()
    await expect(page.locator('[data-sonner-toast]')).toBeVisible()
    await expect(page.locator('[data-sonner-toast]')).toContainText('signed in')
    await context.close()
  })

  test('Toaster 背景为 paper-light + hairline', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/ui-kit`)

    await page.getByTestId('kit-toast-error').click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()

    const style = await toast.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return {
        bg: s.backgroundColor,
        w: s.borderTopWidth,
        style: s.borderTopStyle,
        radius: s.borderRadius,
      }
    })
    expect(style.bg).toBe(PAPER_LIGHT)
    expect(style.w).toBe('1px')
    expect(style.style).toBe('solid')
    expect(style.radius).toBe('0px')
    await context.close()
  })
})
