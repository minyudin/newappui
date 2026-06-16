import DigitFlipper from '@/components/digit/DigitFlipper'
import './TaskStatusStrip.scss'

/**
 * TaskStatusStrip · 任务页顶部 6 状态 KPI 条
 * ============================================================
 *  设计意图:
 *   把"待处理 / 排队中 / 执行中 / 已完成 / 失败 / 已取消" 6 个状态
 *   做成一行 KPI 条, 每格显示数量 (DigitFlipper) + 状态色, 点击切换筛选
 *
 *  视觉:
 *   · 6 等分单行栅格 + hairline 分隔
 *   · 当前激活状态: 顶部 2px 主色锚条 + 背景浅色
 *   · running 状态点呼吸 (绿) / failed 呼吸 (砖红)
 * ============================================================ */

interface StatusKey {
  value: string
  cn: string
  en: string
  /** 数据色调 (与 STATUS_COLOR 对齐) */
  hue: 'sand' | 'fog' | 'moss' | 'sage' | 'clay' | 'neutral'
  /** 是否需要呼吸点 */
  breathing?: boolean
}

const STATUS_KEYS: StatusKey[] = [
  { value: 'pending',   cn: '待处理', en: 'PENDING',   hue: 'sand',    breathing: true },
  { value: 'queued',    cn: '排队中', en: 'QUEUED',    hue: 'fog' },
  { value: 'running',   cn: '执行中', en: 'RUNNING',   hue: 'moss',    breathing: true },
  { value: 'success',   cn: '已完成', en: 'SUCCESS',   hue: 'sage' },
  { value: 'failed',    cn: '失败',   en: 'FAILED',    hue: 'clay',    breathing: true },
  { value: 'cancelled', cn: '已取消', en: 'CANCELLED', hue: 'neutral' },
]

interface Props {
  /** 当前激活状态 (空字符串 = 全部) */
  active: string
  onSelect: (status: string) => void
  /** 各状态的计数 (key 是 status value, value 是数量) */
  counts: Record<string, number>
  total: number
}

export default function TaskStatusStrip({ active, onSelect, counts, total }: Props) {
  return (
    <div className="task-strip">
      <button
        type="button"
        className={`task-strip__cell task-strip__cell--all${active === '' ? ' task-strip__cell--active' : ''}`}
        onClick={() => onSelect('')}
        data-testid="tasks-strip-all"
      >
        <span className="task-strip__cell-en">ALL</span>
        <span className="task-strip__cell-num">
          <DigitFlipper value={total} size="default" />
        </span>
        <span className="task-strip__cell-cn">全部</span>
      </button>
      {STATUS_KEYS.map((s) => {
        const count = counts[s.value] ?? 0
        const isActive = active === s.value
        return (
          <button
            key={s.value}
            type="button"
            className={`task-strip__cell task-strip__cell--${s.hue}${isActive ? ' task-strip__cell--active' : ''}${count === 0 ? ' task-strip__cell--zero' : ''}`}
            onClick={() => onSelect(s.value)}
            data-testid={`tasks-strip-${s.value}`}
          >
            <span className="task-strip__cell-en">
              {s.breathing && count > 0 ? <span className="task-strip__dot" /> : null}
              {s.en}
            </span>
            <span className="task-strip__cell-num">
              <DigitFlipper value={count} size="default" />
            </span>
            <span className="task-strip__cell-cn">{s.cn}</span>
          </button>
        )
      })}
    </div>
  )
}
