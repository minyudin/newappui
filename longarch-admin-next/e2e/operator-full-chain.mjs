import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BACKEND = 'http://127.0.0.1:8081/api/v1'
const ADMIN_UI = 'http://127.0.0.1:5173'
// miniapp H5 preview server (see miniapp/scripts/preview-h5.mjs)
const MINIAPP_H5 = 'http://127.0.0.1:12189'

const ADMIN_MOBILE = '15675201507'
const ADMIN_PASSWORD = 'admin123456'

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outDir = path.resolve(process.cwd(), '..', 'artifacts', 'mcp-operator-fullchain', stamp)
fs.mkdirSync(outDir, { recursive: true })

async function api(method, url, { token, body } = {}) {
  const res = await fetch(`${BACKEND}${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { satoken: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  if (json.code !== 0) throw new Error(`API ${url} failed: code=${json.code} msg=${json.message}`)
  return json.data
}

async function main() {
  // 0) Health
  await api('GET', '/public/config')

  // 1) admin token
  const adminLogin = await api('POST', '/auth/admin-login', {
    body: { mobile: ADMIN_MOBILE, password: ADMIN_PASSWORD },
  })
  const adminToken = adminLogin.token

  // 2) seed operator + adopter identities (by stub openId)
  const operatorOpenId = 'stub_op_001'
  const adopterOpenId = 'stub_ad_001'
  let operatorUserId = null
  try {
    const op = await api('POST', '/admin/users', {
      token: adminToken,
      body: { openId: operatorOpenId, nickname: `OP-${stamp.slice(11, 16)}`, roleType: 'operator' },
    })
    operatorUserId = op.userId
  } catch {
    // user may already exist; it is ok for UI flow
  }
  try {
    await api('POST', '/admin/users', {
      token: adminToken,
      body: { openId: adopterOpenId, nickname: `AD-${stamp.slice(11, 16)}`, roleType: 'adopter' },
    })
  } catch {}

  // 3) create plot + actuator + order + code
  const plot = await api('POST', '/admin/plots', {
    token: adminToken,
    body: {
      plotName: `OP链路演示-${stamp.slice(11, 16)}`,
      areaSize: 1.2,
      areaUnit: 'mu',
      longitude: 104.065735,
      latitude: 35.731164,
      introText: 'operator full-chain test',
    },
  })

  const actuator = await api('POST', `/admin/plots/${plot.plotId}/bind-actuator`, {
    token: adminToken,
    body: { deviceName: '浇水阀-OP链路', deviceType: 'irrigator', edgeNodeNo: 'EDGE-OP-TEST' },
  })

  // 4) operator scope bind (primary)
  if (!operatorUserId) {
    const operatorLogin = await api('POST', '/auth/wechat-login', { body: { code: 'op_001' } })
    operatorUserId = operatorLogin.userInfo.userId
  }
  await api('POST', `/admin/operators/${operatorUserId}/plots/${plot.plotId}/bind`, {
    token: adminToken,
    body: { isPrimary: 1 },
  })

  const now = new Date()
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

  const order = await api('POST', '/admin/adoption-orders', {
    token: adminToken,
    body: {
      plotId: plot.plotId,
      adoptionType: 'plot_crop',
      startAt: fmt(new Date(now.getTime() - 86400_000)),
      endAt: fmt(new Date(now.getTime() + 365 * 86400_000)),
      visibilityLevel: 'full',
      operationLevel: 'request_only',
      payableAmount: 0,
      remark: 'operator chain',
    },
  })

  const codeRes = await api('POST', '/admin/adoption-codes', {
    token: adminToken,
    body: {
      orderId: order.orderId,
      codeType: 'master',
      validFrom: fmt(new Date(now.getTime() - 86400_000)),
      validTo: fmt(new Date(now.getTime() + 365 * 86400_000)),
      dailyAccessStart: '00:00:00',
      dailyAccessEnd: '23:59:59',
      permissions: {
        canViewLive: true,
        canViewHistory: true,
        historyDays: 30,
        canViewSensor: true,
        canOperate: true,
        operationWhitelist: ['irrigation_apply', 'fertilize_apply', 'spray_apply'],
        maxDailyOperations: 20,
        shareable: false,
      },
    },
  })
  const code = codeRes.code

  // 5) adopter redeem + create an operator_required task (offline -> soft gate)
  const adopterLogin = await api('POST', '/auth/wechat-login', { body: { code: 'ad_001' } })
  const adopterToken = adopterLogin.token
  await api('POST', '/adoption-codes/redeem', { token: adopterToken, body: { code } })
  const task = await api('POST', '/operation-tasks', {
    token: adopterToken,
    body: {
      plotId: plot.plotId,
      deviceId: actuator.deviceId,
      actionType: 'irrigation_apply',
      actionParams: { durationMinutes: 1 },
      schedulingMode: 'asap',
      idempotencyKey: `E2E_OP_${stamp}`,
    },
  })

  // 6) operator login (stub) -> storage payload for miniapp H5
  const operatorLogin = await api('POST', '/auth/wechat-login', { body: { code: 'op_001' } })
  const operatorToken = operatorLogin.token
  const operatorUserInfo = operatorLogin.userInfo

  // 7) UI + screenshots
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // Admin UI
  await page.goto(`${ADMIN_UI}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('[data-testid="login-mobile"]', ADMIN_MOBILE)
  await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD)
  await page.click('[data-testid="login-submit"]')
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, '01-admin-login-ok.png'), fullPage: true })

  await page.goto(`${ADMIN_UI}/operator-scopes`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.getByText(String(operatorUserInfo.nickname || ''), { exact: false }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(outDir, '02-admin-operator-scope.png'), fullPage: true })

  // Miniapp H5 (operator) · use real operator-login flow (manual id input)
  const mini = await ctx.newPage()
  await mini.goto(`${MINIAPP_H5}/#/pages/operator-login/index`, { waitUntil: 'domcontentloaded' })
  await mini.waitForTimeout(800)
  await mini.screenshot({ path: path.join(outDir, '03-miniapp-operator-login.png'), fullPage: true })

  // 输入 operator stub id: op_001
  await mini.locator('.op-login-card__input').fill('op_001')
  await mini.getByText('Enter Workbench', { exact: false }).click()
  await mini.waitForTimeout(1200)
  await mini.screenshot({ path: path.join(outDir, '04-miniapp-workbench-queue.png'), fullPage: true })

  // Try claim first visible task
  await mini.getByText('认领').first().click().catch(() => {})
  await mini.waitForTimeout(900)
  await mini.screenshot({ path: path.join(outDir, '05-miniapp-claimed.png'), fullPage: true })

  // Operator queue should contain our task id
  fs.writeFileSync(
    path.join(outDir, 'result.json'),
    JSON.stringify({ plotId: plot.plotId, operatorUserId, task, operatorToken: operatorToken.slice(0, 12) + '...' }, null, 2),
    'utf-8',
  )

  await browser.close()
  console.log('DONE', outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

