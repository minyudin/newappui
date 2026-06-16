import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { listOperatorQueueTasks, getMyOperatorPlots, claimOperatorTask, reviewOperatorTask } from '@/api/operator'
import { useAuthStore } from '@/store/auth'
import { useRequireRole } from '@/hooks/useRequireRole'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import './index.scss'

type TabKey = 'plots' | 'queue'

export default function OperatorWorkbenchPage() {
  const userInfo = useAuthStore((s) => s.userInfo)
  const [tab, setTab] = useState<TabKey>('queue')
  const [loading, setLoading] = useState(false)
  const [plots, setPlots] = useState<Array<{ plotId: number; plotName: string; isPrimary: 0 | 1 }>>([])
  const [queue, setQueue] = useState<Array<any>>([])
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null)
  // M5 · ref 瞬时锁 · 比 state 早一帧生效, 防快速双击穿透 busyTaskId
  const busyRef = useRef<number | null>(null)
  const [mineOnly, setMineOnly] = useState(false)

  const isOperator = userInfo?.roleType === 'operator'

  // G2 · S1/M4 角色守卫抽到 hook: 非 operator 自动 switchTab 到各自 landing,
  //      无 token 回登录. useLoad + useDidShow 两点都挂, 覆盖“登出/换角色”之后的 tab 切回.
  useRequireRole('operator')

  // tabBar 同步 + 数据刷新: useRequireRole 已保证此时 isOperator=true,
  //   refresh() 内部的 if (!isOperator) return 是双保险, 预防 store 未来改动时的 race
  useDidShow(() => {
    Taro.eventCenter.trigger(TAB_BAR_SYNC_EVT, '/pages/operator-workbench/index')
    if (useAuthStore.getState().userInfo?.roleType === 'operator') {
      refresh()
    }
  })

  const queueTitle = useMemo(() => {
    const pending = queue.filter((t) => t.reviewState === 'operator_required' && t.taskStatus === 'pending').length
    return pending > 0 ? `待审核 · ${pending}` : '待审核'
  }, [queue])
  const stateLine = useMemo(() => {
    const pending = queue.filter((t) => t.reviewState === 'operator_required' && t.taskStatus === 'pending').length
    const scope = mineOnly ? '仅我的任务' : '责任域全部'
    return `当前视图：${scope} · 待审核 ${pending} 条`
  }, [mineOnly, queue])

  async function refresh() {
    if (!isOperator) return
    setLoading(true)
    try {
      const [p, q] = await Promise.all([
        getMyOperatorPlots({ pageNo: 1, pageSize: 50 }),
        listOperatorQueueTasks({
          pageNo: 1,
          pageSize: 30,
          reviewState: 'operator_required',
          ...(mineOnly ? { mine: 1 } : {}),
        }),
      ])
      setPlots(p.list ?? [])
      setQueue(q.list ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleClaim(taskId: number) {
    if (busyRef.current != null) return
    busyRef.current = taskId
    setBusyTaskId(taskId)
    try {
      await claimOperatorTask(taskId)
      Taro.showToast({ title: '已认领', icon: 'none' })
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '认领失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      busyRef.current = null
      setBusyTaskId(null)
    }
  }

  async function handleApprove(taskId: number) {
    if (busyRef.current != null) return
    busyRef.current = taskId
    setBusyTaskId(taskId)
    try {
      await reviewOperatorTask(taskId, { decision: 'approve' })
      Taro.showToast({ title: '已通过', icon: 'none' })
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '通过失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      busyRef.current = null
      setBusyTaskId(null)
    }
  }

  async function handleReject(taskId: number) {
    if (busyRef.current != null) return
    const res = await Taro.showModal({
      title: '拒绝执行?',
      content: '拒绝后任务将结束，并回写原因给用户侧。',
      confirmText: '拒绝',
      cancelText: '取消',
      confirmColor: '#c5826a',
      editable: true,
      placeholderText: '可选：填写拒绝原因',
    } as any)
    if (!res.confirm) return
    const reason = (res as any).content || undefined

    busyRef.current = taskId
    setBusyTaskId(taskId)
    try {
      await reviewOperatorTask(taskId, { decision: 'reject', reason })
      Taro.showToast({ title: '已拒绝', icon: 'none' })
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '拒绝失败'
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      busyRef.current = null
      setBusyTaskId(null)
    }
  }

  return (
    <View className='opwb'>
      <View className='opwb-head'>
        <Text className='opwb-head__seal'>§ · 运营工作台</Text>
        <Text className='opwb-head__title'>运营工作台</Text>
        <Text className='opwb-head__lede'>我的地块 · 待审核任务</Text>
        <Text className='opwb-head__state'>{stateLine}</Text>
      </View>

      <View className='opwb-tabs'>
        <View className={`opwb-tab ${tab === 'queue' ? 'opwb-tab--active' : ''}`} onClick={() => setTab('queue')}>
          <Text className='opwb-tab__text'>{queueTitle}</Text>
        </View>
        <View className={`opwb-tab ${tab === 'plots' ? 'opwb-tab--active' : ''}`} onClick={() => setTab('plots')}>
          <Text className='opwb-tab__text'>我的地块</Text>
        </View>
      </View>

      <View className='opwb-body'>
        {tab === 'queue' ? (
          <View className='opwb-card'>
            <View className='opwb-subtabs'>
              <View
                className={`opwb-subtab ${!mineOnly ? 'opwb-subtab--active' : ''}`}
                onClick={() => setMineOnly(false)}
              >
                <Text className='opwb-subtab__text'>责任域全部</Text>
              </View>
              <View
                className={`opwb-subtab ${mineOnly ? 'opwb-subtab--active' : ''}`}
                onClick={() => setMineOnly(true)}
              >
                <Text className='opwb-subtab__text'>仅我的</Text>
              </View>
            </View>
            {queue.length === 0 && !loading ? (
              <View className='opwb-empty'>
                <Text className='opwb-empty__text'>暂无待审核任务</Text>
              </View>
            ) : null}

            {queue.map((t) => {
              const busy = busyTaskId === t.taskId
              const active = busyTaskId === t.taskId
              const canReview = t.reviewState === 'operator_required' && t.taskStatus === 'pending'
              const hasAssignee = !!t.assigneeUserId
              const taskState = taskStatusText(t.taskStatus)
              return (
                <View className={`opwb-item ${active ? 'opwb-item--active' : ''}`} key={t.taskId}>
                  <View className='opwb-item__meta'>
                    <Text className='opwb-item__no'>{t.taskNo ? shrinkNo(t.taskNo) : `#${t.taskId}`}</Text>
                    <Text className='opwb-item__dim'>· PLOT {t.plotId ?? '—'}</Text>
                    <Text className='opwb-item__dim'>· {t.actionType ?? '—'}</Text>
                    <Text className='opwb-item__state'>· {taskState}</Text>
                  </View>
                  <View className='opwb-item__badges'>
                    <Text className={`opwb-badge opwb-badge--${tone(t.riskLevel)}`}>{String(t.riskLevel || '—').toUpperCase()}</Text>
                    <Text className='opwb-badge opwb-badge--ink'>{t.reviewState || '—'}</Text>
                    {hasAssignee ? <Text className='opwb-badge opwb-badge--fog'>已认领</Text> : null}
                  </View>
                  {t.riskReasons ? (
                    <Text className='opwb-item__reason'>REASONS · {String(t.riskReasons)}</Text>
                  ) : null}
                  <View className='opwb-item__ops'>
                    <Button
                      className='opwb-btn opwb-btn--ghost'
                      disabled={busy || hasAssignee}
                      onClick={() => handleClaim(t.taskId)}
                    >
                      认领
                    </Button>
                    <Button
                      className='opwb-btn opwb-btn--primary'
                      disabled={busy || !canReview}
                      onClick={() => handleApprove(t.taskId)}
                    >
                      通过
                    </Button>
                    <Button
                      className='opwb-btn opwb-btn--danger'
                      disabled={busy || !canReview}
                      onClick={() => handleReject(t.taskId)}
                    >
                      拒绝
                    </Button>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className='opwb-card'>
            {plots.length === 0 && !loading ? (
              <View className='opwb-empty'>
                <Text className='opwb-empty__text'>暂无绑定地块</Text>
              </View>
            ) : null}
            {plots.map((p) => (
              <View className='opwb-plot' key={p.plotId}>
                <View className='opwb-plot__left'>
                  <Text className='opwb-plot__name'>{p.plotName}</Text>
                  <Text className='opwb-plot__dim'>PLOT #{p.plotId}</Text>
                </View>
                <Text className={`opwb-badge opwb-badge--${p.isPrimary === 1 ? 'moss' : 'fog'}`}>
                  {p.isPrimary === 1 ? '主责' : '备份'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Button className='opwb-refresh' onClick={refresh} disabled={loading}>
        <Text className='opwb-refresh__text'>{loading ? '刷新中…' : 'Refresh · 刷新'}</Text>
      </Button>
    </View>
  )
}

function shrinkNo(no: string) {
  return no.length > 10 ? `${no.slice(0, 2)}…${no.slice(-6)}` : no
}

function tone(level?: string) {
  const v = String(level || '').toLowerCase()
  if (v === 'high') return 'clay'
  if (v === 'medium') return 'sand'
  if (v === 'low') return 'fog'
  return 'ink'
}

function taskStatusText(status?: string) {
  const v = String(status || '').toLowerCase()
  if (v === 'pending') return '待处理'
  if (v === 'queued') return '已排队'
  if (v === 'running') return '执行中'
  if (v === 'success') return '已完成'
  if (v === 'failed') return '已失败'
  if (v === 'cancelled') return '已取消'
  return status || '未知'
}

