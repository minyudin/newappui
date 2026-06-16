import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * PageQuote · 章首引言
 * ============================================================
 *  印刷品风, 紧贴 section title 之后, hairline 分隔.
 *  专给业务页面 §00x 章节用 (sensor / task / shares 等).
 *
 *  叙事意图:
 *    每一节都用一句农谚 / 古诗 / 小注开场, 让 app 像在读一本书.
 *
 *  样式:
 *    左侧 4px 长方块印章色 (default = farm-green)
 *    右侧衬线斜体 + 引号
 * ============================================================ */

interface Props {
  /** 引言主体, 自动加引号 */
  text: string
  /** 出处 / 作者, 可选 */
  source?: string
  /** 印章色, 默认跟随 --accent-current */
  tone?: 'default' | 'sand' | 'clay'
}

export default function PageQuote({ text, source, tone = 'default' }: Props) {
  return (
    <View className={`page-quote page-quote--${tone}`}>
      <View className='page-quote__bar' />
      <View className='page-quote__body'>
        <Text className='page-quote__text'>「{text}」</Text>
        {source ? <Text className='page-quote__source'>— {source}</Text> : null}
      </View>
    </View>
  )
}
