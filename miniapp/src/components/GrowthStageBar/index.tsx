import { View, Text } from '@tarojs/components'
import { useMemo } from 'react'
import './index.scss'

/**
 * GrowthStageBar · 生长阶段进度条
 * ============================================================
 *  设计 · "书本阅读进度条":
 *    播种 ── 出苗 ── 生长 ──●开花 ── 成熟
 *                          ↑ 当前 · 抽穗期
 *    - 5 节点的 canonical 阶段模型 (适配不同作物的各种 growth_stage 字段值)
 *    - hairline 连线 · 墨点填充表示"已过" · 深田绿同心圆表示"当前"
 *    - 下方注脚显示原始阶段中文名 (如 "抽穗期" / "块茎膨大期")
 *
 *  后端契合:
 *    crop_batch.growth_stage 是 VARCHAR(32) 自由字符串 (如 heading/tuber_growth)
 *    · 已识别的 key 进 canonical 5 格;
 *    · 未识别的 key 不显示进度条, 仅回退到纯文字展示.
 * ============================================================ */

interface Props {
  /** 后端 growth_stage 字段原始值 */
  stage: string | null | undefined
}

// canonical 5 阶段 · 农作物共用抽象
const STAGES = [
  { key: 'sowing',     label: '播种' },
  { key: 'seedling',   label: '出苗' },
  { key: 'vegetative', label: '生长' },
  { key: 'flowering',  label: '开花' },
  { key: 'maturing',   label: '成熟' },
] as const

// 后端原值 → canonical 0-4 index · 不识别返回 -1
const STAGE_INDEX: Record<string, number> = {
  // 播种期
  sowing: 0, seeded: 0, germination: 0,
  // 出苗/发芽期
  seedling: 1, emergence: 1, sprouting: 1,
  // 营养生长期 (分蘖/拔节/分枝)
  vegetative: 2, tillering: 2, jointing: 2, branching: 2,
  // 生殖生长期 (开花/抽穗/孕穗/现蕾/坐果/灌浆/块茎膨大)
  flowering: 3, heading: 3, booting: 3, budding: 3,
  tuber_growth: 3, filling: 3, fruiting: 3, fruit_set: 3,
  // 成熟采收期
  maturing: 4, ripening: 4, harvest: 4, ready: 4,
}

// 原值中文展示名 · 比 canonical 更贴合具体作物
const STAGE_LABEL: Record<string, string> = {
  sowing: '播种期', seeded: '已播种', germination: '发芽期',
  seedling: '出苗期', emergence: '出苗', sprouting: '萌发',
  vegetative: '营养生长期', tillering: '分蘖期', jointing: '拔节期', branching: '分枝期',
  flowering: '开花期', heading: '抽穗期', booting: '孕穗期', budding: '现蕾期',
  tuber_growth: '块茎膨大期', filling: '灌浆期', fruiting: '结果期', fruit_set: '坐果期',
  maturing: '成熟期', ripening: '成熟期', harvest: '收获期', ready: '可采收',
}

export default function GrowthStageBar({ stage }: Props) {
  const idx = useMemo(() => {
    if (!stage) return -1
    return STAGE_INDEX[stage] ?? -1
  }, [stage])

  const currentLabel = useMemo(() => {
    if (stage && STAGE_LABEL[stage]) return STAGE_LABEL[stage]
    return stage || '未知'
  }, [stage])

  // 无有效阶段数据 → 不渲染进度条, 交给外层其他展示
  if (idx < 0) return null

  return (
    <View className='growth-bar'>
      <View className='growth-bar__track'>
        <View className='growth-bar__line' />
        {STAGES.map((s, i) => {
          const done = i < idx
          const active = i === idx
          return (
            <View key={s.key} className='growth-bar__node'>
              <View
                className={`growth-bar__dot ${done ? 'growth-bar__dot--done' : ''} ${active ? 'growth-bar__dot--active' : ''}`}
              >
                {active ? <View className='growth-bar__dot-inner' /> : null}
              </View>
              <Text
                className={`growth-bar__label ${active ? 'growth-bar__label--active' : ''} ${done ? 'growth-bar__label--done' : ''}`}
              >
                {s.label}
              </Text>
            </View>
          )
        })}
      </View>

      <View className='growth-bar__caption'>
        <Text className='growth-bar__caption-key'>当前 ·</Text>
        <Text className='growth-bar__caption-val'>{currentLabel}</Text>
      </View>
    </View>
  )
}
