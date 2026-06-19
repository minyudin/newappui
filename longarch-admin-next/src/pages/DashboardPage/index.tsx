import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { useQuery } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import { Card, CardContent, CardHeader, CardSeal, CardTitle } from '@/components/ui'
import DigitFlipper from '@/components/digit/DigitFlipper'
import { getDashboardSummary } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import './DashboardPage.scss'

/**
 * §1 Dashboard · 仪表盘 · 运营工作台
 * ============================================================
 *  设计原则:
 *   · 数据为核心, 异常上浮, 一屏抓关键
 *   · 莫兰迪色板不变, 用排版与编排制造焦点
 *   · 4 块结构: KPI / Alerts / Today / Recent
 * ============================================================ */

interface KpiStat {
  labelCn: string
  labelEn: string
  value: number | string
  href: string
}

// ---- 状态映射 (复用莫兰迪色板) ----
const STATUS_COLOR: Record<string, string> = {
  pending: '#d9c9a8',
  active: '#a0bcd0',
  cancelled: '#8a857b',
  queued: '#d9c9a8',
  running: '#a0bcd0',
  success: '#9baa7a',
  failed: '#c5826a',
  network_pending_confirmation: '#a68c9c',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  active: '进行中',
  cancelled: '已取消',
  queued: '排队中',
  running: '执行中',
  success: '已完成',
  failed: '失败',
  network_pending_confirmation: '网络待确认',
}

const INITIAL_KPI: KpiStat[] = [
  { labelCn: '用户',     labelEn: 'Users',    value: '—', href: '/users' },
  { labelCn: '认养订单', labelEn: 'Orders',   value: '—', href: '/orders' },
  { labelCn: '认养码',   labelEn: 'Codes',    value: '—', href: '/codes' },
  { labelCn: '地块',     labelEn: 'Plots',    value: '—', href: '/plots' },
  { labelCn: '执行设备', labelEn: 'Devices',  value: '—', href: '/devices' },
  { labelCn: '操作任务', labelEn: 'Tasks',    value: '—', href: '/tasks' },
]

interface PieDatum { value: number; name: string; itemStyle: { color: string } }
/** 任务状态分布: 直接消费后端聚合好的 { status: count }, 不再在前端遍历整页任务计数 */
function pieFromCounts(counts: Record<string, number>): PieDatum[] {
  return Object.entries(counts).map(([key, value]) => ({
    value,
    name: STATUS_LABEL[key] ?? key,
    itemStyle: { color: STATUS_COLOR[key] ?? '#8a857b' },
  }))
}

function makePieOption(data: PieDatum[]) {
  return {
    tooltip: {
      backgroundColor: '#f1efea',
      borderColor: '#c8c4bb',
      borderWidth: 1,
      textStyle: { color: '#2d2a26', fontFamily: 'Inter, "Noto Sans SC", sans-serif', fontSize: 12 },
      padding: [8, 12],
      extraCssText: 'box-shadow: none !important; border-radius: 0;',
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#8a857b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
      itemWidth: 10, itemHeight: 2, itemGap: 14,
    },
    series: [{
      type: 'pie',
      radius: ['58%', '78%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: false,
      itemStyle: { borderColor: '#f1efea', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, color: '#2d2a26', fontSize: 13 }, scaleSize: 4 },
      data,
    }],
  }
}

