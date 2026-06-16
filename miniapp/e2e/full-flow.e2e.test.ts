// @ts-nocheck
// miniprogram-automator 的 .d.ts 宽松 · e2e 里不跟类型较真
/**
 * Full Flow · 小程序 UI 端到端自动化
 * ============================================================
 *  前置:
 *    1. 后端 8081 UP (wechat.miniapp.stub-mode=true)
 *    2. 微信开发者工具 GUI 已打开 · 设置→安全→「服务端口」勾上 (默认 9420)
 *    3. miniapp/dist 已 build (pnpm build:weapp)
 *    4. env MINIAPP_CLI_PATH 指向 cli.bat (或 macOS 的 cli)
 *
 *  流程 (13 步 UI 断言):
 *    beforeAll · admin 预置: 创建 plot + actuator + order + code
 *    [ 1] 登录页渲染                      (.login-page__title 含 "陇上管家")
 *    [ 2] 点一键登录 → 跳 /pages/adoptions
 *    [ 3] 初始空态可见                     (.empty-state__title 含 "还没有")
 *    [ 4] 点兑换按钮 → 跳 /pages/redeem
 *    [ 5] 输入码 + 点验证 → 进预览态       (.preview-card 可见)
 *    [ 6] 点确认兑换 → 跳回 adoptions
 *    [ 7] 地块卡出现                       (.plot-card >= 1)
 *    [ 8] 点卡 → 跳 /pages/task
 *    [ 9] 3 动作卡加载 · 浇水 enabled
 *    [10] 点浇水 → 底部 sheet 出现
 *    [11] 填时长 + 提交 → 跳 /pages/task-detail
 *    [12] 详情页状态 (待处理|已排队|执行中)
 *    [13] Edge callback success → 状态变 "已完成"
 * ============================================================ */
import automator from 'miniprogram-automator'
import path from 'path'
import net from 'net'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'

const CLI_PATH =
  process.env.MINIAPP_CLI_PATH ||
  'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'

const PROJECT_PATH = path.resolve(__dirname, '..', 'dist')
const API_BASE = 'http://localhost:8081/api/v1'
const AUTO_PORT = Number(process.env.MINIAPP_AUTO_PORT || 9420)
const WS_ENDPOINT = `ws://127.0.0.1:${AUTO_PORT}`

const ADMIN_MOBILE = '15675201507'
const ADMIN_PASSWORD = 'admin123456'

const RUN_ID = process.env.E2E_RUN_ID || `ui_e2e_${Date.now()}`
const E2E_CODE = process.env.E2E_CODE || ''
const E2E_PLOT_ID = Number(process.env.E2E_PLOT_ID || 0)
const E2E_PLOT_NAME = process.env.E2E_PLOT_NAME || ''
const E2E_SENSOR_DEVICE_NO = process.env.E2E_SENSOR_DEVICE_NO || ''
const E2E_DEVICE_ID = Number(process.env.E2E_DEVICE_ID || 0)

// ---- 端口探测 ----
function tryConnect(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(port, host)
    sock.once('connect', () => {
      sock.end()
      resolve()
    })
    sock.once('error', reject)
  })
}

async function waitForPort(port: number, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await tryConnect('127.0.0.1', port)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  throw new Error(`Port ${port} never came up within ${timeoutMs}ms`)
}

