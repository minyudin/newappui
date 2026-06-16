import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { getSensorList, getSensorHistory } from '@/api/plot'
import type { Sensor, SensorHistory, SensorSummary } from '@/types'

/**
 * SensorChart · 自实现 SVG 折线图 (miniapp 友好)
 * ============================================================
 *  - 不用 ec-canvas (太重 + 小程序 canvas 坑多)
 *  - 纯 SVG polyline · 完全契合 Folio 无阴影/无渐变 美学
 *  - 支持传感器切换 + 24h / 7d / 30d tabs
 * ============================================================ */

interface Props {
  plotId: number
  /** 上层拉过的 sensor-summary, 仅用于判断有没有传感器 · 非必需 */
  sensors: SensorSummary | null
}

type Range = '24h' | '7d' | '30d'

const RANGES: { value: Range; label: string; granularity: '10m' | '1h' | '1d'; days: number }[] = [
  { value: '24h', label: '24H', granularity: '10m', days: 1 },
  { value: '7d', label: '7D', granularity: '1h', days: 7 },
  { value: '30d', label: '30D', granularity: '1d', days: 30 },
]

// SVG 视口尺寸 · miniapp rpx 即 px
const VIEW_W = 630
const VIEW_H = 220
const PAD_L = 40
const PAD_R = 20
const PAD_T = 16
const PAD_B = 28

