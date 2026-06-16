import { useEffect, useRef, useState } from 'react'
import './DigitFlipper.scss'

/**
 * DigitFlipper · 里程表式翻牌数字 · admin-next 版
 * ============================================================
 *  与 miniapp/src/components/DigitFlipper 视觉语言一致, 适配普通 DOM:
 *    · 把 prop value 包成"逐位翻动"的视觉, 字符变化时旧字符向上翻出, 新字符从下翻入
 *    · transform: translateY 实现, GPU 友好, 不抢主线程
 *    · alert 态 → 砖红 + 一次呼吸闪烁
 *
 *  设计意图:
 *    KPI 6 卡 / 异常计数 / 任务编号都用这个组件, 让 Dashboard 数字"会呼吸"
 *    同时与小程序的视觉语言保持一致, 印象统一
 *
 *  实现要点:
 *    · 用 ref 记录上一帧字符序列, 字符变化时用一个 flipKey 标记需要翻动的格子
 *    · CSS 端用 keyframes flip-in 0.36s 完成
 *    · 字符长度变化时整体重渲, 避免错位 (避免 7 位变 8 位时的串色)
 *    · 不会被 React 19 的 StrictMode 双 mount 打乱: prevRef 仅在 effect 内更新
 * ============================================================ */

interface Props {
  /** 目标数字或字符串 */
  value: number | string
  /** 单位, 跟随在数字后, 不参与翻动 */
  unit?: string
  /** 阈值告警态, 触发砖红呼吸 */
  alert?: boolean
  /** 等宽字体 (票据号 / 编号场景) */
  mono?: boolean
  /** 字号变体 · default 32 / hero 44 / kpi 44 / compact 18 */
  size?: 'default' | 'hero' | 'kpi' | 'compact'
  /** 额外的 className, 让外层 layout 调整不需要硬改组件 */
  className?: string
}

function valueToString(v: number | string): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '—'
    if (Math.abs(v) >= 1000) return String(Math.round(v))
    if (Math.abs(v) >= 100) return v.toFixed(0)
    if (Math.abs(v) >= 10) return v.toFixed(1)
    return v.toFixed(2)
  }
  // 数字 0 不能被当成 falsy 显示成 —
  if (v === '' || v === null || v === undefined) return '—'
  return String(v)
}

export default function DigitFlipper({
  value,
  unit,
  alert,
  mono,
  size = 'default',
  className,
}: Props) {
  const text = valueToString(value)

  const prevRef = useRef<string>(text)
  const [chars, setChars] = useState<{ ch: string; flipKey: number }[]>(() =>
    text.split('').map((ch) => ({ ch, flipKey: 0 })),
  )
  const flipKeyCounterRef = useRef(0)

  useEffect(() => {
    const prev = prevRef.current
    const next = text
    if (prev === next) return

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
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={cls}>
      <span className='flip__row'>
        {chars.map((c, i) => (
          <span key={i} className='flip__cell'>
            {c.flipKey > 0 ? (
              <span key={`new-${c.flipKey}-${i}`} className='flip__char flip__char--flipping'>
                {c.ch === ' ' ? '\u00A0' : c.ch}
              </span>
            ) : (
              <span className='flip__char'>{c.ch === ' ' ? '\u00A0' : c.ch}</span>
            )}
          </span>
        ))}
      </span>
      {unit ? <span className='flip__unit'>{unit}</span> : null}
    </span>
  )
}
