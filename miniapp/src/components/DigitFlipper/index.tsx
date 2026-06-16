import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import './index.scss'

/**
 * DigitFlipper · 数字翻牌
 * ============================================================
 *  把一个数字 prop 包成"里程表式"翻动动效:
 *    - 每个字符一格, 字符变化时旧字符向上翻出, 新字符从下翻入
 *    - 用 transform: translateY 实现, GPU 友好, 不抢 React 主线程
 *    - 阈值越界 (alert prop) 时数字会做一次 0.4s 的呼吸闪烁
 *
 *  使用:
 *    <DigitFlipper value={26.5} unit="°" alert={false} />
 *    <DigitFlipper value="T2053..." mono compact />
 *
 *  设计意图:
 *    sensor cell 数字 / WORK ORDER 票据号 / 我的认养 stat
 *    全部由这一个组件托管, 让全站数字"会呼吸".
 *
 *  实现要点:
 *    - 用 ref 记录每位字符的 "上一帧字符", 字符变化时切换 className
 *    - CSS 端用 keyframes flip-down + flip-up, 0.36s 完成
 *    - 数字之外的字符 (.,-T 等) 不翻, 直接跟随
 * ============================================================ */

interface Props {
  /** 目标数字或字符串 */
  value: number | string
  /** 单位, 跟随在数字后, 不参与翻动 */
  unit?: string
  /** 阈值告警态, 触发一次砖红呼吸 */
  alert?: boolean
  /** 等宽字体 (票据号/编号场景) */
  mono?: boolean
  /** 字号变体 · default | hero (大号 hero 字号给票据用) | compact */
  size?: 'default' | 'hero' | 'compact'
}

function valueToString(v: number | string): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—'
    if (Math.abs(v) >= 1000) return String(Math.round(v))
    if (Math.abs(v) >= 100) return v.toFixed(0)
    if (Math.abs(v) >= 10) return v.toFixed(1)
    return v.toFixed(2)
  }
  return String(v ?? '—')
}

export default function DigitFlipper({
  value,
  unit,
  alert,
  mono,
  size = 'default',
}: Props) {
  const text = valueToString(value)

  // 上一帧的字符序列, 与当前对比 → 决定哪些位翻动
  const prevRef = useRef<string>(text)
  const [chars, setChars] = useState<{ ch: string; flipKey: number }[]>(() =>
    text.split('').map((ch) => ({ ch, flipKey: 0 })),
  )
  const flipKeyCounterRef = useRef(0)

  useEffect(() => {
    const prev = prevRef.current
    const next = text

    if (prev === next) return

    // 字符长度不一致直接整体重渲染, 不做翻动 (避免错位)
    const sameLen = prev.length === next.length
    flipKeyCounterRef.current += 1
    const k = flipKeyCounterRef.current

    if (!sameLen) {
      setChars(next.split('').map((ch) => ({ ch, flipKey: k })))
    } else {
      const arr = next.split('').map((ch, i) => {
        const changed = prev[i] !== ch
        return { ch, flipKey: changed ? k : 0 }
      })
      setChars(arr)
    }
    prevRef.current = next
  }, [text])

  const cls = [
    'flip',
    `flip--${size}`,
    mono ? 'flip--mono' : '',
    alert ? 'flip--alert' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={cls}>
      <View className='flip__row'>
        {chars.map((c, i) => (
          <View key={i} className='flip__cell'>
            {c.flipKey > 0 ? (
              // 翻动: 旧值 + 新值同 cell, 用 keyframes 错位
              <Text key={`new-${c.flipKey}-${i}`} className='flip__char flip__char--flipping'>
                {c.ch === ' ' ? '\u00A0' : c.ch}
              </Text>
            ) : (
              <Text className='flip__char'>{c.ch === ' ' ? '\u00A0' : c.ch}</Text>
            )}
          </View>
        ))}
      </View>
      {unit ? <Text className='flip__unit'>{unit}</Text> : null}
    </View>
  )
}
