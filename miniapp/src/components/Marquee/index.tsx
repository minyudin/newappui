import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * Marquee · 横向跑马字幕
 * ============================================================
 *  awwwards 风装饰 · 一行小字横向无限滚动
 *  实现: 把 items 写两遍 (A + A 副本), 用 CSS animation 横向 -50%
 *
 *  使用:
 *    <Marquee items={['§ FOLIO No.07', '智慧农业', ...]} speed={42} />
 * ============================================================ */

interface Props {
  items: string[]
  /** 完整滚一圈的秒数, 默认 42 */
  speed?: number
  /** 是否加 hairline 上下分隔 */
  ruled?: boolean
}

export default function Marquee({ items, speed = 42, ruled = true }: Props) {
  if (!items || items.length === 0) return null

  // 把每项之间用 · 分隔, 形成一长串
  const joined = items.join('  ·  ')

  return (
    <View className={`marquee ${ruled ? 'marquee--ruled' : ''}`}>
      <View
        className='marquee__track'
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        <Text className='marquee__group'>{joined}  ·  </Text>
        <Text className='marquee__group'>{joined}  ·  </Text>
      </View>
    </View>
  )
}