export default function DashboardPage() {
  // ---- 单一聚合查询 · 后端一次算好 KPI / 告警 / 任务分布 / 最近任务 ----
  // 替代原来 7 个 list 查询(orders/tasks/devices 各 100 行 + sensors 200 行),
  // 小服务器上每 30s 只传一份精简聚合, 不再反复拉整页再在浏览器里 filter/count。
  const q = useQuery({
    queryKey: qk.dashboard.summary(),
    queryFn: getDashboardSummary,
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const data = q.data
  const loading = q.isPending

  const kpi: KpiStat[] = [
    { ...INITIAL_KPI[0], value: data?.kpi.users   ?? '—' },
    { ...INITIAL_KPI[1], value: data?.kpi.orders  ?? '—' },
    { ...INITIAL_KPI[2], value: data?.kpi.codes   ?? '—' },
    { ...INITIAL_KPI[3], value: data?.kpi.plots   ?? '—' },
    { ...INITIAL_KPI[4], value: data?.kpi.devices ?? '—' },
    { ...INITIAL_KPI[5], value: data?.kpi.tasks   ?? '—' },
  ]

  // ---- 异常清单 (后端已截断 top 6, 计数用真实总数) ----
  const offlineSensors = data?.offlineSensors ?? []
  const lockedDevices = data?.lockedDevices ?? []
  const failedTasks = data?.failedTasks ?? []
  const offlineSensorCount = data?.offlineSensorCount ?? 0
  const lockedDeviceCount = data?.lockedDeviceCount ?? 0
  const failedTaskCount = data?.failedTaskCount ?? 0
  const totalAlerts = offlineSensorCount + lockedDeviceCount + failedTaskCount

  // ---- 饼图 / 最近任务 / lede 计数 ----
  const taskPieData = pieFromCounts(data?.taskStatusCounts ?? {})
  const taskPieOption = makePieOption(taskPieData)
  const recentTasks = data?.recentTasks ?? []
  const sensorTotal = data?.sensorTotal ?? 0
  const actuatorTotal = data?.actuatorTotal ?? 0
  const pendingTaskCount = data?.pendingTaskCount ?? 0

  return (
    <PageShell
      seal="§1 · Today"
      title="Dashboard"
      titleCn="仪表盘"
      lede={loading ? undefined : `${sensorTotal} 传感器 · ${actuatorTotal} 执行设备 · ${pendingTaskCount} 任务进行中`}
      right={
        <>
          <span>{loading ? 'LOADING' : 'LIVE'}</span>
          <span>·</span>
          <span>{totalAlerts} ALERTS</span>
        </>
      }
    >
      {/* ==== §1.1 KPI 六卡 · 数据为焦点 ====
          · 1280+ → 1×6 单行 (大屏) · 1024-1279 → 2×3 (中屏) · ≥640 → 2×3 / 3×2 · <640 → 2 列
          · 单卡 ≥ 130px 才放得下 KPI 翻牌 44px 衬线大数字, 否则 grid 让步先 */}
      <section className="folio-page__section" data-testid="dashboard-kpi">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2 border border-line bg-paper-light">
          {kpi.map((s) => (
            <Link
              key={s.labelEn}
              to={s.href}
              className={[
                'group block px-4 py-4 transition-colors hover:bg-paper-deep/50',
                'kpi-cell',
                /* hairline 改用通用边框, 让 grid 多行时也工整
                   · 默认每格右下都加 line-soft 1px
                   · 最右列 / 最末行通过 :nth-child + nth-last-child 抠掉 */
              ].join(' ')}
              data-testid={`dashboard-kpi-${s.labelEn.toLowerCase()}`}
            >
              <div className="dashboard-kpi__value leading-none">
                {/* DigitFlipper · 数字翻牌 (B.1)
                    · loading 期间值是 "—", DigitFlipper 不翻动直接显示
                    · 数字到位后字符长度变化, 触发整体重渲, 不做错位翻动 */}
                <DigitFlipper value={s.value} size="kpi" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-sans text-[13px] text-ink-soft">{s.labelCn}</span>
                <span className="font-folio text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  {s.labelEn}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ==== §1.2 异常清单 · 3 列 ==== */}
      <section className="folio-page__section" data-testid="dashboard-alerts">
        <h4 className="folio-page__section-title flex items-center justify-between">
          <span>
            需要关注 <em>· issues to attend</em>
          </span>
          {/* 全清态 · 印章式庆贺. 异常 = 0 时只显示 ALL CLEAR + 静默墨绿点
              异常 > 0 时显示总数 + ITEMS 后缀, 由各列 AlertCard 自带砖红呼吸 */}
          <span
            className={`dashboard-alerts__seal ${totalAlerts === 0 ? 'dashboard-alerts__seal--clear' : 'dashboard-alerts__seal--has'}`}
            data-testid="dashboard-alerts-seal"
          >
            <span className="dashboard-alerts__dot" />
            {totalAlerts === 0 ? 'ALL CLEAR · 全部已处理' : `${totalAlerts} ITEMS · 待处理`}
          </span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AlertCard
            label="传感器离线"
            labelEn="Sensors offline"
            count={offlineSensorCount}
            href="/device-overview"
            emptyText={loading ? '加载中...' : '全部在线'}
          >
            {offlineSensors.map((s) => (
              <AlertRow
                key={s.sensorId}
                primary={(s.sensorName as string) || (s.deviceNo as string) || `#${s.sensorId}`}
                secondary={s.deviceNo as string}
                meta={s.lastSampleAt ? shortTime(s.lastSampleAt as string) : '从未上报'}
              />
            ))}
          </AlertCard>

          <AlertCard
            label="设备锁定"
            labelEn="Locked actuators"
            count={lockedDeviceCount}
            href="/devices"
            emptyText={loading ? '加载中...' : '无锁定设备'}
          >
            {lockedDevices.map((d) => (
              <AlertRow
                key={d.deviceId}
                primary={(d.deviceName as string) || (d.deviceNo as string) || `#${d.deviceId}`}
                secondary={d.plotName as string}
                meta={d.currentTaskId ? `任务 #${d.currentTaskId}` : ''}
              />
            ))}
          </AlertCard>

          <AlertCard
            label="任务失败"
            labelEn="Failed tasks"
            count={failedTaskCount}
            href="/tasks"
            emptyText={loading ? '加载中...' : '无失败任务'}
          >
            {failedTasks.map((t) => (
              <AlertRow
                key={t.taskId}
                primary={(t.deviceName as string) || (t.actionType as string) || `#${t.taskId}`}
                secondary={t.plotName as string}
                meta={t.failReason ? truncate(t.failReason, 20) : (t.createdAt ? shortTime(t.createdAt) : '')}
              />
            ))}
          </AlertCard>
        </div>
      </section>

      {/* ==== §1.3 Today · 任务分布 + 最近任务 ==== */}
      <section className="folio-page__section" data-testid="dashboard-today">
        <h4 className="folio-page__section-title">
          今日动态 <em>· today</em>
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* 任务状态分布 (左 1 列) */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-[15px]">任务状态分布</CardTitle>
              <CardSeal>TASKS · BY STATUS</CardSeal>
            </CardHeader>
            <CardContent className="pb-2" data-testid="dashboard-chart-tasks">
              {taskPieData.length > 0 ? (
                <ReactECharts option={taskPieOption} className="dashboard-chart--h220" opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="py-12 text-center font-sans text-[13px] text-ink-faint">
                  {loading ? 'Loading…' : '暂无任务数据'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 最近任务 (右 2 列) */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-[15px]">最近任务</CardTitle>
                <CardSeal>RECENT · TASKS</CardSeal>
              </div>
              <Link
                to="/tasks"
                className="font-folio text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-ink"
              >
                查看全部 →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTasks.length > 0 ? (
                <table className="w-full font-sans text-[13px] text-ink">
                  <tbody>
                    {recentTasks.map((t, idx) => (
                      <tr
                        key={t.taskId}
                        className={idx > 0 ? 'border-t border-line-soft' : ''}
                      >
                        <td className="px-4 py-2.5 w-[96px]">
                          <span className="font-folio text-[11px] text-ink-faint">
                            {t.createdAt ? shortTime(t.createdAt) : '—'}
                          </span>
                        </td>
                        <td className="px-0 py-2.5">
                          <div className="text-ink">{t.deviceName || t.actionType || '—'}</div>
                          <div className="font-folio text-[10px] text-ink-faint">
                            {t.plotName ?? ''} {t.requesterName ? ` · ${t.requesterName}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 w-[90px] text-right">
                          <span
                            className="dashboard-task-status font-folio text-[10px] uppercase tracking-[0.15em]"
                            data-status={t.taskStatus}
                          >
                            {STATUS_LABEL[t.taskStatus] ?? t.taskStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center font-sans text-[13px] text-ink-faint">
                  {loading ? 'Loading…' : '暂无任务'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ==== §1.4 快捷入口 ==== */}
      <section className="folio-page__section" data-testid="dashboard-shortcuts">
        <h4 className="folio-page__section-title">
          快捷入口 <em>· shortcuts</em>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ShortcutLink to="/plots"           cn="新建地块"   en="Create plot" />
          <ShortcutLink to="/orders"          cn="新建订单"   en="New order" />
          <ShortcutLink to="/codes"           cn="签发认养码" en="Issue code" />
          <ShortcutLink to="/device-overview" cn="设备巡检"   en="Inspect devices" />
        </div>
      </section>
    </PageShell>
  )
}

// ============================================================
//  子组件
// ============================================================
interface AlertCardProps {
  label: string
  labelEn: string
  count: number
  href: string
  emptyText: string
  children: React.ReactNode
}
function AlertCard({ label, labelEn, count, href, emptyText, children }: AlertCardProps) {
  const empty = count === 0
  return (
    <div className={`dashboard-alert-card ${empty ? 'dashboard-alert-card--clear' : 'dashboard-alert-card--has'} border border-line bg-paper-light flex flex-col`}>
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-line-soft">
        <div className="flex items-baseline gap-2">
          {/* 异常计数 · DigitFlipper 翻牌 + 数字 > 0 时砖红呼吸 (B.2) */}
          <DigitFlipper value={count} size="default" alert={!empty} />
          <div className="flex flex-col">
            <span className="font-sans text-[13px] text-ink">{label}</span>
            <span className="font-folio text-[9px] uppercase tracking-[0.2em] text-ink-faint">
              {labelEn}
            </span>
          </div>
        </div>
        <Link
          to={href}
          className="font-folio text-[10px] uppercase tracking-[0.2em] text-ink-soft hover:text-ink"
        >
          查看 →
        </Link>
      </div>
      <div className="flex-1 min-h-[160px]">
        {empty ? (
          <div className="dashboard-alert-card__empty py-10 text-center font-sans text-[12px] text-ink-faint">
            <span className="dashboard-alert-card__empty-seal">已清 · ALL CLEAR</span>
            <span className="block mt-1">{emptyText}</span>
          </div>
        ) : (
          <div className="divide-y divide-line-soft">{children}</div>
        )}
      </div>
    </div>
  )
}

interface AlertRowProps {
  primary: string
  secondary?: string
  meta?: string
}
function AlertRow({ primary, secondary, meta }: AlertRowProps) {
  return (
    <div className="px-4 py-2 flex items-baseline justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-[13px] text-ink truncate">{primary}</span>
        {secondary && (
          <span className="font-folio text-[10px] text-ink-faint truncate">{secondary}</span>
        )}
      </div>
      {meta && (
        <span className="font-folio text-[10px] text-ink-faint whitespace-nowrap">{meta}</span>
      )}
    </div>
  )
}

function ShortcutLink({ to, cn, en }: { to: string; cn: string; en: string }) {
  return (
    <Link
      to={to}
      className="group px-4 py-3 border border-line-soft bg-paper-light hover:border-sage hover:bg-paper-deep/30 transition-colors flex items-center justify-between"
    >
      <div className="flex flex-col">
        <span className="font-sans text-[13px] text-ink">{cn}</span>
        <span className="font-folio text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {en}
        </span>
      </div>
      <span className="font-serif text-[16px] text-ink-soft group-hover:text-sage group-hover:translate-x-0.5 transition-all">
        →
      </span>
    </Link>
  )
}

// ============================================================
//  工具函数
// ============================================================
function shortTime(s: string): string {
  // "2026-04-24 13:03:53" → "04-24 13:03"
  if (!s) return '—'
  const m = s.match(/\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]}` : s
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
