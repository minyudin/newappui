import './Marquee.scss'

/**
 * Marquee · 横向跑马字幕 · admin-next 版
 * ============================================================
 *  Folio 风装饰 · 一行小字横向无限滚动
 *
 *  实现:
 *   · 把 items join 成一长串, 写两遍 (A + A 副本), 用 CSS animation translateX(-50%)
 *   · animation-duration 由 prop speed 控制 (默认 42 秒一圈)
 *   · 不用 JS 计算速度, GPU 友好, 不抢主线程
 *
 *  使用:
 *    <Marquee items={['§ FOLIO', '陇上认养', 'EST. 2026']} speed={42} />
 * ============================================================ */

interface Props {
  items: string[]
  /** 完整滚一圈的秒数, 默认 42 */
  speed?: number
  /** 是否加 hairline 上下分隔, 默认 true */
  ruled?: boolean
  /** 文本色变体 · default = ink-soft / faint = ink-faint (登录页用 faint) */
  tone?: 'default' | 'faint'
}

export default function Marquee({ items, speed = 42, ruled = true, tone = 'default' }: Props) {
  if (!items || items.length === 0) return null

  // 用 · 分隔每一项, 形成一长串无限循环可读片段
  const joined = items.join('  ·  ')

  return (
    <div className={`marquee ${ruled ? 'marquee--ruled' : ''} marquee--${tone}`} aria-hidden='true'>
      <div
        className='marquee__track'
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        <span className='marquee__group'>{joined}  ·  </span>
        <span className='marquee__group'>{joined}  ·  </span>
      </div>
    </div>
  )
}
