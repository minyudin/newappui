import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import { getCurrentSolarTerm } from '@/lib/solar-terms'
import './index.scss'

/**
 * TermStamp · 二十四节气印章
 * ============================================================
 *  印刷品版心天头的"卷号印章"风:
 *    外框双 hairline · 内中 serif 节气二字 · 下附小注农谚
 *
 *  三层视觉:
 *    ① 外框   — 1px 主线
 *    ② 内框   — 0.5px 淡线 (视觉差 3px) · 模仿朱印双框
 *    ③ 四角   — 左上/右下两个 4×4 刀口短线 · 像胶版印刷的"规矩线"
 *
 *  季节联动:
 *    season='spring' → farm-green (深田绿)
 *    season='summer' → moss
 *    season='autumn' → farm-earth (土褐)
 *    season='winter' → fog / slate
 *
 *  用法:
 *    <TermStamp />                    // 自动读今天
 *    <TermStamp align='end' />        // 右对齐 (用于页头右侧)
 *    <TermStamp variant='compact' />  // 紧凑版 (单行)
 * ============================================================ */

type Align = 'start' | 'end'
type Variant = 'default' | 'compact'

interface Props {
  align?: Align
  variant?: Variant
  /** 覆盖时令索引, 用于调试 */
  now?: Date
}

type Season = 'spring' | 'summer' | 'autumn' | 'winter'

function seasonOf(month: number): Season {
  // 立春 2/4 ~ 立夏 5/6
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

export default function TermStamp({ align = 'start', variant = 'default', now }: Props) {
  const term = useMemo(() => getCurrentSolarTerm(now ?? new Date()), [now])
  const season = useMemo(() => seasonOf(term.month), [term])

  // volume 编号 · 节气在 24 节气中的序号, 从立春算起
  const ordinal = useMemo(() => {
    const startMonth = term.month
    const yearOffset = startMonth >= 2 ? 0 : 24 // 1月属上一年末
    const springStart = { month: 2, day: 4 }
    // 简版: 按 month*2 估一下, 不求精, 只为让印章多一行等宽数字
    let count = 0
    for (let m = 1; m <= 12; m++) {
      if (m < term.month) count += 2
      if (m === term.month) count += term.day > 20 ? 2 : 1
    }
    return count - (springStart.month - 1) * 2 + yearOffset
  }, [term])

  return (
    <View
      className={[
        'term-stamp',
        `term-stamp--${season}`,
        `term-stamp--${variant}`,
        align === 'end' ? 'term-stamp--end' : '',
      ].filter(Boolean).join(' ')}
    >
      <View className='term-stamp__frame'>
        <View className='term-stamp__frame-inner'>
          <View className='term-stamp__corner term-stamp__corner--tl' />
          <View className='term-stamp__corner term-stamp__corner--br' />
          <View className='term-stamp__body'>
            <Text className='term-stamp__volume'>卷 {String(ordinal).padStart(2, '0')}</Text>
            <Text className='term-stamp__name'>{term.name}</Text>
          </View>
        </View>
      </View>
      {variant === 'default' ? (
        <Text className='term-stamp__saying'>— {term.saying}</Text>
      ) : null}
    </View>
  )
}
