import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button } from '@/components/ui'
import { getPlotSensorOverview } from '@/api'
import { qk } from '@/lib/queryKeys'
import type { Plot } from '@/types/api'
import './PlotTree.scss'

/**
 * PlotTree · 大棚 → 子点位 嵌套列表 (C.1 重构)
 * ============================================================
 *  设计意图:
 *   PlotsPage 之前是一张纯平铺表 (大棚 + 点位混在一起 + 每行 6 个绑定按钮),
 *   纵向 1200px 看完一屏只够 8 - 10 行, 操作密度极差. 这次改成两层:
 *
 *     §大棚 1 · 示范大棚·1号        2 子点位 · 18 亩 · 使用中     [+ 子点位]
 *       └ §点位 1 · 1号-A区          [传感器条 · 26.5℃ 72% 18kLux]    [详情]
 *       └ §点位 2 · 1号-B区          [传感器条 · 25.1℃ 80% 12kLux]    [详情]
 *     §大棚 2 · 示范大棚·2号        ...
 *
 *  视觉:
 *   · 大棚行: hairline-bottom 实线 + 黑墨字 + sand badge
 *   · 子点位行: 缩进 24px + 浅墨字 + 末端微数据条
 *   · 整组之间 hairline-soft 分隔, 点开后 expand 抽屉直接覆盖此组
 *
 *  实现:
 *   · 父级 useState 保存 expanded greenhouse Set + activeChildId
 *   · 每个子点位需要的 sensor overview 是按需 lazy fetch (`enabled: expanded && rowVisible`)
 *   · 抽屉内嵌 5 个 binding 入口, 复用父级 PlotsPage 现有的 5 个 Dialog
 *
 *  注意:
 *   · "大棚" 与 "子点位" 的判定: 同 PlotsPage 业务逻辑 = parentId 为空即大棚
 *   · 大棚自己也可以接绑定 (历史数据), 但新设计鼓励"大棚做容器, 子点位做工地"
 * ============================================================ */

export interface PlotTreeAction {
  type: 'detail' | 'edit' | 'camera' | 'sensor' | 'actuator' | 'screen' | 'batch' | 'lifecycle' | 'order'
  plot: Plot
}

interface Props {
  /** 主列表(已分页) · 可能只有大棚也可能混合 */
  list: Plot[]
  /** 全量地块 (前 100 条), 用来给每个大棚抓自己的子点位 */
  allPlots: Plot[]
  loading: boolean
  /** 操作分发 · 父级 PlotsPage 用来打开各种 Dialog */
  onAction: (action: PlotTreeAction) => void
}