export default function SensorChart({ plotId, sensors }: Props) {
  const [sensorList, setSensorList] = useState<Sensor[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [range, setRange] = useState<Range>('24h')
  const [history, setHistory] = useState<SensorHistory | null>(null)
  const [loading, setLoading] = useState(false)

  // 拉传感器列表 (含 sensorId, 用于 history 调用)
  //   M1 · cleanup 里标记 cancelled, 切换 plotId 时旧请求回来不再 setState
  useEffect(() => {
    if (!plotId) return
    let cancelled = false
    getSensorList(plotId)
      .then((list) => {
        if (cancelled) return
        setSensorList(list)
        if (list.length > 0) {
          setSelectedId((prev) => prev ?? list[0].sensorId)
        }
      })
      .catch(() => {
        if (cancelled) return
        setSensorList([])
      })
    return () => { cancelled = true }
  }, [plotId])

  // 切换 sensor / range → 拉 history
  //   M1 · 快速切 sensor A→B 时, A 后返回会错写 B 选中态的 history, 这里兜住
  useEffect(() => {
    if (!selectedId) {
      setHistory(null)
      return
    }
    const cur = RANGES.find((r) => r.value === range)!
    const now = new Date()
    const start = new Date(now.getTime() - cur.days * 86400_000)

    let cancelled = false
    setLoading(true)
    getSensorHistory(selectedId, fmt(start), fmt(now), cur.granularity)
      .then((h) => { if (!cancelled) setHistory(h) })
      .catch(() => { if (!cancelled) setHistory(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, range])

  const seriesData = useMemo(() => {
    if (!history) return []
    // 生产模式: 优先消费后端多序列 series; 兼容旧结构 points
    if (history.series && history.series.length > 0) {
      return history.series
        .map((s) => ({
          metricKey: s.metricKey,
          points: (s.points || [])
            .map((p) => ({
              t: p.sampleAt,
              v: typeof p.value === 'string' ? Number(p.value) : p.value,
            }))
            .filter((p) => Number.isFinite(p.v)),
        }))
        .filter((s) => s.points.length > 0)
    }
    const legacyPoints = (history.points || [])
      .map((p) => ({
        t: p.sampleAt,
        v: typeof p.value === 'string' ? Number(p.value) : p.value,
      }))
      .filter((p) => Number.isFinite(p.v))
    return legacyPoints.length ? [{ metricKey: history.sensorType || 'value', points: legacyPoints }] : []
  }, [history])

  // 计算 path
  const { paths, xAxis, yAxis } = useMemo(() => {
    if (seriesData.length === 0) {
      return { paths: [] as Array<{ metricKey: string; d: string; color: string }>, xAxis: [], yAxis: [] as number[] }
    }
    const values = seriesData.flatMap((s) => s.points.map((p) => p.v)).filter((v) => Number.isFinite(v))
    if (values.length === 0) {
      return { paths: [] as Array<{ metricKey: string; d: string; color: string }>, xAxis: [], yAxis: [] as number[] }
    }
    let minV = Math.min(...values)
    let maxV = Math.max(...values)
    if (minV === maxV) {
      minV = minV - 1
      maxV = maxV + 1
    }
    const span = maxV - minV
    const innerW = VIEW_W - PAD_L - PAD_R
    const innerH = VIEW_H - PAD_T - PAD_B

    const paths = seriesData.map((series, sidx) => {
      const pathParts = series.points.map((p, i) => {
        const x = PAD_L + (i / Math.max(series.points.length - 1, 1)) * innerW
        const y = PAD_T + (1 - (p.v - minV) / span) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      return {
        metricKey: series.metricKey,
        d: pathParts.join(' '),
        color: lineColor(sidx),
      }
    })

    // Y 轴 3 条横线: min, mid, max
    const yAxis = [maxV, (maxV + minV) / 2, minV]

    // X 轴 4 个刻度
    const basePoints = seriesData[0].points
    const xAxis: { x: number; label: string }[] = []
    const steps = 4
    for (let i = 0; i < steps; i++) {
      const idx = Math.floor(((basePoints.length - 1) * i) / (steps - 1))
      const x = PAD_L + (idx / Math.max(basePoints.length - 1, 1)) * innerW
      const t = basePoints[idx]?.t || ''
      xAxis.push({ x, label: formatTick(t, range) })
    }

    return { paths, xAxis, yAxis }
  }, [seriesData, range])

  const selectedSensor = sensorList.find((s) => s.sensorId === selectedId)

  if (sensorList.length === 0) {
    // 上级的 sensor-summary 也为空, 不渲染 chart 块
    if (!sensors || !sensors.summary || sensors.summary.length === 0) {
      return null
    }
    return <Text className='chart-empty'>— 传感器列表加载中 —</Text>
  }

  return (
    <View className='chart'>
      {/* --- 传感器 tab --- */}
      <View className='chart__sensors'>
        {sensorList.map((s) => (
          <View
            key={s.sensorId}
            className={`chart__sensor-tab ${
              s.sensorId === selectedId ? 'chart__sensor-tab--active' : ''
            }`}
            onClick={() => setSelectedId(s.sensorId)}
          >
            <Text className='chart__sensor-name'>
              {s.sensorName || sensorLabel(s.sensorType)}
            </Text>
            <Text className='chart__sensor-type'>
              {s.sensorType}
              {s.unit ? ` · ${s.unit}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* --- range 切换 --- */}
      <View className='chart__ranges'>
        {RANGES.map((r) => (
          <Text
            key={r.value}
            className={`chart__range ${range === r.value ? 'chart__range--active' : ''}`}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </Text>
        ))}
      </View>

      {/* --- SVG 曲线 --- */}
      <View className='chart__canvas'>
        {loading ? (
          <Text className='chart-empty'>— Loading —</Text>
        ) : seriesData.length === 0 ? (
          <Text className='chart-empty'>— 暂无历史数据 —</Text>
        ) : (
          <svg
            className='chart__svg'
            width={`${VIEW_W}px`}
            height={`${VIEW_H}px`}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            xmlns='http://www.w3.org/2000/svg'
          >
            {/* Y 轴刻度线 + 值 */}
            {yAxis.map((yv, i) => {
              const yRatio = (yAxis[0] - yv) / Math.max(yAxis[0] - yAxis[yAxis.length - 1], 0.0001)
              const y = PAD_T + yRatio * (VIEW_H - PAD_T - PAD_B)
              return (
                <g key={i}>
                  <line
                    x1={PAD_L}
                    x2={VIEW_W - PAD_R}
                    y1={y}
                    y2={y}
                    stroke='#dcd8cf'
                    strokeWidth='1'
                    strokeDasharray={i === 1 ? '0' : '2,3'}
                  />
                  <text
                    x={PAD_L - 6}
                    y={y + 4}
                    fontSize='12'
                    fontFamily='monospace'
                    fill='#8a857b'
                    textAnchor='end'
                  >
                    {fmtNum(yv)}
                  </text>
                </g>
              )
            })}

            {/* X 轴刻度 */}
            {xAxis.map((t, i) => (
              <text
                key={i}
                x={t.x}
                y={VIEW_H - 8}
                fontSize='12'
                fontFamily='monospace'
                fill='#8a857b'
                textAnchor={i === 0 ? 'start' : i === xAxis.length - 1 ? 'end' : 'middle'}
              >
                {t.label}
              </text>
            ))}

            {/* 曲线(多指标) */}
            {paths.map((p) => (
              <path key={p.metricKey} d={p.d} stroke={p.color} strokeWidth='1.5' fill='none' strokeLinejoin='round' />
            ))}
          </svg>
        )}
      </View>

      {paths.length > 1 ? (
        <View className='chart__legend'>
          {paths.map((p) => (
            <View key={p.metricKey} className='chart__legend-item'>
              <Text className='chart__legend-dot' style={{ color: p.color }}>●</Text>
              <Text className='chart__legend-text'>{metricLabel(p.metricKey)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {selectedSensor ? (
        <Text className='chart__footer'>
          · {selectedSensor.deviceNo}
          {selectedSensor.lastSampleAt ? ` · 最后更新 ${selectedSensor.lastSampleAt.slice(5, 16)}` : ''}
        </Text>
      ) : null}
    </View>
  )
}

// ---- 辅助 ----
function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatTick(t: string, range: Range): string {
  if (!t) return ''
  // t: 'yyyy-MM-dd HH:mm:ss'
  if (range === '24h') return t.slice(11, 16) // HH:mm
  if (range === '7d') return t.slice(5, 10)   // MM-dd
  return t.slice(5, 10)                        // MM-dd
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

function sensorLabel(type: string): string {
  const MAP: Record<string, string> = {
    temperature: '气温',
    humidity: '空气湿度',
    light: '光照',
    co2: 'CO₂',
    soil_temperature: '土温',
    soil_moisture: '土湿',
    soil_ph: '土 pH',
  }
  return MAP[type] || type
}

function metricLabel(metricKey: string): string {
  const MAP: Record<string, string> = {
    ph: 'pH',
    soilTemp: '土温',
    soilMoisture: '土湿',
    temperature: '气温',
    humidity: '湿度',
    light: '光照',
    co2: 'CO₂',
    N: '氮',
    P: '磷',
    K: '钾',
  }
  return MAP[metricKey] || metricKey
}

function lineColor(index: number): string {
  const palette = ['#2d2a26', '#6f8a6f', '#9a7d62', '#627b9a', '#8d6a92']
  return palette[index % palette.length]
}
