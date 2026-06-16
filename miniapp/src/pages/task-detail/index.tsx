import { View, Text, Button } from '@tarojs/components'
import Taro, { useUnload, useRouter, useDidHide } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { usePageRefresh } from '@/hooks/usePageRefresh'
import { getTaskDetail, getQueueStatus, cancelTask } from '@/api/task'
import type { OperationTaskDetail, TaskStatusValue } from '@/types'
import SectionFin from '@/components/SectionFin'
import DigitFlipper from '@/components/DigitFlipper'
import Typewriter from '@/components/Typewriter'
import './index.scss'

/**
 * §4.1 · 任务详情 · 派工单印刷页
 * ============================================================
 *  页面被重新设计成"一张盖完章的纸质派工单":
 *
 *    ┌──────────────────────────────────────────┐
 *    │ § 04 · WORK ORDER / 派 工 单             │
 *    ├──────────────────────────────────────────┤
 *    │ T 2053855648671731712                    │ ← 票据编号, 大号等宽
 *    ├──────────────────────────────────────────┤
 *    │ 申请浇水 · irrigation_apply              │
 *    │ [STATUS PILL] · risk: LOW               │
 *    ├──────────────────────────────────────────┤
 *    │ 提交  ◼   审核  ◑   排队  ◯   执行  ◯   完成  ◯│
 *    ├──────────────────────────────────────────┤
 *    │ 操作   · 申请浇水                         │
 *    │ 地块   · #40053                          │
 *    │ 设备   · #80061                          │
 *    │ 调度   · asap                            │
 *    │ 提交   · 2026-05-11 23:12:00             │
 *    │ 完成   · —                               │
 *    ├──────────────────────────────────────────┤
 *    │                 § PASSED / 05-11 23:16   │ ← success 时的盖章
 *    └──────────────────────────────────────────┘
 *
 *  轮询策略 (未改):
 *    · pending/queued/running/operator_required → 每 3 秒轮询
 *    · success/failed/cancelled → 停止
 * ============================================================ */

// 6 段状态机: submit → review? → queue → run → done
type TimelineStep =
  | 'submit'
  | 'review'
  | 'queue'
  | 'run'
  | 'done'

interface StepDef {
  key: TimelineStep
  label: string
  sub: string
}

const STEPS_WITH_REVIEW: StepDef[] = [
  { key: 'submit', label: '提交', sub: 'SUBMIT' },
  { key: 'review', label: '审核', sub: 'REVIEW' },
  { key: 'queue',  label: '排队', sub: 'QUEUE' },
  { key: 'run',    label: '执行', sub: 'RUN' },
  { key: 'done',   label: '完成', sub: 'DONE' },
]

const STEPS_AUTO: StepDef[] = [
  { key: 'submit', label: '提交', sub: 'SUBMIT' },
  { key: 'queue',  label: '排队', sub: 'QUEUE' },
  { key: 'run',    label: '执行', sub: 'RUN' },
  { key: 'done',   label: '完成', sub: 'DONE' },
]

const STATUS_LABEL: Record<TaskStatusValue, string> = {
  pending: '待处理',
  queued: '已排队',
  running: '执行中',
  success: '已完成',
  failed: '已失败',
  cancelled: '已取消',
}

const STATUS_TONE: Record<TaskStatusValue, string> = {
  pending: 'waiting',
  queued: 'waiting',
  running: 'running',
  success: 'success',
  failed: 'fail',
  cancelled: 'cancel',
}

function isTerminal(status: TaskStatusValue): boolean {
  return status === 'success' || status === 'failed' || status === 'cancelled'
}

/**
 * 根据 task 当前 taskStatus + reviewState 确定进度条激活到第几段.
 * review_state 为 operator_required → 卡在 review 段;
 * reviewState=approved 则放行, 走回 queue/run/done.
 */