export default function PlotTree({ list, allPlots, loading, onAction }: Props) {
  // 列表里只取大棚级 (parentId 为空); 如果同时筛选了 parentId, list 里也可能直接是子点位
  const greenhouses = useMemo(() => list.filter((p) => !p.parentId), [list])
  const orphanChildren = useMemo(() => list.filter((p) => !!p.parentId), [list])

  // 全量子点位索引 · greenhouseId -> [child]
  const childrenByParent = useMemo(() => {
    const m = new Map<number, Plot[]>()
    for (const p of allPlots) {
      const pid = p.parentId as number | undefined
      if (pid) {
        const arr = m.get(pid) ?? []
        arr.push(p)
        m.set(pid, arr)
      }
    }
    return m
  }, [allPlots])

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  function toggle(id: number) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading && list.length === 0) {
    return <div className="plot-tree__empty">— Loading folio… —</div>
  }
  if (list.length === 0) {
    return <div className="plot-tree__empty">— 暂无地块 —</div>
  }

  return (
    <div className="plot-tree">
      {/* 主列表: 按筛选状态显示大棚或孤儿子点位 */}
      {greenhouses.map((g, gi) => (
        <GreenhouseSection
          key={g.plotId}
          index={gi + 1}
          greenhouse={g}
          children={childrenByParent.get(g.plotId) ?? []}
          isExpanded={expanded.has(g.plotId)}
          onToggle={() => toggle(g.plotId)}
          onAction={onAction}
        />
      ))}
      {/* 当筛选了 parentId 时, list 里的元素都是子点位, 没有 greenhouse 套, 直接铺开 */}
      {orphanChildren.length > 0 && (
        <div className="plot-tree__greenhouse plot-tree__greenhouse--orphan">
          <div className="plot-tree__greenhouse-head">
            <span className="plot-tree__greenhouse-seal">§ FILTER</span>
            <span className="plot-tree__greenhouse-name">已筛选子点位</span>
            <span className="plot-tree__greenhouse-meta">{orphanChildren.length} 项</span>
          </div>
          <div className="plot-tree__children">
            {orphanChildren.map((c) => (
              <ChildPlotRow key={c.plotId} plot={c} onAction={onAction} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface GreenhouseSectionProps {
  index: number
  greenhouse: Plot
  children: Plot[]
  isExpanded: boolean
  onToggle: () => void
  onAction: (a: PlotTreeAction) => void
}

function GreenhouseSection({ index, greenhouse, children, isExpanded, onToggle, onAction }: GreenhouseSectionProps) {
  const childCount = children.length
  const totalArea = useMemo(() => {
    let sum = 0
    for (const c of children) {
      const a = Number(c.areaSize ?? 0)
      if (Number.isFinite(a)) sum += a
    }
    return sum
  }, [children])

  const status = String(greenhouse.plotStatus ?? '—')
  const isActive = status === 'active'
  // 默认展开第 1 - 2 个大棚, 让用户落地就看到层级
  const expanded = isExpanded || index <= 2

  return (
    <div className={`plot-tree__greenhouse ${expanded ? 'plot-tree__greenhouse--open' : ''}`}>
      <div
        className="plot-tree__greenhouse-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <span className="plot-tree__greenhouse-seal">§{String(index).padStart(2, '0')}</span>
        <span className="plot-tree__greenhouse-arrow" data-open={expanded ? '1' : '0'}>▸</span>
        <span className="plot-tree__greenhouse-name">{String(greenhouse.plotName ?? greenhouse.name ?? '—')}</span>
        {greenhouse.plotNo ? (
          <span className="plot-tree__greenhouse-no">{String(greenhouse.plotNo)}</span>
        ) : null}
        <span className="plot-tree__greenhouse-meta">
          <span>{childCount} 子点位</span>
          {totalArea > 0 ? <><span className="plot-tree__dot">·</span><span>{totalArea.toFixed(1)} 亩</span></> : null}
          <span className="plot-tree__dot">·</span>
          <Badge tone={isActive ? 'sage' : 'neutral'}>
            {isActive ? '使用中' : status}
          </Badge>
        </span>
        <span className="plot-tree__greenhouse-actions">
          <Button
            variant="link"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onAction({ type: 'detail', plot: greenhouse }) }}
            data-testid={`plots-greenhouse-detail-${greenhouse.plotId}`}
          >
            详情
          </Button>
          <span className="plot-tree__dot">·</span>
          <Button
            variant="link"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onAction({ type: 'screen', plot: greenhouse }) }}
          >
            绑大屏
          </Button>
        </span>
      </div>

      {expanded && (
        <div className="plot-tree__children">
          {childCount === 0 ? (
            <div className="plot-tree__empty-children">
              此大棚还没有子点位 ·{' '}
              <button
                type="button"
                className="plot-tree__inline-link"
                onClick={() => onAction({ type: 'edit', plot: greenhouse })}
              >
                查看大棚
              </button>
            </div>
          ) : (
            children.map((c) => (
              <ChildPlotRow key={c.plotId} plot={c} onAction={onAction} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
//  Child plot row · 单条子点位 + micro 数据条 + 行内抽屉
// ============================================================
interface ChildPlotRowProps {
  plot: Plot
  onAction: (a: PlotTreeAction) => void
}

function ChildPlotRow({ plot, onAction }: ChildPlotRowProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 仅在抽屉打开时拉 sensor overview, 避免一次性 N+1
  const { data: overview, isPending: ovLoading } = useQuery({
    queryKey: ['plots', 'sensor-overview', plot.plotId] as const,
    queryFn: () => getPlotSensorOverview(plot.plotId),
    staleTime: 15_000,
    enabled: drawerOpen,
  }) as { data: any; isPending: boolean }

  const status = String(plot.plotStatus ?? '—')
  const isActive = status === 'active'

  return (
    <div className={`plot-tree__child ${drawerOpen ? 'plot-tree__child--open' : ''}`}>
      <div
        className="plot-tree__child-row"
        onClick={() => setDrawerOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setDrawerOpen((v) => !v)
          }
        }}
        data-testid={`plots-child-row-${plot.plotId}`}
      >
        <span className="plot-tree__child-bullet">└</span>
        <span className="plot-tree__child-name">{String(plot.plotName ?? plot.name ?? '—')}</span>
        {plot.plotNo ? (
          <span className="plot-tree__child-no">{String(plot.plotNo)}</span>
        ) : null}
        {plot.areaSize ? (
          <span className="plot-tree__child-area">
            {String(plot.areaSize)}
            <span className="plot-tree__child-unit">{String(plot.areaUnit ?? 'mu')}</span>
          </span>
        ) : null}
        <Badge tone={isActive ? 'sage' : 'neutral'}>
          {isActive ? '使用中' : status}
        </Badge>
        <span className="plot-tree__child-arrow" data-open={drawerOpen ? '1' : '0'}>▾</span>
      </div>

      {drawerOpen && (
        <div className="plot-tree__drawer" data-testid={`plots-child-drawer-${plot.plotId}`}>
          {/* §A · 微数据条 · 环境聚合 (温/湿/光照/CO2) */}
          <div className="plot-tree__metrics">
            <div className="plot-tree__metrics-head">
              <span className="plot-tree__metrics-seal">§A · ENVIRONMENT</span>
              <span className="plot-tree__metrics-meta">
                {ovLoading ? 'fetching…' : (overview?.updatedAt ? `updated · ${shortTime(String(overview.updatedAt))}` : '—')}
              </span>
            </div>
            <MicroBar metrics={extractEnvMetrics(overview)} loading={ovLoading} fallback={'尚无环境传感器'} />
          </div>

          {/* §B · 土壤传感器 · 多个点位 */}
          <div className="plot-tree__metrics">
            <div className="plot-tree__metrics-head">
              <span className="plot-tree__metrics-seal">§B · SOIL</span>
              <span className="plot-tree__metrics-meta">
                {overview?.soil ? `${overview.soil.length} 个点位` : ''}
              </span>
            </div>
            <SoilList soilGroups={overview?.soil ?? []} loading={ovLoading} />
          </div>

          {/* §C · 行内操作 · 5 个绑定 + 详情/订单 */}
          <div className="plot-tree__actions">
            <span className="plot-tree__actions-seal">§C · ACTIONS</span>
            <div className="plot-tree__actions-row">
              <Button variant="primary" size="sm" onClick={() => onAction({ type: 'batch', plot })}>+ 新批次</Button>
              <Button variant="secondary" size="sm" onClick={() => onAction({ type: 'order', plot })}>+ 订单</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'camera', plot })}>绑摄像头</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'sensor', plot })}>绑传感器</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'actuator', plot })}>绑执行设备</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'screen', plot })}>绑大屏</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'lifecycle', plot })}>设备治理</Button>
              <span className="plot-tree__sep" />
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'detail', plot })}>详情</Button>
              <span className="plot-tree__dot">·</span>
              <Button variant="link" size="sm" onClick={() => onAction({ type: 'edit', plot })}>编辑</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
