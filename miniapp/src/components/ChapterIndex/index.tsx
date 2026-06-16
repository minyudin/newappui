import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * ChapterIndex · 章节目录 (hairline 导航条)
 * ============================================================
 *  印刷品书脊扉页之后的"章节索引":
 *    §01  §02  §03  §04  §05
 *    批次 当前 历史 农事 操作
 *
 *  · 纯 hairline · 无圆角 · 当前章节下方加一条 2px 墨色粗线
 *  · 点击任一章节触发 onJump(index)
 *  · 外层页面负责监听 scroll, 更新 activeIndex
 * ============================================================ */

export interface ChapterItem {
  seal: string      // "§ 01"
  label: string     // "批次"
}

interface Props {
  items: ChapterItem[]
  activeIndex: number
  onJump?: (index: number) => void
}

export default function ChapterIndex({ items, activeIndex, onJump }: Props) {
  return (
    <View className='chapter-index'>
      {items.map((it, idx) => {
        const active = idx === activeIndex
        return (
          <View
            key={it.seal}
            className={`chapter-index__item ${active ? 'chapter-index__item--active' : ''}`}
            onClick={() => onJump?.(idx)}
          >
            <Text className='chapter-index__seal'>{it.seal}</Text>
            <Text className='chapter-index__label'>{it.label}</Text>
            <View className='chapter-index__bar' />
          </View>
        )
      })}
    </View>
  )
}
