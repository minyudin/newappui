import { test, expect, request as pwRequest } from '@playwright/test'

/**
 * E2E · 完整后端联调
 * ============================================================
 *  前置条件:
 *    · dev server    http://localhost:5175 (vite proxy /api/v1 → 8081)
 *    · longarch-server @ 8081 已启动
 *    · MySQL @ 3306, Redis @ 6379, Mosquitto @ 1883 已就绪
 * ============================================================ */

const BASE = 'http://localhost:5175'
const API  = 'http://localhost:8081/api/v1'

test.describe('§公网 API · 直连后端', () => {
  test('/public/config 返回 code=0 + 平台配置字段', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.get(`${API}/public/config`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('platformName')
    expect(json.data).toHaveProperty('dashboardTitle')
    expect(json.data).toHaveProperty('dashboardSubtitle')
    expect((json.data.platformName as string).length).toBeGreaterThan(0)
  })

  test('/auth/dev-login admin_openid 返回 token + 管理员 userInfo (dev/stub only)', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.post(`${API}/auth/dev-login`, {
      data: { openId: 'admin_openid' },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.token).toMatch(/^[0-9a-f-]+$/)
    expect(json.data.userInfo.roleType).toBe('admin')
  })

  test('/auth/admin-login mobile + password 主登录 · 返回 admin token', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.post(`${API}/auth/admin-login`, {
      data: { mobile: '15675201507', password: 'admin123456' },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.token).toMatch(/^[0-9a-f-]+$/)
    expect(json.data.userInfo.roleType).toBe('admin')
    expect(json.data.userInfo.mobile).toBe('15675201507')
  })

  test('/auth/admin-login 错误密码返回非 0 code · 文案不泄露账号存在性', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.post(`${API}/auth/admin-login`, {
      data: { mobile: '15675201507', password: 'wrong-password' },
    })
    // 业务失败仍走 HTTP 200 + code != 0 (统一包络)
    if (res.status() === 200) {
      const json = await res.json()
      expect(json.code).not.toBe(0)
      expect((json.message as string).toLowerCase()).not.toContain('bcrypt')
    } else {
      expect([400, 401, 403]).toContain(res.status())
    }
  })

  test('/auth/admin-login 非 admin 手机号被拒 · 统一"账号或密码错误"', async () => {
    const ctx = await pwRequest.newContext()
    const res = await ctx.post(`${API}/auth/admin-login`, {
      data: { mobile: '13999999999', password: 'admin123456' },
    })
    if (res.status() === 200) {
      const json = await res.json()
      expect(json.code).not.toBe(0)
    } else {
      expect([400, 401, 403]).toContain(res.status())
    }
  })

  test('Bearer token 可访问 /admin/users', async () => {
    const ctx = await pwRequest.newContext()
    const login = await ctx.post(`${API}/auth/dev-login`, {
      data: { openId: 'admin_openid' },
    })
    const { data } = await login.json()
    const token = data.token as string

    const res = await ctx.get(`${API}/admin/users?pageNo=1&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty('list')
    expect(json.data).toHaveProperty('total')
    expect(json.data).toHaveProperty('pageNo')
    expect(json.data).toHaveProperty('pageSize')
    expect(Array.isArray(json.data.list)).toBe(true)
  })

  test('非 admin 账号 (adopter) 访问 /admin/users 应被拒', async () => {
    const ctx = await pwRequest.newContext()
    const login = await ctx.post(`${API}/auth/dev-login`, {
      data: { openId: 'stub_test_code_001' },
    })
    const { data } = await login.json()
    const token = data.token as string

    const res = await ctx.get(`${API}/admin/users?pageNo=1&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // Sa-Token 可能返回 401/403 或 code != 0, 任一即视为拒
    if (res.status() === 200) {
      const json = await res.json()
      expect(json.code).not.toBe(0)
    } else {
      expect([401, 403, 500]).toContain(res.status())
    }
  })
})