//  MicroBar · 环境指标条 (温度 / 湿度 / 光照 / CO2)
// ============================================================
interface MetricCell {
  key: string
  labelCn: string
  labelEn: string
  value: number | string | null
  unit?: string
  /** 安全 / 警告 / 危险 · 影响色彩与有 stripe */
  level?: 'ok' | 'warn' | 'danger'
}

function MicroBar({ metrics, loading, fallback }: { metrics: MetricCell[]; loading: boolean; fallback: string }) {
  if (loading) {
    return <div className="plot-tree__microbar plot-tree__microbar--loading">fetching environment…</div>
  }
  if (metrics.length === 0) {
    return <div className="plot-tree__microbar plot-tree__microbar--empty">{fallback}</div>
  }
  return (
    <div className="plot-tree__microbar">
      {metrics.map((m, i) => (
        <div key={m.key} className={`plot-tree__metric plot-tree__metric--${m.level ?? 'ok'}`} data-first={i === 0 ? '1' : '0'}>
          <div className="plot-tree__metric-label">
            <span className="plot-tree__metric-cn">{m.labelCn}</span>
            <span className="plot-tree__metric-en">{m.labelEn}</span>
          </div>
          <div className="plot-tree__metric-value">
            <span className="plot-tree__metric-num">{m.value === null || m.value === undefined ? '—' : String(m.value)}</span>
            {m.unit ? <span className="plot-tree__metric-unit">{m.unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

interface SoilGroup {
  sensorId: number
  sensorName?: string
  deviceNo?: string
  status?: string
  metrics?: Record<string, unknown>
}

function SoilList({ soilGroups, loading }: { soilGroups: SoilGroup[]; loading: boolean }) {
  if (loading) return <div className="plot-tree__microbar plot-tree__microbar--loading">fetching soil…</div>
  if (soilGroups.length === 0) return <div className="plot-tree__microbar plot-tree__microbar--empty">尚无土壤传感器</div>
  return (
    <div className="plot-tree__soil">
      {soilGroups.map((g) => (
        <div key={g.sensorId} className="plot-tree__soil-row">
          <div className="plot-tree__soil-head">
            <span className="plot-tree__soil-name">{String(g.sensorName ?? g.deviceNo ?? `#${g.sensorId}`)}</span>
            <span className="plot-tree__soil-no">{String(g.deviceNo ?? '')}</span>
            <Badge tone={g.status === 'online' ? 'sage' : 'neutral'}>
              {g.status === 'online' ? '在线' : (g.status ?? '—')}
            </Badge>
          </div>
          <div className="plot-tree__soil-metrics">
            {g.metrics && Object.keys(g.metrics).length > 0 ? (
              Object.entries(g.metrics).map(([k, v]) => (
                <span key={k} className="plot-tree__soil-metric">
                  <span className="plot-tree__soil-k">{k}</span>
                  <span className="plot-tree__soil-v">{formatNum(v)}</span>
                </span>
              ))
            ) : (
              <span className="plot-tree__soil-empty">尚无数据</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  utils
// ============================================================

/**
 * 把后端 environment 数组拍平成温/湿/光/CO2 4 个常用指标
 * 支持中英文 key (温度/temp/temperature, 湿度/humidity, 光照/light/illumin, CO2/co2)
 */
function extractEnvMetrics(overview: any): MetricCell[] {
  if (!overview || !Array.isArray(overview.environment) || overview.environment.length === 0) return []
  // 把所有环境传感器的 metrics map 并起来 (后写优先, 视为最新)
  const merged: Record<string, unknown> = {}
  for (const g of overview.environment) {
    if (g?.metrics && typeof g.metrics === 'object') {
      Object.assign(merged, g.metrics)
    }
  }
  function pick(keys: string[]): unknown {
    for (const k of keys) {
      if (merged[k] !== undefined && merged[k] !== null) return merged[k]
    }
    return null
  }
  const temp = pick(['温度', 'temperature', 'temp'])
  const humidity = pick(['湿度', 'humidity', 'rh'])
  const light = pick(['光照', '光照度', 'light', 'illumin', 'illuminance'])
  const co2 = pick(['CO2', 'co2', '二氧化碳'])
  const cells: MetricCell[] = []
  if (temp !== null) cells.push(makeCell('temp', '温度', 'TEMP', temp, '℃', leveler(temp, [10, 35])))
  if (humidity !== null) cells.push(makeCell('rh', '湿度', 'RH', humidity, '%', leveler(humidity, [40, 85])))
  if (light !== null) cells.push(makeCell('light', '光照', 'LIGHT', light, 'lux'))
  if (co2 !== null) cells.push(makeCell('co2', 'CO₂', 'CO2', co2, 'ppm', leveler(co2, [350, 1500])))
  return cells
}

function makeCell(key: string, cn: string, en: string, v: unknown, unit: string, level?: 'ok' | 'warn' | 'danger'): MetricCell {
  return { key, labelCn: cn, labelEn: en, value: formatNum(v), unit, level }
}

function leveler(v: unknown, [lo, hi]: [number, number]): 'ok' | 'warn' | 'danger' {
  const n = Number(v)
  if (!Number.isFinite(n)) return 'ok'
  if (n < lo * 0.6 || n > hi * 1.2) return 'danger'
  if (n < lo || n > hi) return 'warn'
  return 'ok'
}

function formatNum(v: unknown): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString()
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

function shortTime(s: string): string {
  if (!s) return '—'
  const m = s.match(/\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]}` : s
}

// 阻止编译器报 qk 未用 (将来按需扩展时仍需用到)
void qk
