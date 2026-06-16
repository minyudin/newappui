import { test, expect } from '@playwright/test'

/**
 * E2E · P3 AppShell + Routing + Morandi visual (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  Token 已迁移到 HttpOnly cookie, JS 读不到, 所以 seedAuth 不再写 localStorage
 *  改用 mock /users/me: AuthBootstrap 探测成功 → setUserInfo → RouteGuard 放行
 * ============================================================ */

const BASE = 'http://localhost:5175'
const PAPER = 'rgb(232, 232, 229)' // $paper #e8e8e5
const INK = 'rgb(45, 42, 38)'       // $ink #2d2a26

// ---- 注入已登录态 (绕过 RouteGuard, 无需真后端) ----
async function seedAuth(context: import('@playwright/test').BrowserContext) {
  // AuthBootstrap 启动探测 /users/me, mock 返回一个假的 admin userInfo
  // 这样无需真 cookie 即可通过 RouteGuard
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

test.describe('§0 LoginPage · 未登录入口', () => {
  test('访问 / 自动重定向到 /login', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page).toHaveURL(/\/login$/)
  })

  test('/login 渲染品牌标题 · 中文为"陇上" (非生造词)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('.login-card__seal')).toContainText(/ADMIN/i)
    await expect(page.locator('.login-card__title')).toContainText('Longarch')
    await expect(page.locator('.login-card__title-cn')).toContainText('陇上')
    // 确保不再出现过去的"龙拱"生造词
    await expect(page.locator('.login-card__title-cn')).not.toContainText('龙')
  })

  test('/login 显示 mobile + password 表单 · 不再有 dev 账号卡', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.getByTestId('login-mobile')).toBeVisible()
    await expect(page.getByTestId('login-password')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
    await expect(page.locator('.account-row')).toHaveCount(0)
    // section 标题应提到"账号登录"
    await expect(page.locator('.login-card__section-title')).toContainText(/账号登录/)
  })

  test('/login footer 不泄露锁定策略 (生产安全)', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const footerText = await page.locator('.login-card__foot').textContent()
    expect(footerText).not.toContain('5×')
    expect(footerText).not.toMatch(/locked\s+15/i)
    expect(footerText).not.toMatch(/failed\s+5/i)
  })

  test('莫兰迪基调: body 纸底 + ink 墨文字', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const bodyBg = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor,
    )
    const bodyColor = await page.evaluate(
      () => window.getComputedStyle(document.body).color,
    )
    expect(bodyBg).toBe(PAPER)
    expect(bodyColor).toBe(INK)
  })

  test('前端校验: 空表单不发请求', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    let hit = false
    page.on('request', (r) => {
      if (r.url().endsWith('/api/v1/auth/admin-login')) hit = true
    })
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-err')).toContainText(/手机号/)
    expect(hit).toBe(false)
  })

  test('填写 mobile + password 触发 POST /auth/admin-login', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const loginReq = page.waitForRequest(
      (req) =>
        req.url().endsWith('/api/v1/auth/admin-login') && req.method() === 'POST',
    )
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    const req = await loginReq
    const body = req.postDataJSON()
    expect(body).toEqual({ mobile: '15675201507', password: 'admin123456' })
  })
})

// ============================================================
//  §AppShell 的登录后壳断言移到 backend.spec.ts (真实登录, 避免 mock token 被后端 40002)
//  这里仅保留「未知路由 → NotFoundPage」这个不依赖后端的壳级路由断言
// ============================================================
test.describe('§AppShell · 未知路由', () => {
  test('未知路由走 NotFoundPage §404', async ({ browser }) => {
    const context = await browser.newContext()
    await seedAuth(context)
    const page = await context.newPage()
    await page.goto(`${BASE}/no-such-page`)
    await expect(page.locator('.folio-page__seal')).toContainText('§404')
    await expect(page.locator('.folio-page__title')).toContainText('Not Found')
    await context.close()
  })
})

test.describe('§Design · 纸本美学', () => {
  test('字体加载衬线 EB Garamond / Noto Serif SC', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const fontFamily = await page.locator('.login-card__title').evaluate(
      (el) => window.getComputedStyle(el).fontFamily,
    )
    expect(fontFamily.toLowerCase()).toMatch(/garamond|noto serif|serif/i)
  })

  test('hairline 边框 1px solid', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const border = await page.locator('.login-card').evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { w: s.borderTopWidth, style: s.borderTopStyle }
    })
    expect(border.w).toBe('1px')
    expect(border.style).toBe('solid')
  })

  test('login-card 无圆角 · 无阴影', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const box = await page.locator('.login-card').evaluate((el) => {
      const s = window.getComputedStyle(el)
      return { radius: s.borderRadius, shadow: s.boxShadow }
    })
    expect(box.radius).toBe('0px')
    expect(box.shadow === 'none' || box.shadow === '').toBeTruthy()
  })
})
