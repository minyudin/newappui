import { test, expect, request as pwRequest, type BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const BASE = 'http://localhost:5175'
const API = 'http://localhost:8081/api/v1'

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

function writeJson(outPath: string, payload: any) {
  if (!outPath) return
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8')
}

async function loginAsAdmin(context: BrowserContext) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByTestId('login-mobile').fill('15675201507')
  await page.getByTestId('login-password').fill('admin123456')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/dashboard$/)
  await page.close()
}

async function adminTokenFromApi(): Promise<string> {
  const ctx = await pwRequest.newContext()
  const res = await ctx.post(`${API}/auth/admin-login`, {
    data: { mobile: '15675201507', password: 'admin123456' },
  })
  const json: any = await res.json()
  await ctx.dispose()
  if (json.code !== 0) throw new Error(`admin-login failed: ${JSON.stringify(json)}`)
  return String(json.data.token)
}

test.describe('Full stack flow (setup/verify)', () => {
  test('stage dispatcher', async ({ browser }) => {
    const stage = env('E2E_STAGE', 'setup')
    const runId = env('E2E_RUN_ID', `run_${Date.now()}`)
    const outJson = env('E2E_OUT_JSON', '')

    // Debug print for env injection issues (do not affect flow)
    // Print raw + json escaped + char codes
    const raw = process.env.E2E_STAGE
    console.log('[e2e] E2E_STAGE raw:', raw)
    console.log('[e2e] E2E_STAGE stageVar:', stage, 'len=', stage.length, 'json=', JSON.stringify(stage))
    console.log('[e2e] E2E_STAGE codes:', Array.from(stage).map((c) => c.charCodeAt(0)).join(','))

    const context = await browser.newContext()
    try {
      await loginAsAdmin(context)
      const page = await context.newPage()

      if (stage === 'setup') {
        await page.goto(`${BASE}/plots`)
        await expect(page.getByTestId('plots-table')).toBeVisible()

        // Create plot
        await page.getByTestId('plots-create-trigger').click()
        const plotName = `E2E-${runId}`
        await page.locator('text=PLOT NAME').locator('..').locator('input').fill(plotName)
        await page.getByTestId('plots-create-submit').click()
        await expect(page.locator('[data-sonner-toast]')).toContainText(/成功|创建/)

        // Find row by plot name
        const row = page.locator('tr', { hasText: plotName })
        await expect(row).toBeVisible()

        // Bind actuator
        await row.getByText('设备', { exact: true }).click()
        await expect(page.locator('text=绑定执行设备到地块')).toBeVisible()
        await page.locator('text=DEVICE NAME').locator('..').locator('input').fill(`ACT-${runId}`)
        // keep default deviceType=fertigation_machine
        await page.getByRole('button', { name: /^绑定$/ }).click()
        await expect(page.locator('[data-sonner-toast]')).toContainText(/绑定|成功/)

        // Bind sensor
        await row.getByText('传感器', { exact: true }).click()
        await expect(page.locator('text=绑定传感器到地块')).toBeVisible()
        await page.locator('text=SENSOR NAME').locator('..').locator('input').fill(`SEN-${runId}`)
        await page.locator('text=SENSOR TYPE').locator('..').locator('input').fill('env_multi')
        await page.getByRole('button', { name: /^绑定$/ }).click()
        await expect(page.locator('text=传感器绑定成功')).toBeVisible()
        const sensorDeviceNo = (await page.locator('text=DEVICE NO.').locator('..').locator('.font-folio.text-ink').textContent())?.trim() ?? ''
        const sensorTopic = (await page.locator('text=MQTT TOPIC').locator('..').locator('.font-folio.text-ink').textContent())?.trim() ?? ''
        await page.getByRole('button', { name: /^关闭$/ }).click()

        // Create order + code via API (more stable than UI for now)
        const token = await adminTokenFromApi()
        // Discover plotId by calling listPlots and matching name
        const apiCtx = await pwRequest.newContext({ extraHTTPHeaders: { satoken: token } })
        const plotsRes = await apiCtx.get(`${API}/admin/plots?pageNo=1&pageSize=50`)
        const plotsJson: any = await plotsRes.json()
        if (plotsJson.code !== 0) throw new Error(`listPlots failed: ${JSON.stringify(plotsJson)}`)
        const plotItem = (plotsJson.data.list as any[]).find((p) => String(p.plotName) === plotName)
        if (!plotItem) throw new Error(`plot not found by name: ${plotName}`)
        const plotId = Number(plotItem.plotId)

        // Discover actuator deviceId (latest on plot)
        const devRes = await apiCtx.get(`${API}/admin/actuator-devices?pageNo=1&pageSize=20&plotId=${plotId}`)
        const devJson: any = await devRes.json()
        if (devJson.code !== 0) throw new Error(`listDevices failed: ${JSON.stringify(devJson)}`)
        const actuatorDeviceId = Number((devJson.data.list?.[0] ?? {}).deviceId ?? 0)
        if (!actuatorDeviceId) throw new Error('actuator deviceId not found after bind')

        // Discover sensorId by plotId + deviceNo
        const sensRes = await apiCtx.get(`${API}/admin/sensor-devices?pageNo=1&pageSize=50&plotId=${plotId}`)
        const sensJson: any = await sensRes.json()
        if (sensJson.code !== 0) throw new Error(`listSensorDevices failed: ${JSON.stringify(sensJson)}`)
        const sensorRow = (sensJson.data.list as any[]).find((s) => String(s.deviceNo) === sensorDeviceNo)
        const sensorId = Number(sensorRow?.sensorId ?? 0)
        if (!sensorId) throw new Error('sensorId not found after bind')

        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

        const orderRes = await apiCtx.post(`${API}/admin/adoption-orders`, {
          data: {
            plotId,
            adoptionType: 'plot_crop',
            startAt: fmt(new Date(now.getTime() - 86400_000)),
            endAt: fmt(new Date(now.getTime() + 365 * 86400_000)),
            visibilityLevel: 'full',
            operationLevel: 'request_only',
            payableAmount: 0,
            remark: `E2E ${runId}`,
          },
        })
        const orderJson: any = await orderRes.json()
        if (orderJson.code !== 0) throw new Error(`createOrder failed: ${JSON.stringify(orderJson)}`)
        const orderId = Number(orderJson.data.orderId)

        const codeRes = await apiCtx.post(`${API}/admin/adoption-codes`, {
          data: {
            orderId,
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
        const codeJson: any = await codeRes.json()
        if (codeJson.code !== 0) throw new Error(`createCode failed: ${JSON.stringify(codeJson)}`)
        const code = String(codeJson.data.code)
        await apiCtx.dispose()

        const payload = {
          ok: true,
          stage,
          runId,
          plot: { plotId, plotName },
          sensor: { sensorId, deviceNo: sensorDeviceNo, topic: sensorTopic },
          actuator: { deviceId: actuatorDeviceId },
          order: { orderId },
          code: { code },
        }
        writeJson(outJson, payload)
        expect(payload.ok).toBe(true)
        return
      }

      if (stage === 'verify') {
        const setupPath = env('E2E_SETUP_JSON', '')
        if (!setupPath) {
          // Fallback: try read from artifacts dir layout used by runner
          // but the orchestrator passes setup json via file, so require env.
        }
        // runner passes plot info through env
        const plotName = `E2E-${runId}`

        await page.goto(`${BASE}/device-overview`)
        await expect(page.getByTestId('overview-plot')).toBeVisible()

        // Pick plot for per-plot overview
        await page.locator('#overview-plot-pick').click()
        await page.getByRole('option', { name: new RegExp(plotName) }).click()

        // Expect metrics cards to eventually show values (not "No data yet.")
        const plotSection = page.getByTestId('overview-plot')
        await expect(plotSection).not.toContainText('Pick a plot above')
        await expect(plotSection).not.toContainText('No data yet.')

        // Sensor registry table should show latest metrics (not "No data")
        const sensSection = page.getByTestId('overview-sensors')
        await sensSection.locator('#sens-filter-plot').click()
        await page.getByRole('option', { name: new RegExp(plotName) }).click()
        await expect(sensSection).not.toContainText('No sensors.')
        await expect(sensSection).not.toContainText('No data')

        // Click first "历史" to open SensorDataPage, check table has rows
        await sensSection.getByRole('button', { name: '历史' }).first().click()
        await expect(page).toHaveURL(/\/sensor-data\?/)
        await expect(page.getByTestId('sensor-table')).toBeVisible()
        // Wait for at least one row in table body
        await expect(page.locator('section[data-testid="sensor-table"] tbody tr').first()).toBeVisible()

        const payload = { ok: true, stage, runId }
        writeJson(outJson, payload)
        expect(payload.ok).toBe(true)
        return
      }

      throw new Error(`Unknown E2E_STAGE=${stage}`)
    } finally {
      await context.close()
    }
  })
})

