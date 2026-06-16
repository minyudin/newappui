import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { getSensorList, getSensorHistory } from '@/api/plot'
import type { Sensor, SensorHistory } from '@/types'
import './index.scss'

/**
 * PlotMicroBar · 认养列表卡片最底部的"今日读数带"
 * ============================================================
 *  展示该地块首个 environment 传感器近 1 小时里最新的 4 个指标值
 *  (温 / 湿 / 光 / CO₂, 或 soil 的 4 项).
 *
 *  后端契约补丁:
 *    `/plots/{id}/sensor-summary` 只返回"每个 sensor 一条聚合值",
 *    不按 metric 拆. 所以这里改走 `/plots/{id}/sensors` → 取第一个 sensor
 *    → `/sensors/{id}/history?1h&10m`, 拿 series[*].points.pop() 作为最新值.
 *
 *  性能: 模块级缓存 60s 每个 plotId 仅拉两次 API.
 * ============================================================ */

interface Props {
  plotId: number
}

const PREFERRED: Array<{ key: string; label: string; unit?: string }> = [
  { key: 'temperature', label: '温', unit: '°' },
  { key: 'humidity',    label: '湿', unit: '%' },
  { key: 'light',       label: '光', unit: 'lx' },
  { key: 'co2',         label: 'CO₂', unit: '' },
  { key: 'soilMoisture',    label: '土湿', unit: '%' },
  { key: 'soilTemperature', label: '土温', unit: '°' },
  { key: 'ph',              label: 'pH' },
  { key: 'nitrogen',        label: 'N' },
  { key: 'phosphorus',      label: 'P' },
  { key: 'potassium',       label: 'K' },
]

const TTL_MS = 60_000

interface CacheEntry {
  ts: number
  items: Item[]
  anyStale: boolean
}
const cache = new Map<number, CacheEntry>()

type Item = { key: string; label: string; value: string; stale: boolean }

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatValue(v: number | string | null | undefined): string {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (Math.abs(n) >= 1000) return String(Math.round(n))
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

function isStale(sampleAt: string | null | undefined): boolean {
  if (!sampleAt) return true
  const ts = new Date(sampleAt.replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return true
  return Date.now() - ts > 60 * 60 * 1000
}

async function buildItemsForPlot(plotId: number): Promise<CacheEntry> {
  const sensors: Sensor[] = await getSensorList(plotId).catch(() => [])
  if (!sensors || sensors.length === 0) {
    return { ts: Date.now(), items: [], anyStale: true }
  }
  // 优先取 environment 传感器, 没有就用第一个
  const pick =
    sensors.find((s) => s.category === 'environment') ??
    sensors.find((s) => s.sensorType === 'env') ??
    sensors[0]
  if (!pick) return { ts: Date.now(), items: [], anyStale: true }

  const now = new Date()
  const start = fmtDate(new Date(now.getTime() - 60 * 60 * 1000))
  const end = fmtDate(now)
  const history: SensorHistory | null = await getSensorHistory(pick.sensorId, start, end, '10m').catch(() => null)
  if (!history) return { ts: Date.now(), items: [], anyStale: true }

  // 从 series[] 拿每个 metric 最近一个 point
  const metricLast = new Map<string, { value: number | string; sampleAt: string }>()
  if (history.series && history.series.length > 0) {
    for (const s of history.series) {
      const last = s.points?.[s.points.length - 1]
      if (last) metricLast.set(s.metricKey, { value: last.value, sampleAt: last.sampleAt })
    }
  } else if (history.points && history.points.length > 0) {
    const last = history.points[history.points.length - 1]
    metricLast.set(history.sensorType || pick.sensorType || 'value', {
      value: last.value,
      sampleAt: last.sampleAt,
    })
  }

  const items: Item[] = []
  for (const pref of PREFERRED) {
    if (items.length >= 4) break
    const m = metricLast.get(pref.key)
    if (!m) continue
    items.push({
      key: pref.key,
      label: pref.label,
      value: formatValue(m.value) + (pref.unit || ''),
      stale: isStale(m.sampleAt),
    })
  }
  // fallback: 不认识 metric, 直接取前 4 个
  if (items.length === 0) {
    let i = 0
    for (const [k, v] of metricLast.entries()) {
      if (i >= 4) break
      items.push({
        key: k,
        label: k,
        value: formatValue(v.value),
        stale: isStale(v.sampleAt),
      })
      i++
    }
  }

  return {
    ts: Date.now(),
    items,
    anyStale: items.some((x) => x.stale),
  }
}

export default function PlotMicroBar({ plotId }: Props) {
  const [entry, setEntry] = useState<CacheEntry | null>(() => {
    const c = cache.get(plotId)
    return c && Date.now() - c.ts < TTL_MS ? c : null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!plotId) return
    const c = cache.get(plotId)
    if (c && Date.now() - c.ts < TTL_MS) {
      setEntry(c)
      return
    }
    let cancelled = false
    setLoading(true)
    buildItemsForPlot(plotId)
      .then((res) => {
        if (cancelled) return
        cache.set(plotId, res)
        setEntry(res)
      })
      .catch(() => {
        if (cancelled) return
        const empty: CacheEntry = { ts: Date.now(), items: [], anyStale: true }
        cache.set(plotId, empty)
        setEntry(empty)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [plotId])

  if (!entry || entry.items.length === 0) {
    return (
      <View className='microbar microbar--empty'>
        <Text className='microbar__dash'>
          {loading ? 'LOADING' : '— 暂无读数 —'}
        </Text>
      </View>
    )
  }

  return (
    <View className='microbar'>
      {entry.items.map((x) => (
        <View key={x.key} className={`microbar__cell ${x.stale ? 'microbar__cell--stale' : ''}`}>
          <Text className='microbar__label'>{x.label}</Text>
          <Text className='microbar__val'>{x.value}</Text>
        </View>
      ))}
      {entry.anyStale ? <Text className='microbar__tag'>stale</Text> : null}
    </View>
  )
}