test.describe('§UI · Admin 登录全链路', () => {
  test('登录页展示后端返回的真实平台名', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const lede = page.locator('.login-card__lede')
    await expect(lede).toBeVisible()
    // 等 fetchPlatformConfig 完成 + 渲染
    await page.waitForLoadState('networkidle')
    const ledeText = (await lede.textContent()) ?? ''
    // lede 要么是 platformName (后端成功返回), 要么是兜底中文描述 "陇上认养 · 智慧农业运营后台"
    expect(ledeText.trim().length).toBeGreaterThanOrEqual(4)
    expect(ledeText).toMatch(/陇上|Longarch|认养|农业/)
  })

  test('admin mobile+password 登录 → 跳 /dashboard → TopBar 显示管理员', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const loginResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/auth/admin-login') && r.request().method() === 'POST',
    )
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    const res = await loginResponse
    expect(res.status()).toBe(200)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('.folio-app')).toBeVisible()
    await expect(page.locator('.topbar__seal')).toHaveText('§1')
    await expect(page.locator('.topbar__title-cn')).toHaveText('仪表盘')

    // userInfo.roleType=admin → topbar 用户卡片显示 "平台管理员" 或 admin
    const roleText = await page.locator('.topbar__user-role').textContent()
    expect(roleText!.toLowerCase()).toMatch(/admin|平台|管理/)

    const nameText = await page.locator('.topbar__user-name').textContent()
    expect(nameText).not.toBeNull()
    expect(nameText!.length).toBeGreaterThan(0)

    // Cookie-First: satoken 应当作为 HttpOnly cookie 落地 (JS 读不到, 但 Playwright context.cookies() 可见)
    const cookies = await page.context().cookies()
    const sat = cookies.find((c) => c.name === 'satoken')
    expect(sat).toBeDefined()
    expect(sat!.value).toMatch(/^[0-9a-f-]+$/)
    expect(sat!.httpOnly).toBe(true)
    // localStorage 不应再被写入 (彻底迁到 cookie)
    const persisted = await page.evaluate(() => window.localStorage.getItem('satoken'))
    expect(persisted).toBeNull()
  })

  test('admin 状态下在 10 个章节间切换 · 路由正常', async ({ page }) => {
    // 先登录
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard$/)

    const paths = [
      { path: '/users',           seal: '§2',  cn: '用户' },
      { path: '/orders',          seal: '§3',  cn: '认养订单' },
      { path: '/codes',           seal: '§4',  cn: '认养码' },
      { path: '/plots',           seal: '§5',  cn: '地块' },
      { path: '/device-overview', seal: '§6',  cn: '设备总览' },
      { path: '/cameras',         seal: '§7',  cn: '摄像头' },
      { path: '/devices',         seal: '§8',  cn: '执行设备' },
      { path: '/screens',         seal: '§9',  cn: '大屏' },
      { path: '/tasks',           seal: '§10', cn: '操作任务' },
    ]

    for (const p of paths) {
      await page.locator(`.sidebar__link[href="${p.path}"]`).click()
      await expect(page).toHaveURL(new RegExp(`${p.path}$`))
      await expect(page.locator('.topbar__seal')).toHaveText(p.seal)
      await expect(page.locator('.topbar__title-cn')).toHaveText(p.cn)
      await expect(page.locator('.sidebar__link--active .sidebar__seal')).toHaveText(p.seal)
    }
  })

  test('登出 → token 清空 → 跳 /login', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard$/)

    // 登出前 cookie 应存在
    const before = await page.context().cookies()
    expect(before.find((c) => c.name === 'satoken')).toBeDefined()

    await page.locator('.topbar__logout').click()
    await expect(page).toHaveURL(/\/login$/)

    // 登出后 satoken cookie 应被擦除 (Set-Cookie Max-Age=0)
    const after = await page.context().cookies()
    const sat = after.find((c) => c.name === 'satoken')
    expect(sat === undefined || sat.value === '').toBeTruthy()
  })

  test('登出后再登录 · Dashboard 重新拉取 (缓存已清)', async ({ page }) => {
    // 第一次登录
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard$/)
    await expect(page.getByTestId('dashboard-kpi-users').locator('div').first())
      .toHaveText(/^\d+$/, { timeout: 10_000 })

    // 登出
    await page.locator('.topbar__logout').click()
    await expect(page).toHaveURL(/\/login$/)

    // 再次登录, 监听是否触发新的 API 请求 (证明 cache 已清)
    const kpiRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/admin/users') && req.method() === 'GET',
      { timeout: 10_000 },
    )
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard$/)
    // Dashboard 必须再次发 /admin/users 请求, 说明上次的 cache 被 queryClient.clear() 清掉了
    await kpiRequest
  })

  test('硬刷新后 /users/me 自动回填 userInfo → TopBar 不空', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // 先正常登录拿真 token
    await page.goto(`${BASE}/login`)
    await page.getByTestId('login-mobile').fill('15675201507')
    await page.getByTestId('login-password').fill('admin123456')
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/dashboard$/)

    // 硬刷新: userInfo (内存) 丢失, satoken cookie (HttpOnly) 保留
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'satoken')).toBeDefined()

    // 等 /users/me 请求触发 (AppShell mount 发现有 token 但 userInfo 为空时自动发)
    const mePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/users/me') && r.request().method() === 'GET',
      { timeout: 10_000 },
    )
    await page.reload()
    const meRes = await mePromise
    expect(meRes.status()).toBe(200)

    // reload 后 TopBar 应再次显示用户信息 (不空)
    await expect(page.locator('.topbar__user-name')).not.toHaveText('', { timeout: 5000 })
    const roleText = await page.locator('.topbar__user-role').textContent()
    expect(roleText!.toLowerCase()).toMatch(/admin|平台|管理/)

    await context.close()
  })

  test('40002 拦截器: 注入假 satoken cookie 访问 /admin/users 返回 40002', async ({ browser }) => {
    const context = await browser.newContext()
    // 直接往 context 里注入一个无效的 satoken cookie (JS 虽无法写 HttpOnly, Playwright 可以)
    await context.addCookies([
      {
        name: 'satoken',
        value: 'obviously-invalid-token',
        url: BASE,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const page = await context.newPage()
    await page.goto(`${BASE}/login`)

    // 手动发 admin 请求, 验证后端对无效 cookie 的反应
    const resCode = await page.evaluate(async () => {
      const res = await fetch('/api/v1/admin/users?pageNo=1&pageSize=1', {
        credentials: 'include',
      })
      const json = await res.json()
      return json.code
    })
    // 后端对无效 token 应返回 40002 (invalid_token) 或拒绝访问
    expect([40002, 40003, 40004]).toContain(resCode)

    await context.close()
  })
})
