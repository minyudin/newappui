import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import { getSensorHistory } from '@/api/plot'
import type { SensorHistory } from '@/types'

/**
 * SensorCellSpark · §02 传感器当前值 cell 右上角的迷你趋势线
 * ============================================================
 *  · 24h · 10m 粒度 · 最多 ~144 点
 *  · 纯 SVG polyline · 1px hairline · 终点加一个 3x3 墨色方块
 *  · 不画坐标轴 · 不画刻度 · 印刷品感: "只是一条墨线, 让数字有方向"
 *
 *  props:
 *    sensorId    — 对应 sensor_device.id
 *    sensorType  — 用于匹配 history 返回里第一条 series
 *    alert       — 当前值是否超阈值 · 超 → 末端墨点换砖红
 *
 *  性能控制:
 *    · 组件级 useState cache 24h history per sensorId 一次, 重新挂载不再请求
 *    · 每个 cell 单独请求一次, 4 个 sensor = 4 个请求, 在可接受范围
 *    · 404 / 权限问题直接降级为空, 不阻塞 cell 其他内容
 * ============================================================ */

interface Props {
  sensorId: number | null | undefined
  sensorType?: string | null
  alert?: boolean
}

// 模块级缓存 · sensorId -> { ts, history }
// 同 app 生命周期内切换 plot 再切回来能命中
const HISTORY_TTL_MS = 60_000
const historyCache = new Map<number, { ts: number; history: SensorHistory }>()

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n) }
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// SVG 视口
const VB_W = 120
const VB_H = 36
const PAD_X = 2
const PAD_Y = 3

export default function SensorCellSpark({ sensorId, sensorType, alert }: Props) {
  const [history, setHistory] = useState<SensorHistory | null>(null)

  useEffect(() => {
    if (!sensorId) {
      setHistory(null)
      return
    }
    const cached = historyCache.get(sensorId)
    if (cached && Date.now() - cached.ts < HISTORY_TTL_MS) {
      setHistory(cached.history)
      return
    }
    let cancelled = false
    const now = new Date()
    const end = fmtDate(now)
    const start = fmtDate(new Date(now.getTime() - 24 * 60 * 60 * 1000))
    getSensorHistory(sensorId, start, end, '10m')
      .then((h) => {
        if (cancelled) return
        historyCache.set(sensorId, { ts: Date.now(), history: h })
        setHistory(h)
      })
      .catch(() => {
        if (cancelled) return
        setHistory(null)
      })
    return () => {
      cancelled = true
    }
  }, [sensorId])

  const path = useMemo(() => {
    if (!history) return null
    // 优先从 series[] 找与 sensorType 同名的 metric
    let rawPoints: Array<{ sampleAt: string; value: number | string }> | null = null
    if (history.series && history.series.length > 0) {
      const matched =
        history.series.find((s) => s.metricKey === sensorType) || history.series[0]
      rawPoints = matched?.points || null
    }
    // 否则用 flat points (单指标传感器)
    if (!rawPoints && history.points && history.points.length > 0) {
      rawPoints = history.points
    }
    if (!rawPoints || rawPoints.length < 2) return null

    // 取最近 48 点够用
    const slice = rawPoints.slice(-48)
    const values = slice
      .map((p) => Number(p.value))
      .filter((n) => Number.isFinite(n))
    if (values.length < 2) return null

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(1e-6, max - min)
    const step = (VB_W - PAD_X * 2) / Math.max(1, values.length - 1)
    const yScale = (VB_H - PAD_Y * 2) / range
    const coords = values.map((v, i) => {
      const x = PAD_X + i * step
      const y = VB_H - PAD_Y - (v - min) * yScale
      return [x, y] as const
    })
    const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    const last = coords[coords.length - 1]
    return { d, last }
  }, [history, sensorType])

  if (!sensorId) return null

  return (
    <View className='spark'>
      {path ? (
        <View
          className='spark__svg'
          // Taro H5 + wxml 都支持原生 svg 字符串; 用 dangerouslySetInnerHTML 模式在 taro-h5 下可行
          //   -- 为兼容 weapp, 这里用若干 SVG 原语
          style={{ width: '100%', height: '100%' }}
        >
          {/* Taro-H5 里 <image> 不支持 svg 内联; 用 <div> + mask 兜底
               在 weapp 里同样不会渲染, 改用 canvas 太重. 这里直接依赖 Taro 的
               jsx-to-wxml 编译对 svg-container 的降级. 如果你在 weapp 预览中看不见,
               可以换成 canvas, 但当前闭环只跑 H5 预览, 够用. */}
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio='none'
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <path d={path.d} stroke={alert ? '#c5826a' : '#2d2a26'} strokeWidth='1' fill='none' strokeLinecap='round' />
            <rect
              x={path.last[0] - 1.2}
              y={path.last[1] - 1.2}
              width='2.4'
              height='2.4'
              fill={alert ? '#c5826a' : '#2d2a26'}
            />
          </svg>
        </View>
      ) : (
        <Text className='spark__dash'>—</Text>
      )}
    </View>
  )
}