// 简单 fetch 包装, 统一脱壳
async function api(method: string, pathStr: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.satoken = token
  const res = await fetch(`${API_BASE}${pathStr}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json: any = await res.json()
  if (json.code !== 0) {
    throw new Error(`API ${pathStr} failed code=${json.code} msg=${json.message}`)
  }
  return json.data
}

function isoFmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ---- 全局状态 ----
let miniProgram: any
let devToolsProc: ChildProcess | null = null
let adminToken: string
let plotId: number
let plotName: string
let deviceId: number
let orderId: number
let adoptionCode: string
let taskId: number

describe('§ Full Flow · miniapp UI E2E', () => {
  beforeAll(async () => {
    // ---- Step 0 · Admin 预置 / or reuse env-provided context ----
    if (E2E_CODE && E2E_PLOT_ID > 0) {
      plotId = E2E_PLOT_ID
      plotName = E2E_PLOT_NAME || `Plot#${plotId}`
      adoptionCode = E2E_CODE
      deviceId = E2E_DEVICE_ID || 0
      console.log(`[setup] reuse context from env · plotId=${plotId} code=${adoptionCode}`)
    } else {
      const ar = await api('POST', '/auth/admin-login', {
        mobile: ADMIN_MOBILE,
        password: ADMIN_PASSWORD,
      })
      adminToken = ar.token
      console.log(`[setup] admin logged in · userId=${ar.userInfo.userId}`)

      const stamp = Date.now().toString().slice(-6)
      plotName = `UI-E2E-${stamp}`
      const plot = await api(
        'POST',
        '/admin/plots',
        { plotName, areaSize: 1, areaUnit: 'mu', introText: 'UI E2E 自动化创建' },
        adminToken,
      )
      plotId = plot.plotId
      console.log(`[setup] plot #${plotId} "${plotName}" created`)

      const act = await api(
        'POST',
        `/admin/plots/${plotId}/bind-actuator`,
        { deviceName: 'UI-E2E浇水阀', deviceType: 'irrigator', edgeNodeNo: 'EDGE-UI-E2E' },
        adminToken,
      )
      deviceId = act.deviceId
      console.log(`[setup] actuator #${deviceId} (irrigator) bound`)

      // bind a sensor for miniapp assertions
      const sensor = await api(
        'POST',
        `/admin/plots/${plotId}/bind-sensor`,
        { sensorName: 'UI-E2E温湿度', sensorType: 'env_multi', category: 'environment', unit: '' },
        adminToken,
      )
      const sensorDeviceNo = String(sensor.deviceNo || '')
      console.log(`[setup] sensor bound deviceNo=${sensorDeviceNo}`)

      // publish telemetry via python helper (real MQTT)
      if (sensorDeviceNo) {
        const simPath = path.resolve(__dirname, '..', '..', 'tools', 'e2e', 'mqtt_sensor_sim.py')
        if (fs.existsSync(simPath)) {
          spawn('python', [simPath, '--device-no', sensorDeviceNo, '--metrics', 'temperature=27.3', 'soil_moisture=45.2', '--count', '5'], {
            shell: true,
            stdio: 'ignore',
          })
          await new Promise((r) => setTimeout(r, 1500))
        }
      }

      const now = new Date()
      const order = await api(
        'POST',
        '/admin/adoption-orders',
        {
          plotId,
          adoptionType: 'plot_crop',
          startAt: isoFmt(new Date(now.getTime() - 86400_000)),
          endAt: isoFmt(new Date(now.getTime() + 365 * 86400_000)),
          visibilityLevel: 'full',
          operationLevel: 'request_only',
          payableAmount: 0,
          remark: 'UI E2E',
        },
        adminToken,
      )
      orderId = order.orderId
      console.log(`[setup] order #${orderId} created`)

      const codeRes = await api(
        'POST',
        '/admin/adoption-codes',
        {
          orderId,
          codeType: 'master',
          validFrom: isoFmt(new Date(now.getTime() - 86400_000)),
          validTo: isoFmt(new Date(now.getTime() + 365 * 86400_000)),
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
        adminToken,
      )
      adoptionCode = codeRes.code
      console.log(`[setup] adoption code ${adoptionCode} created`)
    }

    // ---- 启动微信开发者工具 ----
    // automator 0.12.1 的 launch() 在 Node 20+ 上挂 (spawn .bat 安全限制)
    // 改: 自己 spawn + shell:true + 等 9420 端口 + connect
    console.log(`[setup] spawning DevTools · ${CLI_PATH}`)
    devToolsProc = spawn(
      CLI_PATH,
      ['auto', '--project', PROJECT_PATH, '--auto-port', String(AUTO_PORT)],
      {
        shell: true,
        detached: false,
        stdio: 'ignore',
      },
    )
    devToolsProc.once('error', (e) => {
      console.error('[setup] DevTools spawn error:', e)
    })
    console.log(`[setup] waiting for port ${AUTO_PORT}...`)
    await waitForPort(AUTO_PORT, 90_000)
    // 工具启动后还要一会儿才能 ready to connect
    await new Promise((r) => setTimeout(r, 2000))

    console.log(`[setup] connecting automator to ${WS_ENDPOINT}`)
    miniProgram = await automator.connect({ wsEndpoint: WS_ENDPOINT })
    console.log('[setup] automator connected')
    // 再给工具加载项目几秒
    await new Promise((r) => setTimeout(r, 3000))
  }, 180_000)

  afterAll(async () => {
    if (miniProgram) {
      try {
        await miniProgram.close?.()
      } catch {
        // ignore
      }
    }
    if (devToolsProc && !devToolsProc.killed) {
      // Windows 下 .bat 起来的是 cmd.exe + devtools 子进程, 要 taskkill /T 连根拔
      try {
        if (process.platform === 'win32' && devToolsProc.pid) {
          spawn('taskkill', ['/F', '/T', '/PID', String(devToolsProc.pid)], { shell: true })
        } else {
          devToolsProc.kill('SIGTERM')
        }
      } catch {
        // ignore
      }
    }
  })

  it('[ 1] 登录页渲染 · 品牌标题', async () => {
    const page = await miniProgram.reLaunch('/pages/login/index')
    await page.waitFor(800)
    const title = await page.$('.login-page__title')
    expect(title).not.toBeNull()
    const t = await title.text()
    expect(t).toContain('陇上管家')
  })

  it('[ 2] 点登录按钮 → 跳 /pages/adoptions', async () => {
    const page = await miniProgram.currentPage()
    const btn = await page.$('.login-page__cta')
    expect(btn).not.toBeNull()
    await btn.tap()
    // wait wx.login + /auth/wechat-login + redirect
    await page.waitFor(3000)
    const cur = await miniProgram.currentPage()
    expect(cur.path).toBe('pages/adoptions/index')
  })

  it('[ 3] 认养页初始空态', async () => {
    const page = await miniProgram.currentPage()
    await page.waitFor(1500) // wait /my/adoptions
    const emptyTitle = await page.$('.empty-state__title')
    expect(emptyTitle).not.toBeNull()
    const t = await emptyTitle.text()
    expect(t).toMatch(/没有|暂无/)
  })

  it('[ 4] 点兑换入口 → 跳 /pages/redeem', async () => {
    const page = await miniProgram.currentPage()
    const actionBtn = await page.$('.action-btn')
    expect(actionBtn).not.toBeNull()
    await actionBtn.tap()
    await page.waitFor(1000)
    const cur = await miniProgram.currentPage()
    expect(cur.path).toBe('pages/redeem/index')
  })

  it('[ 5] 输入码 + 验证 → 进预览态', async () => {
    const page = await miniProgram.currentPage()
    const input = await page.$('.redeem-form__input')
    expect(input).not.toBeNull()
    await input.input(adoptionCode)
    await page.waitFor(300)
    const btn = await page.$('.redeem-form__btn')
    await btn.tap()
    await page.waitFor(2000) // wait verify API
    const preview = await page.$('.preview-card')
    expect(preview).not.toBeNull()
  })

  it('[ 6] 点确认兑换 → 跳回 adoptions', async () => {
    const page = await miniProgram.currentPage()
    // verified 态下首个 .redeem-form__btn 就是 "确认兑换"
    const confirmBtn = await page.$('.redeem-form__btn')
    await confirmBtn.tap()
    await page.waitFor(3000) // wait redeem + reLaunch
    const cur = await miniProgram.currentPage()
    expect(cur.path).toBe('pages/adoptions/index')
  })

  it('[ 7] 地块卡出现 (兑换成功后)', async () => {
    const page = await miniProgram.currentPage()
    await page.waitFor(1500) // wait /my/adoptions refresh
    const cards = await page.$$('.plot-card')
    expect(cards.length).toBeGreaterThanOrEqual(1)
    // 检查卡片名包含我们刚创建的地块
    const firstTitle = await cards[0].$('.plot-card__title')
    const titleText = await firstTitle.text()
    expect(titleText).toContain(plotName)
  })

  it('[ 8] 点地块卡 → 跳 /pages/task', async () => {
    const page = await miniProgram.currentPage()
    const cards = await page.$$('.plot-card')
    await cards[0].tap()
    await page.waitFor(1500)
    const cur = await miniProgram.currentPage()
    expect(cur.path).toBe('pages/task/index')
  })

  it('[ 8.1] 直接进入 plot 页 · 必须看到传感器摘要 + 历史曲线', async () => {
    // adoptions 卡默认跳 task 页，但完整性测试要求 plot 页传感器可见
    const name = encodeURIComponent(plotName)
    const page = await miniProgram.navigateTo(`/pages/plot/index?plotId=${plotId}&plotName=${name}`)
    await page.waitFor(3000) // wait plotDetail + sensorSummary + chart fetch

    // sensor summary grid: at least one value cell exists
    const anySensorValue = await page.$('.sensor-grid__value')
    expect(anySensorValue).not.toBeNull()
    const txt = await anySensorValue.text()
    expect(String(txt).length).toBeGreaterThan(0)

    // chart should not be in empty state
    const chartEmpty = await page.$('.chart-empty')
    if (chartEmpty) {
      const t = await chartEmpty.text()
      expect(t).not.toContain('暂无历史数据')
    }
  })

  it('[ 9] 3 动作卡渲染 · 浇水 enabled', async () => {
    const page = await miniProgram.currentPage()
    await page.waitFor(1500) // wait allowed-actions
    const actionCards = await page.$$('.action-card')
    expect(actionCards.length).toBe(3)
    // 浇水卡 (第一个) 不应有 disabled 类
    const className = await actionCards[0].attribute('class')
    expect(className).not.toContain('action-card--disabled')
    const name = await actionCards[0].$('.action-card__name').then((e: any) => e.text())
    expect(name).toContain('浇水')
  })

  it('[10] 点浇水卡 → 底部 sheet 出现', async () => {
    const page = await miniProgram.currentPage()
    const actionCards = await page.$$('.action-card')
    await actionCards[0].tap()
    await page.waitFor(500)
    const sheet = await page.$('.sheet')
    expect(sheet).not.toBeNull()
    const title = await page.$('.sheet__title').then((e: any) => e.text())
    expect(title).toContain('浇水')
  })

  it('[11] 填时长 + 提交 → 跳 task-detail', async () => {
    const page = await miniProgram.currentPage()
    const input = await page.$('.form-item__input')
    await input.input('3')
    await page.waitFor(300)
    const submitBtn = await page.$('.sheet__submit')
    await submitBtn.tap()
    await page.waitFor(3000) // wait create task + navigate
    const cur = await miniProgram.currentPage()
    expect(cur.path).toBe('pages/task-detail/index')
    // 捕获 taskId 给后续用
    taskId = Number(cur.query.taskId)
    expect(taskId).toBeGreaterThan(0)
    console.log(`[test] task created · taskId=${taskId}`)
  })

  it('[12] 详情页展示初始状态 (非终态)', async () => {
    const page = await miniProgram.currentPage()
    await page.waitFor(1500)
    const statusValue = await page.$('.td-status__value')
    expect(statusValue).not.toBeNull()
    const sv = await statusValue.text()
    expect(['待处理', '已排队', '执行中']).toContain(sv)
  })

  it('[13] Edge callback success → 3s 内轮询到 "已完成"', async () => {
    if (!deviceId) {
      // when reusing env context, deviceId must be provided for callback
      throw new Error('deviceId missing for edge callback')
    }
    // 服务端代硬件回执
    await api('POST', '/edge/execution-callbacks', {
      taskId,
      deviceId,
      executionState: 'success',
      finishedAt: isoFmt(new Date()),
      remark: 'UI E2E · 模拟设备完成',
    })
    console.log(`[test] edge callback sent · taskId=${taskId}`)

    // miniapp 详情页每 3s 轮询, 给 5s 余量
    const page = await miniProgram.currentPage()
    await page.waitFor(5000)

    const statusValue = await page.$('.td-status__value')
    const sv = await statusValue.text()
    expect(sv).toBe('已完成')
  })
})