function resolveActiveStep(d: OperationTaskDetail, hasReview: boolean): TimelineStep {
  const st = d.taskStatus
  const rv = (d.reviewState || 'none').toLowerCase()
  if (st === 'success') return 'done'
  if (st === 'failed' || st === 'cancelled') return 'done' // fail/cancel 也终态
  if (hasReview && rv === 'operator_required') return 'review'
  if (st === 'running') return 'run'
  if (st === 'queued') return 'queue'
  return 'submit'
}

// 小 utility: 把 "2026-05-11 23:16:21" → "2026·05·11 · 23:16"
function fmtDot(ts: string | null | undefined): string {
  if (!ts) return '—'
  const dateA = ts.slice(0, 10).replace(/-/g, ' · ')
  const timeA = ts.slice(11, 16)
  return `${dateA}  ${timeA}`
}

export default function TaskDetailPage() {
  const router = useRouter()
  const taskId = Number(router.params.taskId || 0)

  const [detail, setDetail] = useState<OperationTaskDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const detailRef = useRef<OperationTaskDetail | null>(null)
  const cancellingRef = useRef(false)

  function applyDetail(d: OperationTaskDetail) {
    detailRef.current = d
    setDetail(d)
  }

  usePageRefresh(() => {
    if (!taskId) {
      setErr('参数缺失 · taskId')
      return
    }
    fetchDetail()
  })

  useDidHide(() => stopPolling())
  useUnload(() => stopPolling())

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer.current = setInterval(async () => {
      try {
        const qs = await getQueueStatus(taskId)
        const cur = detailRef.current
        if (!cur || qs.taskStatus !== cur.taskStatus) {
          const d = await getTaskDetail(taskId)
          applyDetail(d)
          if (isTerminal(d.taskStatus)) stopPolling()
        } else {
          if (
            qs.queueNo !== cur.queueNo ||
            qs.estimatedWaitMinutes !== cur.estimatedWaitMinutes
          ) {
            applyDetail({
              ...cur,
              queueNo: qs.queueNo,
              estimatedWaitMinutes: qs.estimatedWaitMinutes,
            })
          }
          if (isTerminal(qs.taskStatus)) stopPolling()
        }
      } catch {
        /* swallow single poll error */
      }
    }, 3000)
  }

  async function fetchDetail() {
    setLoading(true)
    setErr('')
    try {
      const d = await getTaskDetail(taskId)
      applyDetail(d)
      if (!isTerminal(d.taskStatus)) startPolling()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!detail || !detail.cancelable) return
    if (cancellingRef.current) return
    cancellingRef.current = true
    try {
      const res = await Taro.showModal({
        title: '确认取消任务?',
        content: `${detail.actionName} · ${detail.taskNo}`,
        confirmText: '确认取消',
        cancelText: '再想想',
      })
      if (!res.confirm) return
      setCancelling(true)
      try {
        await cancelTask(taskId, '用户主动取消')
        Taro.showToast({ title: '已取消', icon: 'success', duration: 1200 })
        stopPolling()
        await fetchDetail()
      } catch (e) {
        Taro.showToast({
          title: e instanceof Error ? e.message : '取消失败',
          icon: 'none',
        })
      } finally {
        setCancelling(false)
      }
    } finally {
      cancellingRef.current = false
    }
  }

  if (err) {
    return (
      <View className='wo-page'>
        <View className='wo-err-box'>
          <Text className='wo-err-box__seal'>§ ERR · 加载失败</Text>
          <Text className='wo-err-box__msg'>{err}</Text>
          <Button
            className='wo-err-box__retry'
            loading={loading}
            disabled={loading}
            onClick={fetchDetail}
          >
            <Text>{loading ? '重试中…' : '重试 ↻'}</Text>
          </Button>
          <Button
            className='wo-err-box__back'
            onClick={() => Taro.navigateBack()}
          >
            <Text>← 返回</Text>
          </Button>
        </View>
      </View>
    )
  }

  if (!detail && loading) {
    return (
      <View className='wo-page'>
        <Text className='wo-placeholder'>LOADING · 工单读取中</Text>
      </View>
    )
  }

  if (!detail) {
    return (
      <View className='wo-page'>
        <Text className='wo-placeholder'>NOT FOUND · 无此工单</Text>
      </View>
    )
  }

  // --- 计算当前激活段 + 是否展示审核段 ---
  const reviewState = (detail.reviewState || 'none').toLowerCase()
  const hasReview =
    reviewState !== 'none' || detail.riskLevel === 'high' || detail.riskLevel === 'medium'
  const steps = hasReview ? STEPS_WITH_REVIEW : STEPS_AUTO
  const activeStep = resolveActiveStep(detail, hasReview)
  const activeIdx = steps.findIndex((s) => s.key === activeStep)

  const tone = STATUS_TONE[detail.taskStatus as TaskStatusValue] || 'waiting'
  const isSuccess = detail.taskStatus === 'success'
  const isFailed = detail.taskStatus === 'failed'
  const isCancelled = detail.taskStatus === 'cancelled'
  const isReviewRequired = reviewState === 'operator_required'

  // 工单票据编号拆成 T + body (供大号展示)
  const taskNoHead = detail.taskNo.slice(0, 1)
  const taskNoBody = detail.taskNo.slice(1)

  const riskTag = (detail.riskLevel || 'low').toUpperCase()
  const riskReasonList = (detail.riskReasons || '')
    .split(/[,\s、]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <View className='wo-page'>
      {/* --- 页头 · WORK ORDER --- */}
      <View className='wo-head'>
        <View className='wo-head__rule' />
        <View className='wo-head__row'>
          <Text className='wo-head__seal'>§ 04 · WORK ORDER</Text>
          <Text className='wo-head__subtitle'>派 工 单</Text>
        </View>
        <View className='wo-head__rule wo-head__rule--double' />
      </View>

      {/* --- 工单编号 · 大号等宽, 像粮票/工单的中央编码 --- */}
      <View className='wo-ticket'>
        <Text className='wo-ticket__prefix'>{taskNoHead}</Text>
        <Text className='wo-ticket__body'>{taskNoBody}</Text>
      </View>
      <Text className='wo-ticket-caption'>TASK · NO.</Text>

      {/* --- 动作 + 状态 pill + risk tag --- */}
      <View className='wo-action'>
        <View className='wo-action__head'>
          <Text className='wo-action__title'>{detail.actionName}</Text>
          <Text className={`wo-action__status wo-action__status--${tone}`}>
            {STATUS_LABEL[detail.taskStatus as TaskStatusValue] || detail.taskStatus}
          </Text>
        </View>
        <View className='wo-action__sub'>
          <Text className='wo-action__type'>{detail.actionType}</Text>
          <Text className='wo-action__dot'>·</Text>
          <Text className={`wo-action__risk wo-action__risk--${(detail.riskLevel || 'low').toLowerCase()}`}>
            RISK {riskTag}
          </Text>
          {isReviewRequired ? (
            <>
              <Text className='wo-action__dot'>·</Text>
              <Text className='wo-action__risk wo-action__risk--review'>PENDING REVIEW</Text>
            </>
          ) : null}
        </View>

        {riskReasonList.length > 0 ? (
          <Text className='wo-action__reasons'>
            { '标记: ' + riskReasonList.join(' · ')}
          </Text>
        ) : null}
      </View>

      {/* --- 步骤表 (4 或 5 段) --- */}
      <View className={`wo-steps wo-steps--${steps.length}`}>
        {steps.map((step, idx) => {
          const done = idx < activeIdx || (isSuccess && step.key === 'done')
          const current = idx === activeIdx && !isSuccess
          const mark = done ? '◼' : current ? '◑' : '◯'
          return (
            <View
              key={step.key}
              className={[
                'wo-step',
                done ? 'wo-step--done' : '',
                current ? 'wo-step--current' : '',
              ].filter(Boolean).join(' ')}
            >
              <Text className='wo-step__mark'>{mark}</Text>
              <Text className='wo-step__label'>{step.label}</Text>
              <Text className='wo-step__sub'>{step.sub}</Text>
            </View>
          )
        })}
      </View>

      {/* --- 排队提示 · 墨色编号票 --- */}
      {detail.queueNo && !isTerminal(detail.taskStatus as TaskStatusValue) ? (
        <View className='wo-queue'>
          <Text className='wo-queue__key'>QUEUE</Text>
          <Text className='wo-queue__val'>#{detail.queueNo}</Text>
          {detail.estimatedWaitMinutes ? (
            <Text className='wo-queue__sub'>约 {detail.estimatedWaitMinutes} min</Text>
          ) : null}
        </View>
      ) : null}

      {/* --- 失败原因 --- */}
      {isFailed && detail.failReason ? (
        <View className='wo-fail'>
          <Text className='wo-fail__seal'>§ FAIL · 失败原因</Text>
          <Text className='wo-fail__msg'>{detail.failReason}</Text>
        </View>
      ) : null}

      {/* --- 元信息表 · 左栏 key / 右栏 val --- */}
      <View className='wo-meta'>
        <MetaRow k='操作'   v={detail.actionName} />
        <MetaRow k='类型'   v={detail.actionType} mono />
        <MetaRow k='地块'   v={`#${detail.plotId}`} mono />
        <MetaRow k='设备'   v={`#${detail.deviceId}`} mono />
        <MetaRow k='调度'   v={detail.schedulingMode} mono />
        <MetaRow k='提交'   v={fmtDot(detail.createdAt)} mono />
        {detail.queuedAt   ? <MetaRow k='排队' v={fmtDot(detail.queuedAt)}   mono /> : null}
        {detail.startedAt  ? <MetaRow k='开始' v={fmtDot(detail.startedAt)}  mono /> : null}
        {detail.finishedAt ? <MetaRow k='完成' v={fmtDot(detail.finishedAt)} mono /> : null}
        {detail.assigneeUserId ? (
          <MetaRow k='认领' v={`operator#${detail.assigneeUserId}`} mono />
        ) : null}
      </View>

      {/* --- 成功 / 失败 / 取消的盖章区 --- */}
      {isSuccess ? (
        <View className='wo-stamp wo-stamp--passed'>
          <Text className='wo-stamp__seal'>§ PASSED</Text>
          <Text className='wo-stamp__meta'>
            {detail.finishedAt ? fmtDot(detail.finishedAt) : ''}
          </Text>
        </View>
      ) : null}
      {isFailed ? (
        <View className='wo-stamp wo-stamp--fail'>
          <Text className='wo-stamp__seal'>§ FAIL</Text>
          <Text className='wo-stamp__meta'>
            {detail.finishedAt ? fmtDot(detail.finishedAt) : ''}
          </Text>
        </View>
      ) : null}
      {isCancelled ? (
        <View className='wo-stamp wo-stamp--void'>
          <Text className='wo-stamp__seal'>§ VOID</Text>
          <Text className='wo-stamp__meta'>CANCELLED</Text>
        </View>
      ) : null}

      <SectionFin seal='§ 04' meta={detail.taskNo.slice(-8)} time={detail.createdAt?.slice(5, 16)} />

      {/* --- 底部按钮 --- */}
      {detail.cancelable ? (
        <Button
          className='wo-action-btn wo-action-btn--cancel'
          loading={cancelling}
          disabled={cancelling}
          onClick={handleCancel}
        >
          <Text>取消任务</Text>
        </Button>
      ) : null}

      <Button
        className='wo-action-btn wo-action-btn--back'
        onClick={() => Taro.navigateBack()}
      >
        <Text>← 返回</Text>
      </Button>
    </View>
  )
}

function MetaRow({
  k,
  v,
  mono,
}: {
  k: string
  v: string
  mono?: boolean
}) {
  return (
    <View className='wo-row'>
      <Text className='wo-row__key'>{k}</Text>
      <View className='wo-row__leader' />
      <Text className={`wo-row__val ${mono ? 'wo-row__val--mono' : ''}`}>{v}</Text>
    </View>
  )
}
