import { View, Text } from '@tarojs/components'
import './index.scss'

/**
 * SectionFin · 章末落款
 * ============================================================
 *  印刷品每一章末右下角的小落款:
 *    ─────────────
 *         § 02 FIN · 13 readings · 05-12 23:42
 *
 *  · 仅装饰性, 不承担点击
 *  · 外层 section 给它底边 padding 即可
 * ============================================================ */

interface Props {
  seal: string        // "§ 02"
  meta?: string       // "13 readings" / "SEN-KIRO-ENV-DM01"
  time?: string       // "05-12 23:42"
}

export default function SectionFin({ seal, meta, time }: Props) {
  return (
    <View className='section-fin'>
      <View className='section-fin__rule' />
      <Text className='section-fin__text'>
        {seal} FIN
        {meta ? <Text className='section-fin__dot'> · </Text> : null}
        {meta ? <Text className='section-fin__meta'>{meta}</Text> : null}
        {time ? <Text className='section-fin__dot'> · </Text> : null}
        {time ? <Text className='section-fin__time'>{time}</Text> : null}
      </Text>
    </View>
  )
}
